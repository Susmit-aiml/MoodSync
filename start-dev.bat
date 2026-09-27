@echo off
title MoodSync Developer Launcher
echo =======================================================
echo          🎵 MoodSync Developer Launcher
echo =======================================================
echo.

cd /d "%~dp0moodsync-backend"

if not exist ".env" (
    echo [!] Notice: moodsync-backend\.env does not exist yet.
    echo     Copying .env.example to .env ...
    copy ".env.example" ".env" >nul
    echo [i] Remember to add your SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to moodsync-backend\.env
    echo.
)

echo [*] Starting MoodSync Backend on http://localhost:3001 ...
echo [i] To load the Chrome Extension:
echo     1. Open Chrome and go to chrome://extensions/
echo     2. Turn on 'Developer mode' (top right)
echo     3. Click 'Load unpacked' and select: %~dp0moodsync-extension\dist
echo.
npm run dev
pause
