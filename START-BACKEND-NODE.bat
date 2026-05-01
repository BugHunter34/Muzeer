@echo off
setlocal

cd /d "%~dp0server"

set "NODE_ENV=production"
set "SKIP_DB_CONNECT=1"
set "TRUST_PROXY=1"
set "CORS_ALLOWED_ORIGINS=https://muzeer.com,https://www.muzeer.com,https://muzeer.pages.dev,http://localhost:5173"
set "PUBLIC_API_URL=https://api.muzeer.com"
set "COOKIE_SAME_SITE=none"
set "COOKIE_DOMAIN=api.muzeer.com"

if not exist "node_modules" (
  echo Installing Node dependencies...
  npm install
  if errorlevel 1 goto :fail
)

echo Starting Node API on port 3000...
npm start
exit /b %errorlevel%

:fail
echo Failed to start Node backend.
pause
exit /b 1
