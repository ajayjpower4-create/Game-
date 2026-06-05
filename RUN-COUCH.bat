@echo off
cd /d "%~dp0"
title Couch - Therapy Session Simulator
echo ============================================
echo    Couch - Therapy Session Simulator
echo ============================================
echo.

rem Install dependencies the first time only.
if not exist "node_modules\" (
  echo First-time setup: installing dependencies, please wait...
  call npm.cmd install
  echo.
)

rem Read the API key from apikey.txt sitting next to this file.
if not exist "apikey.txt" (
  echo ERROR: apikey.txt was not found in this folder.
  echo.
  echo   1^) Create a plain text file named  apikey.txt  in this same folder.
  echo   2^) Paste your Anthropic API key into it ^(it starts with sk-ant-^).
  echo   3^) Save it, then double-click this launcher again.
  echo.
  pause
  exit /b
)

set /p ANTHROPIC_API_KEY=<apikey.txt

echo Starting the app...
echo A browser tab will open in a few seconds.
echo KEEP THIS WINDOW OPEN while you use the app. Close it to stop the app.
echo.
timeout /t 4 >nul
start "" "http://localhost:3000"
call npm.cmd start
pause
