/* Serverless two-phone pairing for the Duel tab.
   WebRTC data channel with QR-code signalling: host shows an offer QR,
   guest scans it and shows an answer QR, host scans that back — then
   the phones talk directly (LAN or phone hotspot; NO server, NO STUN,
   nothing stored anywhere). Plus the commit-reveal dice fairness
   protocol (SHA-256 via WebCrypto). */
"use strict";

/* ---------- crypto: commit-reveal fair dice ---------- */
async function sha256hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
function randomSeed() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("");
}
/* dice derived directly from the seed bytes — the commitment hash
   reveals nothing about them until the seed itself is revealed */
function diceFromSeed(seedHex) {
  const b1 = parseInt(seedHex.slice(0, 2), 16);
  const b2 = parseInt(seedHex.slice(2, 4), 16);
  return [b1 % 6 + 1, b2 % 6 + 1];
}
function rerollFromSeed(seedHex, n) {
  const b = parseInt(seedHex.slice(4 + n * 2, 6 + n * 2), 16);
  return b % 6 + 1;
}

/* ---------- compact SDP <-> QR text ---------- */
async function packSdp(obj) {
  const json = JSON.stringify(obj);
  if (typeof CompressionStream !== "undefined") {
    const cs = new CompressionStream("deflate-raw");
    const blob = new Blob([json]).stream().pipeThrough(cs);
    const buf = await new Response(blob).arrayBuffer();
    return "1" + btoa(String.fromCharCode(...new Uint8Array(buf)));
  }
  return "0" + btoa(unescape(encodeURIComponent(json)));
}
async function unpackSdp(text) {
  const mode = text[0], body = text.slice(1);
  const bytes = Uint8Array.from(atob(body), c => c.charCodeAt(0));
  if (mode === "1") {
    const ds = new DecompressionStream("deflate-raw");
    const blob = new Blob([bytes]).stream().pipeThrough(ds);
    return JSON.parse(await new Response(blob).text());
  }
  return JSON.parse(decodeURIComponent(escape(atob(body))));
}

/* ---------- QR render & camera scan ---------- */
function renderQR(text, sizePx) {
  // qrcode-generator: type 0 = auto, error correction L for capacity
  const qr = qrcode(0, "L");
  qr.addData(text);
  qr.make();
  const holder = h("div", { style: "background:#fff;padding:10px;border-radius:12px;display:inline-block;" });
  holder.innerHTML = qr.createSvgTag({ cellSize: 3, margin: 0 });
  const svg = holder.querySelector("svg");
  svg.style.width = (sizePx || 240) + "px";
  svg.style.height = (sizePx || 240) + "px";
  return holder;
}

function scanQR(onResult, onError) {
  /* returns {el, stop()} — live camera view decoding via jsQR */
  const video = h("video", { playsinline: "", style: "width:100%;max-width:340px;border-radius:12px;" });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let stream = null, timer = null, done = false;

  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    .then(s => {
      stream = s;
      video.srcObject = s;
      video.play();
      timer = setInterval(() => {
        if (done || video.readyState < 2) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
        if (hit && hit.data) {
          done = true;
          stop();
          onResult(hit.data);
        }
      }, 280);
    })
    .catch(e => onError && onError(e));

  function stop() {
    if (timer) clearInterval(timer);
    if (stream) stream.getTracks().forEach(t => t.stop());
  }
  return { el: video, stop };
}

/* ---------- WebRTC link ---------- */
const Pair = {
  pc: null, ch: null, onMessage: null, onOpen: null, onClose: null, linked: false,

  onIceState: null,

  _newPc() {
    // STUN added as belt-and-braces: on networks where mDNS local
    // candidates can't be resolved between phones, a reflexive
    // candidate sometimes still connects. Harmless when unreachable.
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    pc.onconnectionstatechange = () => {
      if (["disconnected", "failed", "closed"].includes(pc.connectionState) && Pair.linked) {
        Pair.linked = false;
        Pair.onClose && Pair.onClose();
      }
    };
    pc.oniceconnectionstatechange = () => {
      Pair.onIceState && Pair.onIceState(pc.iceConnectionState);
    };
    return pc;
  },

  /* Mobile browsers hide the phone's REAL local address behind an
     mDNS name until a camera/mic permission is granted — and many
     routers block mDNS between wireless clients, which kills the
     link. Warming the camera up FIRST puts real addresses in our
     connection offer. (The guest already has camera permission from
     scanning; the host didn't until step 2 — too late.) */
  async camWarmup() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      s.getTracks().forEach(t => t.stop());
    } catch (e) { /* denied — proceed; mDNS candidates may still work */ }
  },

  _wire(ch) {
    Pair.ch = ch;
    ch.onopen = () => { Pair.linked = true; Pair.onOpen && Pair.onOpen(); };
    ch.onclose = () => { if (Pair.linked) { Pair.linked = false; Pair.onClose && Pair.onClose(); } };
    ch.onmessage = ev => {
      let m = null;
      try { m = JSON.parse(ev.data); } catch (e) { return; }
      Pair.onMessage && Pair.onMessage(m);
    };
  },

  send(obj) {
    if (Pair.ch && Pair.ch.readyState === "open") {
      Pair.ch.send(JSON.stringify(obj));
      return true;
    }
    return false;
  },

  async iceComplete(pc) {
    if (pc.iceGatheringState === "complete") return;
    await new Promise(res => {
      const t = setTimeout(res, 6000);   // don't hang forever on odd networks
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === "complete") { clearTimeout(t); res(); }
      };
    });
  },

  /* host side: returns the offer text to show as a QR */
  async hostStart() {
    Pair.close();
    await Pair.camWarmup();   // real local addresses in the offer
    Pair.pc = Pair._newPc();
    Pair._wire(Pair.pc.createDataChannel("duel"));
    await Pair.pc.setLocalDescription(await Pair.pc.createOffer());
    await Pair.iceComplete(Pair.pc);
    return packSdp({ s: Pair.pc.localDescription.sdp, t: "o" });
  },

  /* host side: feed the guest's answer QR text */
  async hostFinish(text) {
    const o = await unpackSdp(text);
    if (o.t !== "a") throw new Error("that QR is not a reply code");
    await Pair.pc.setRemoteDescription({ type: "answer", sdp: o.s });
  },

  /* guest side: feed the host's offer QR text, returns answer text */
  async joinWithOffer(text) {
    const o = await unpackSdp(text);
    if (o.t !== "o") throw new Error("that QR is not a host code");
    Pair.close();
    Pair.pc = Pair._newPc();
    Pair.pc.ondatachannel = ev => Pair._wire(ev.channel);
    await Pair.pc.setRemoteDescription({ type: "offer", sdp: o.s });
    await Pair.pc.setLocalDescription(await Pair.pc.createAnswer());
    await Pair.iceComplete(Pair.pc);
    return packSdp({ s: Pair.pc.localDescription.sdp, t: "a" });
  },

  close() {
    Pair.linked = false;
    try { Pair.ch && Pair.ch.close(); } catch (e) {}
    try { Pair.pc && Pair.pc.close(); } catch (e) {}
    Pair.pc = Pair.ch = null;
  }
};
