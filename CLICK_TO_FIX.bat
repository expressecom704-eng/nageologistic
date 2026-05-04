@echo off
cd /d "%~dp0"
echo Forcing Git to see the fixed code...
git add --all
echo Done! Please check GitHub Desktop now.
pause
