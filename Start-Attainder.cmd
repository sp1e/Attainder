@echo off
cd /d "%~dp0"
node scripts\launch-dynasties.mjs
if errorlevel 1 pause
