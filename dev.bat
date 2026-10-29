@echo off
setlocal EnableDelayedExpansion

:: QuizZy Developer Launcher
:: Starts the FastAPI backend with development hot-reload on 127.0.0.1:8000

cd /d "%~dp0"

set "PYTHON_EXE="
if exist "%~dp0.venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0.venv\Scripts\python.exe"
) else if exist "%~dp0..\.venv\Scripts\python.exe" (
    set "PYTHON_EXE=%~dp0..\.venv\Scripts\python.exe"
)

if "%PYTHON_EXE%"=="" (
    echo [ERROR] Virtual environment python.exe not found!
    echo Looked in:
    echo   - %~dp0.venv\Scripts\python.exe
    echo   - %~dp0..\.venv\Scripts\python.exe
    echo Please create or restore the virtual environment using:
    echo   python -m venv .venv
    echo   .\.venv\Scripts\pip install -r requirements.txt
    exit /b 1
)

echo =========================================================
echo               QuizZy Backend Developer Server             
echo =========================================================
echo [INFO] Project Root : %~dp0
echo [INFO] Python Exec  : %PYTHON_EXE%
echo [INFO] Server Target: 127.0.0.1:8000
echo [INFO] Hot-Reload   : Enabled
echo [INFO] Health Check : http://127.0.0.1:8000/health
echo =========================================================
echo Starting Uvicorn... (Press Ctrl+C to stop)
echo.

"%PYTHON_EXE%" -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 --reload %*

set "EXIT_CODE=%ERRORLEVEL%"
if %EXIT_CODE% neq 0 (
    echo.
    echo [WARNING] Server exited with code: %EXIT_CODE%
)
exit /b %EXIT_CODE%
