@echo off
echo 🚀 SYNCING SYSTEM IMPROVEMENTS TO GITHUB...

:: 1. Check if Git is installed
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: Git is not installed or not in PATH.
    echo Please install Git from https://git-scm.com/ and try again.
    pause
    exit /b
)

:: 2. Add changes
echo 📝 Staging changes...
git add .

:: 3. Commit changes
echo 💾 Committing changes...
git commit -m "Auto update: system improvements / reporting & stock fixes"

:: 4. Push to main
echo ☁️ Pushing to GitHub...
git push origin main

if %errorlevel% eq 0 (
    echo ✅ SUCCESS! Your live site will update in a few minutes at:
    echo https://expressecom704-eng.github.io/nageologistic/
) else (
    echo ❌ PUSH FAILED. Please check your internet connection or GitHub permissions.
)

pause
