@echo off
cd /d "%~dp0"
echo --- REMOTE SETTINGS ---
git remote -v
echo --- CURRENT BRANCH ---
git branch
echo --- STATUS ---
git status
pause
