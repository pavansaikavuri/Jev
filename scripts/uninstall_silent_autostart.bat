@echo off
setlocal
echo ===========================================================================
echo QuizZy - Silent Background Autostart Uninstaller
echo ===========================================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall_autostart.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Uninstallation encountered an issue.
) else (
    echo [OK] QuizZy backend autostart removed and services terminated.
)
pause
