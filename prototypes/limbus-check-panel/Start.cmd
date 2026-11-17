@echo off
setlocal
if exist "%~dp0runtime\node.exe" (
    set "LIMBUS_NODE=%~dp0runtime\node.exe"
) else (
    set "LIMBUS_NODE=node.exe"
)
"%LIMBUS_NODE%" "%~dp0launch-panel.mjs" %*
if errorlevel 1 (
    echo.
    echo The panel could not start. Check that Node.js is on PATH and the panel files are together.
    pause
    exit /b 1
)
