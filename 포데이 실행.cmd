@echo off
chcp 65001 >nul
title Pawday
cd /d "%~dp0"
if not exist "%~dp0.runtime\node-v22.23.3-win-x64\node.exe" (
  echo Required runtime missing. Please keep the complete Pawday folder together.
  pause
  exit /b 1
)
"%~dp0.runtime\node-v22.23.3-win-x64\node.exe" "%~dp0launch.mjs" %*
if errorlevel 1 (
  echo.
  echo Pawday could not start. See the message above.
  pause
  exit /b 1
)
