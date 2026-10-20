@echo off
setlocal
echo ===========================================================================
echo QuizZy - Silent Background Autostart Installer
echo ===========================================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install_autostart.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Installation encountered an issue.
) else (
    echo [OK] QuizZy backend is running silently and set to autostart!
)
pause
