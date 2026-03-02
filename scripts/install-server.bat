@echo off
title oppX Server Install
echo ========================================
echo   oppX - Server install script
echo ========================================
echo.

cd /d "%~dp0.."

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Install from https://nodejs.org/ then run this script again.
    pause
    exit /b 1
)

echo [1/4] Node version:
node -v
echo.

echo [2/4] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
)
echo.

if not exist .env (
    echo [3/4] Creating .env from .env.example...
    copy .env.example .env >nul 2>&1
    echo Edit .env and set JWT_SECRET, USE_SQLITE_LOCAL=1, etc.
) else (
    echo [3/4] .env already exists, skipping.
)
echo.

echo [4/4] Initialize local database? (creates data/local.db)
set /p INIT_DB=Run db:init? (Y/n): 
if /i "%INIT_DB%"=="" set INIT_DB=Y
if /i "%INIT_DB%"=="Y" (
    call npm run db:init
)
echo.

echo ========================================
echo   Install complete.
echo ========================================
echo.
echo Start server:
echo   npm start
echo.
echo Or production:
echo   set NODE_ENV=production && npm start
echo.
echo To run in background on Windows, use pm2 or NSSM.
echo.
pause
