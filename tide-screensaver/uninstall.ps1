# Uninstalls the Itchenor Tide screensaver: removes shortcuts, the
# registry entry under "Apps & Features", and the installed files.
# This script is copied into the install folder by install.ps1 and is
# what "Apps & Features" -> Uninstall actually runs.

$AppName = "Itchenor Tide"
$RegKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\ItchenorTideScreensaver"
$InstallDir = $PSScriptRoot

Write-Host "Removing $AppName..."

# Stop the local server if it's running.
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine.Contains("$InstallDir\serve.ps1") } |
  ForEach-Object {
    try { Stop-Process -Id $_.ProcessId -Force -Confirm:$false -ErrorAction SilentlyContinue } catch {}
  }

# Remove shortcuts. Resolved through the Shell API rather than assumed
# %USERPROFILE%\Desktop-style paths, since those can be wrong if OneDrive
# "Known Folder Move" (or similar redirection) has relocated them.
$shell = New-Object -ComObject WScript.Shell
$shortcuts = @(
  (Join-Path $shell.SpecialFolders("Programs") "$AppName.lnk"),
  (Join-Path $shell.SpecialFolders("Desktop") "$AppName.lnk"),
  (Join-Path $shell.SpecialFolders("Startup") "$AppName.lnk")
)
foreach ($s in $shortcuts) {
  if (Test-Path $s) { Remove-Item $s -Force -ErrorAction SilentlyContinue }
}

# Remove the "Apps & Features" entry.
if (Test-Path $RegKey) {
  Remove-Item $RegKey -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Removed shortcuts and registry entry."
Write-Host "Deleting installed files from $InstallDir..."

# Delete the install folder itself. This script is running from inside
# that folder, so the deletion has to happen after this process exits -
# hand it off to a detached helper that waits a moment first.
$helper = "timeout /t 2 /nobreak >nul & rmdir /s /q `"$InstallDir`""
Start-Process cmd.exe -ArgumentList "/c", $helper -WindowStyle Hidden

Write-Host "$AppName has been uninstalled."
