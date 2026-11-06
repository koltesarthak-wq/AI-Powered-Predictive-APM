@echo off
setlocal EnableExtensions
title AI Predictive APM Agent Uninstaller

net session >nul 2>&1
if errorlevel 1 (
    echo ERROR: Run this uninstaller as Administrator.
    pause
    exit /b 1
)

set "INSTALL_DIR=%ProgramFiles%\AI-Predictive-APM-Agent"
set "AGENT_EXE=%INSTALL_DIR%\AI-Predictive-APM-Agent.exe"

echo Stopping the AI Predictive APM Agent service...
net stop AIPredictiveAPMAgent >nul 2>&1

if exist "%AGENT_EXE%" (
    "%AGENT_EXE%" remove
) else (
    sc.exe delete AIPredictiveAPMAgent >nul 2>&1
)

for /L %%I in (1,1,15) do (
    sc.exe query AIPredictiveAPMAgent >nul 2>&1
    if errorlevel 1 goto :service_removed
    timeout /t 1 /nobreak >nul
)

echo ERROR: Windows has not released the service yet. Reboot, then run this uninstaller again.
pause
exit /b 1

:service_removed
if exist "%INSTALL_DIR%" rmdir /S /Q "%INSTALL_DIR%"

echo.
echo AI Predictive APM Agent has been removed.
pause
exit /b 0
