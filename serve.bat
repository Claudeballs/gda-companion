@echo off
title GdA Companion server
echo.
echo  ============================================
echo   GdA Companion is being served.
echo.
echo   On your phone (same Wi-Fi), open:
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4" ^| findstr /v "169.254"') do (
  for /f "tokens=* delims= " %%b in ("%%a") do echo       http://%%b:8731
)
echo.
echo   Keep this window open while playing.
echo   Press Ctrl+C to stop.
echo  ============================================
echo.
cd /d "%~dp0"
py -m http.server 8731
