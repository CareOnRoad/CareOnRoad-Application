import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

// Windows native process control, restricted to the Next worker under the API
// CLI created by this runner. No arbitrary PID input or machine-wide action.
export function controlOwnedApi({apiPid,runnerPid,port,action,workerPid}){
  for(const value of [apiPid,runnerPid,port])assert.ok(Number.isInteger(value)&&value>0);
  assert.ok(['pause','resume'].includes(action));if(workerPid!==undefined)assert.ok(Number.isInteger(workerPid)&&workerPid>0);
  const script=`
$ErrorActionPreference='Stop'
$taskApi=Get-CimInstance Win32_Process -Filter 'ProcessId=${apiPid}'
if(!$taskApi -or $taskApi.ParentProcessId -ne ${runnerPid} -or $taskApi.CommandLine -notmatch 'next.*dev.*-p ${port}(\\s|$)'){throw 'Owned API CLI identity not proven'}
$taskWorkers=@(Get-CimInstance Win32_Process -Filter 'ParentProcessId=${apiPid}' | Where-Object {$_.CommandLine -match 'start-server\\.js'})
if($taskWorkers.Count -ne 1){throw 'Unique owned Next worker not proven'}
$taskWorker=$taskWorkers[0]
${workerPid===undefined?'':`if($taskWorker.ProcessId -ne ${workerPid}){throw 'Owned worker identity changed'}`}
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class WorkflowOwnedProcess {
  [DllImport("kernel32.dll", SetLastError=true)] public static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
  [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr handle);
  [DllImport("ntdll.dll")] public static extern int NtSuspendProcess(IntPtr handle);
  [DllImport("ntdll.dll")] public static extern int NtResumeProcess(IntPtr handle);
}
'@
$taskHandle=[WorkflowOwnedProcess]::OpenProcess(0x0800,$false,$taskWorker.ProcessId)
if($taskHandle -eq [IntPtr]::Zero){throw 'Cannot open owned Next worker'}
try {
  $taskStatus=[WorkflowOwnedProcess]::${action==='pause'?'NtSuspendProcess':'NtResumeProcess'}($taskHandle)
  if($taskStatus -ne 0){throw 'Owned process control failed'}
} finally {[void][WorkflowOwnedProcess]::CloseHandle($taskHandle)}
@{worker_pid=[int]$taskWorker.ProcessId;parent_pid=${apiPid};action='${action}'} | ConvertTo-Json -Compress
`;
  const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true,timeout:15_000});
  // stderr may contain host paths; emit only a controlled diagnostic.
  assert.equal(result.status,0,'Owned API pause/resume unavailable or identity check failed');
  return JSON.parse(result.stdout.trim());
}
