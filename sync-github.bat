@echo off
setlocal enabledelayedexpansion

echo 🚀 REPAIRING GITHUB DEPLOYMENT...

:: List of common Git paths on Windows
set "GIT_PATHS="C:\Program Files\Git\bin\git.exe" "C:\Program Files (x86)\Git\bin\git.exe" "%LocalAppData%\GitHubDesktop\app-*\resources\app\git\mingw64\bin\git.exe""

:: Try to find git
set "GIT_CMD=git"
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 🔍 Git not in PATH, searching common locations...
    for %%P in (%GIT_PATHS%) do (
        for /f "delims=" %%G in ('dir /b /s %%P 2^>nul') do (
            if exist "%%G" (
                set "GIT_CMD="%%G""
                goto :found_git
            )
        )
    )
    echo ❌ ERROR: Could not find git.exe. Please use GitHub Desktop to push your changes.
    pause
    exit /b
)

:found_git
echo ✅ Using Git: %GIT_CMD%

:: Staging and forcing the update
echo 📝 Staging correct local files...
%GIT_CMD% add .

echo 💾 Committing changes...
%GIT_CMD% commit -m "FIX: Restore full system code and reporting engine"

echo ☁️ Forcing update to GitHub...
%GIT_CMD% push origin main --force

if %errorlevel% eq 0 (
    echo ✅ SUCCESS! Your live site is being rebuilt now.
    echo Please wait 3-5 minutes then refresh:
    echo https://expressecom704-eng.github.io/nageologistic/
) else (
    echo ❌ PUSH FAILED. Please check GitHub Desktop for errors.
)

pause

