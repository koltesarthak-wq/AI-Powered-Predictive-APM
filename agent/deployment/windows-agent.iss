; Build with installer.py; deployment values are data files, never script source.
#ifndef RuntimeDir
  #error RuntimeDir is required
#endif
#ifndef DeploymentDir
  #error DeploymentDir is required
#endif

[Setup]
AppId={{AD9136F1-B5D1-42C4-9E66-6476B6056A2E}
AppName=Predictive APM Host Agent
AppVersion=1.1.0
AppPublisher=Predictive APM
DefaultDirName={autopf}\AI-Predictive-APM-Agent
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
WizardStyle=modern
DisableWelcomePage=no
InfoBeforeFile={#DeploymentDir}\connection.txt
Compression=lzma2/fast
SolidCompression=yes
SetupLogging=yes
CloseApplications=no
RestartApplications=no
UninstallDisplayName=Predictive APM Host Agent
UninstallDisplayIcon={app}\AI-Predictive-APM-Agent.exe
SetupMutex=PredictiveAPMHostAgentSetup
OutputBaseFilename=Predictive-APM-Agent-Setup

[Files]
Source: "{#RuntimeDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#DeploymentDir}\config.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#DeploymentDir}\connection.txt"; DestDir: "{app}"; Flags: ignoreversion

[Messages]
WelcomeLabel2=Install the Predictive APM host monitoring service on this computer.%n%nIt sends host metrics to your configured APM backend and starts automatically with Windows.
FinishedLabel=The Predictive APM service is running and will start automatically with Windows.%n%nOpen Application Monitoring in your APM website. Host readings appear when the agent can reach the configured backend. Logs are in ProgramData\PredictiveAPM\logs.

[Code]
const
  ServiceName = 'AIPredictiveAPMAgent';
  ServiceRegistryKey = 'SYSTEM\CurrentControlSet\Services\AIPredictiveAPMAgent';
type
  TServiceStatus = record
    ServiceType, CurrentState, ControlsAccepted, Win32ExitCode,
    ServiceSpecificExitCode, CheckPoint, WaitHint: Cardinal;
  end;

function OpenSCManager(MachineName, DatabaseName: String; Access: Cardinal): THandle;
  external 'OpenSCManagerW@advapi32.dll stdcall';
function OpenService(Manager: THandle; Name: String; Access: Cardinal): THandle;
  external 'OpenServiceW@advapi32.dll stdcall';
function QueryServiceStatus(Service: THandle; var Status: TServiceStatus): Boolean;
  external 'QueryServiceStatus@advapi32.dll stdcall';
function CloseServiceHandle(Handle: THandle): Boolean;
  external 'CloseServiceHandle@advapi32.dll stdcall';

function ServiceExists: Boolean;
begin
  Result := RegKeyExists(HKLM, ServiceRegistryKey);
end;

function ServiceState: Cardinal;
var Manager, Service: THandle; Status: TServiceStatus;
begin
  Result := 0;
  if not ServiceExists then exit;
  Manager := OpenSCManager('', 'ServicesActive', 1);
  if Manager = 0 then RaiseException('Cannot access Windows Service Manager.');
  try
    Service := OpenService(Manager, ServiceName, 4);
    if Service = 0 then RaiseException('Cannot open the APM service. Close Services and try again.');
    try
      if not QueryServiceStatus(Service, Status) then RaiseException('Cannot read APM service status.');
      Result := Status.CurrentState;
    finally
      CloseServiceHandle(Service);
    end;
  finally
    CloseServiceHandle(Manager);
  end;
end;

function RunSC(Arguments: String): Boolean;
var ExitCode: Integer;
begin
  Log('sc.exe ' + Arguments);
  Result := Exec(ExpandConstant('{sys}\sc.exe'), Arguments, '', SW_HIDE,
                 ewWaitUntilTerminated, ExitCode);
  Result := Result and (ExitCode = 0);
end;

procedure RequireSC(Arguments: String);
begin
  if not RunSC(Arguments) then
    RaiseException('Windows could not configure the APM service. See the Setup log: ' + Arguments);
end;

function WaitForState(Expected: Cardinal): Boolean;
var Attempt: Integer;
begin
  Result := False;
  for Attempt := 1 to 90 do begin
    if ServiceState = Expected then begin Result := True; exit; end;
    Sleep(500);
  end;
end;

procedure StopAgent;
begin
  if not ServiceExists then exit;
  if ServiceState <> 1 then begin
    RunSC('stop ' + ServiceName);
    if not WaitForState(1) then
      RaiseException('The existing APM service did not stop within 45 seconds. Setup has not replaced its files.');
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := '';
  try StopAgent; except Result := GetExceptionMessage; end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var Created: Boolean; BinaryPath, FailureMessage: String;
begin
  if CurStep <> ssPostInstall then exit;
  Created := not ServiceExists;
  BinaryPath := '"\"' + ExpandConstant('{app}\AI-Predictive-APM-Agent.exe') + '\""';
  try
    if Created then
      RequireSC('create ' + ServiceName + ' binPath= ' + BinaryPath +
        ' start= auto DisplayName= "Predictive APM Host Agent"')
    else
      RequireSC('config ' + ServiceName + ' binPath= ' + BinaryPath + ' start= auto');
    RequireSC('description ' + ServiceName + ' "Sends host metrics to your Predictive APM backend."');
    RequireSC('failure ' + ServiceName + ' reset= 86400 actions= restart/5000/restart/15000/restart/60000');
    RequireSC('failureflag ' + ServiceName + ' 1');
    RequireSC('start ' + ServiceName);
    if not WaitForState(4) then RaiseException('The agent service did not reach RUNNING. Check ProgramData\PredictiveAPM\logs and the Windows Event Viewer.');
  except
    FailureMessage := GetExceptionMessage;
    if Created then begin
      RunSC('stop ' + ServiceName);
      RunSC('delete ' + ServiceName);
    end;
    RaiseException(FailureMessage);
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  { Only change the service after the user confirms removal. }
  if CurUninstallStep <> usUninstall then exit;
  StopAgent;
  if ServiceExists then begin
    RequireSC('delete ' + ServiceName);
    if not WaitForState(0) then RaiseException('Close the Windows Services window and retry removal.');
  end;
end;
