@echo off
setlocal
title AI Predictive APM Agent Installer

if not exist "%~dp0release\install_agent.bat" (
    echo ERROR: Packaged agent installer is missing.
    pause
    exit /b 1
)

call "%~dp0release\install_agent.bat"
exit /b %errorlevel%
