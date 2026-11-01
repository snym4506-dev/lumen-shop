@echo off
setlocal
title Lumen local server
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js 22.5 or newer is required.
  echo   Download it from https://nodejs.org/ and run this file again.
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  if exist ".env.example" copy ".env.example" ".env" >nul
  echo.
  echo   Created .env from .env.example.
  echo   Set ADMIN_API_KEY in .env to enable the admin API.
  echo.
)

if not exist "node_modules" (
  echo.
  echo   Installing dependencies...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo   npm install failed. Fix the error above and try again.
    pause
    exit /b 1
  )
)

if not exist "data\lumen.db" (
  echo.
  echo   Seeding the database with 50 products and local images...
  echo   This can take a minute on the first run.
  echo.
  call npm run seed
  if errorlevel 1 (
    echo.
    echo   Seeding failed. Fix the error above and try again.
    pause
    exit /b 1
  )
)

if not exist "client\dist\index.html" (
  echo.
  echo   Building the React storefront...
  echo.
  call npm run build
  if errorlevel 1 (
    echo.
    echo   Build failed. Fix the error above and try again.
    pause
    exit /b 1
  )
)

powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri http://localhost:3000/api/health -TimeoutSec 2; if ($r.success) { exit 0 } else { exit 1 } } catch { exit 1 }"
if %errorlevel% equ 0 (
  echo.
  echo   Lumen is already running at http://localhost:3000
  echo.
  start "" "http://localhost:3000"
  timeout /t 2 >nul
  exit /b
)

echo.
echo   Lumen - local storefront
echo   http://localhost:3000
echo   API: http://localhost:3000/api
echo.
echo   Keep this window open. Press Ctrl+C to stop the server.
echo.

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:3000'"
node server.js

echo.
echo   Server stopped.
pause
