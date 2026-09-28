@echo off
cd /d "%~dp0"
"%~dp0.runtime\node-v22.23.3-win-x64\node.exe" "%~dp0launch.mjs" --stop
if errorlevel 1 pause
