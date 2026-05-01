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

echo Starting tunnel: api.muzeer.com -^> http://localhost:3000
"%CF_EXE%" tunnel run --url http://localhost:3000 muzeer-api
exit /b %errorlevel%
