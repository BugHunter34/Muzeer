@echo off
setlocal

cd /d "%~dp0server"

set "MEDIA_CORS_ALLOWED_ORIGINS=https://muzeer.com,https://www.muzeer.com,https://muzeer.pages.dev,http://localhost:5173"

echo Starting Python media service on port 5000...
set "VENV_PY=%~dp0.venv\Scripts\python.exe"

if exist "%VENV_PY%" (
  "%VENV_PY%" server.py
) else (
  py -3 server.py
  if errorlevel 1 (
    echo py launcher failed, trying python...
    python server.py
  )
)

exit /b %errorlevel%
