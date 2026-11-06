@echo off
setlocal EnableExtensions
title AI Predictive APM Agent Installer

echo.
echo ==================================================
echo   AI PREDICTIVE APM AGENT INSTALLER
echo ==================================================
echo.

net session >nul 2>&1
if errorlevel 1 (
    echo ERROR: Run this installer as Administrator.
    pause
    exit /b 1
)

set "INSTALL_DIR=%ProgramFiles%\AI-Predictive-APM-Agent"
set "AGENT_EXE=%INSTALL_DIR%\AI-Predictive-APM-Agent.exe"

if not exist "%~dp0AI-Predictive-APM-Agent.exe" (
    echo ERROR: Agent executable is missing from this package.
    pause
    exit /b 1
)

if not exist "%~dp0config.json" (
    echo ERROR: config.json is missing from this package.
    pause
    exit /b 1
)

sc.exe query AIPredictiveAPMAgent >nul 2>&1
if not errorlevel 1 (
    echo Updating existing agent service...
    net stop AIPredictiveAPMAgent >nul 2>&1
    if exist "%AGENT_EXE%" (
        "%AGENT_EXE%" remove >nul 2>&1
    ) else (
        sc.exe delete AIPredictiveAPMAgent >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
)

if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%"
    if errorlevel 1 goto :install_error
)

echo Installing files to "%INSTALL_DIR%"...
copy /Y "%~dp0AI-Predictive-APM-Agent.exe" "%AGENT_EXE%" >nul
if errorlevel 1 goto :install_error
copy /Y "%~dp0config.json" "%INSTALL_DIR%\config.json" >nul
if errorlevel 1 goto :install_error

echo Registering the Windows service...
pushd "%INSTALL_DIR%"
"%AGENT_EXE%" install
if errorlevel 1 (
    popd
    goto :install_error
)
popd

echo Configuring automatic startup and crash recovery...
sc.exe config AIPredictiveAPMAgent start= auto >nul
if errorlevel 1 goto :install_error
sc.exe description AIPredictiveAPMAgent "AI-Powered Predictive APM Host Monitoring Agent" >nul
if errorlevel 1 goto :install_error
sc.exe failure AIPredictiveAPMAgent reset= 86400 actions= restart/5000/restart/15000/restart/60000 >nul
if errorlevel 1 goto :install_error
sc.exe failureflag AIPredictiveAPMAgent 1 >nul
if errorlevel 1 goto :install_error

echo Starting and verifying the agent service...
net start AIPredictiveAPMAgent
if errorlevel 1 goto :start_error
sc.exe query AIPredictiveAPMAgent | findstr /I "RUNNING" >nul
if errorlevel 1 goto :start_error

echo.
echo Installation complete. The agent is running and will start automatically
echo after every Windows restart, even when nobody signs in.
echo Service: AIPredictiveAPMAgent
echo Install folder: %INSTALL_DIR%
echo.
pause
exit /b 0

:start_error
echo.
echo ERROR: The service was installed for automatic startup but did not start.
echo Check Windows Event Viewer and the service installation folder for details.
sc.exe query AIPredictiveAPMAgent
pause
exit /b 1

:install_error
echo.
echo ERROR: Agent installation failed. See the message above and retry as Administrator.
pause
exit /b 1
