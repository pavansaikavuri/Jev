@echo off
setlocal

cd /d "%~dp0"

set "PYTHON_EXE="
if exist "%~dp0.venv\Scripts\python.exe" set "PYTHON_EXE=%~dp0.venv\Scripts\python.exe"
if "%PYTHON_EXE%"=="" if exist "%~dp0..\.venv\Scripts\python.exe" set "PYTHON_EXE=%~dp0..\.venv\Scripts\python.exe"

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
echo                 QuizZy Test Suite Runner                 
echo =========================================================
echo [INFO] Project Root : %~dp0
echo [INFO] Python Exec  : %PYTHON_EXE%

if "%~1"=="" goto run_default
if "%~1"=="--full" goto run_full

:run_targeted
echo [INFO] Mode         : Targeted / Custom
echo [INFO] Target       : %*
echo =========================================================
echo.
"%PYTHON_EXE%" -m pytest %*
goto end

:run_full
set "EXTRA_ARGS="
:collect_full_args
shift
if "%~1"=="" goto exec_full
set "EXTRA_ARGS=%EXTRA_ARGS% %1"
goto collect_full_args

:exec_full
echo [INFO] Mode         : Full Test Suite
echo =========================================================
echo.
"%PYTHON_EXE%" -m pytest tests -q%EXTRA_ARGS%
goto end

:run_default
echo [INFO] Mode         : Full Test Suite
echo =========================================================
echo.
"%PYTHON_EXE%" -m pytest tests -q
goto end

:end
set "TEST_EXIT_CODE=%ERRORLEVEL%"
echo.
if %TEST_EXIT_CODE% equ 0 (
    echo [SUCCESS] Test run completed successfully [exit 0].
) else (
    echo [FAILURE] Test run failed with exit code %TEST_EXIT_CODE%.
)
exit /b %TEST_EXIT_CODE%
