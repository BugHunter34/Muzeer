@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0one-click-pages-upload.ps1"
if errorlevel 1 (
  echo.
  echo Failed. Press any key to close.
  pause >nul
  exit /b 1
)
echo.
echo Success. Press any key to close.
pause >nul
