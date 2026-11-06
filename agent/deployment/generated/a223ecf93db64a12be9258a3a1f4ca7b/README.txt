AI-Powered Predictive APM Agent
================================

Agent Name:
AI-Predictive-APM-Agent

Operating System:
Windows

Backend URL:
http://127.0.0.1:8001

Collection Interval:
5 seconds


INSTALLATION
============

1. Extract this ZIP file.

2. Right-click:

   install_agent.bat

3. Select:

   Run as administrator.

4. The installer will:

   - Copy the monitoring agent
   - Install the Windows service
   - Configure automatic startup
   - Configure service restart after failure
   - Start the monitoring agent


WINDOWS SERVICE
===============

Service Name:

AIPredictiveAPMAgent

Startup:

Automatic at Windows startup, even when nobody signs in.


VERIFY AGENT
============

Open:

http://127.0.0.1:8001/agent/status

The agent should appear as:

ONLINE


UNINSTALLATION
==============

Run:

uninstall_agent.bat

as Administrator.


IMPORTANT
=========

The backend URL must be reachable from
the machine where the monitoring agent
is installed.

Do NOT use:

http://127.0.0.1:8001

when the agent is installed on another
computer.

For remote machines use the backend's
LAN IP address or DNS hostname.