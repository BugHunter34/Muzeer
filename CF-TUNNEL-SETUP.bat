@echo off
setlocal

set "CF_EXE=%USERPROFILE%\Downloads\cloudflared-windows-amd64.exe"
if not exist "%CF_EXE%" (
  echo cloudflared not found:
  echo %CF_EXE%
  echo.
  echo Edit this file and fix CF_EXE path.
  pause
  exit /b 1
)

echo Step 1/5: login to Cloudflare
"%CF_EXE%" tunnel login
if errorlevel 1 goto :fail

echo Step 2/5: create API tunnel
"%CF_EXE%" tunnel create muzeer-api

echo Step 3/5: create media tunnel
"%CF_EXE%" tunnel create muzeer-media

echo Step 4/5: route DNS for api.muzeer.com
"%CF_EXE%" tunnel route dns muzeer-api api.muzeer.com
if errorlevel 1 goto :fail

echo Step 5/5: route DNS for media.muzeer.com
"%CF_EXE%" tunnel route dns muzeer-media media.muzeer.com
if errorlevel 1 goto :fail

echo.
echo Tunnel setup done.
echo If tunnel already exists, create may print a warning. That is OK.
pause
exit /b 0

:fail
echo.
echo Setup failed.
pause
exit /b 1
