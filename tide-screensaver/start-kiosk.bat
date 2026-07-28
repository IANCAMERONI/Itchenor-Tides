@echo off
setlocal

set "ROOT=%~dp0"
set "PORT=8080"
set "URL=http://localhost:%PORT%"

REM Start the local server in the background if it isn't already running.
start "" /min powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%ROOT%serve.ps1"

REM Give the server a moment to bind the port.
timeout /t 1 /nobreak >nul

REM Prefer Chrome, fall back to Edge, in kiosk (fullscreen, chromeless) mode.
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
set "CHROME_X86=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"

if exist "%CHROME%" (
  start "" "%CHROME%" --kiosk "%URL%" --incognito --noerrdialogs --disable-session-crashed-bubble
) else if exist "%CHROME_X86%" (
  start "" "%CHROME_X86%" --kiosk "%URL%" --incognito --noerrdialogs --disable-session-crashed-bubble
) else if exist "%EDGE%" (
  start "" "%EDGE%" --kiosk "%URL%" --edge-kiosk-type=fullscreen --inprivate --no-first-run
) else (
  echo Could not find Chrome or Edge in their usual install locations.
  echo Edit this file and point CHROME/EDGE at your browser's .exe path.
  pause
)
