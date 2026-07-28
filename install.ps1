# Installs the Itchenor Tide screensaver for the current user.
# No admin rights, no external tools - copies the app into your user
# profile, adds Start Menu / Desktop shortcuts, registers a proper
# uninstaller under "Apps & Features", and (by default) starts it
# automatically at login.
param(
  [switch]$AddToStartup = $true,
  [switch]$NoDesktopShortcut = $false,
  [string]$InstallDir = (Join-Path $env:LOCALAPPDATA "Programs\ItchenorTide")
)

$ErrorActionPreference = "Stop"

$AppName = "Itchenor Tide"
$AppVersion = "1.0.0"
$SourceDir = $PSScriptRoot
$LauncherPath = Join-Path $InstallDir "start-kiosk.bat"
$RegKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\ItchenorTideScreensaver"

Write-Host "Installing $AppName to $InstallDir ..."

if (Test-Path $InstallDir) {
  Write-Host "An existing install was found - updating it in place."
  Get-ChildItem $InstallDir -Recurse -File | Remove-Item -Force -ErrorAction SilentlyContinue
} else {
  New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

Copy-Item -Path (Join-Path $SourceDir "*") -Destination $InstallDir -Recurse -Force -Exclude @(".git")

# Resolve real special-folder paths through the Shell API rather than
# assuming %USERPROFILE%\Desktop etc. - those can be wrong if OneDrive
# "Known Folder Move" (or similar redirection) has relocated them.
$shell = New-Object -ComObject WScript.Shell

function New-AppShortcut {
  param([string]$Path)
  $shortcut = $shell.CreateShortcut($Path)
  $shortcut.TargetPath = $LauncherPath
  $shortcut.WorkingDirectory = $InstallDir
  $shortcut.Description = "Itchenor Tide - live tide bridge display"
  $shortcut.WindowStyle = 7  # minimized, so the console flash is less visible
  $shortcut.Save()
}

$startMenuDir = $shell.SpecialFolders("Programs")
New-Item -ItemType Directory -Path $startMenuDir -Force -ErrorAction SilentlyContinue | Out-Null
New-AppShortcut -Path (Join-Path $startMenuDir "$AppName.lnk")
Write-Host "Start Menu shortcut created."

if (-not $NoDesktopShortcut) {
  $desktopDir = $shell.SpecialFolders("Desktop")
  New-Item -ItemType Directory -Path $desktopDir -Force -ErrorAction SilentlyContinue | Out-Null
  New-AppShortcut -Path (Join-Path $desktopDir "$AppName.lnk")
  Write-Host "Desktop shortcut created."
}

if ($AddToStartup) {
  $startupDir = $shell.SpecialFolders("Startup")
  New-Item -ItemType Directory -Path $startupDir -Force -ErrorAction SilentlyContinue | Out-Null
  New-AppShortcut -Path (Join-Path $startupDir "$AppName.lnk")
  Write-Host "Will now launch automatically at login."
}

$installSizeKb = [math]::Round(((Get-ChildItem $InstallDir -Recurse -File | Measure-Object -Property Length -Sum).Sum) / 1KB)

New-Item -Path $RegKey -Force | Out-Null
Set-ItemProperty -Path $RegKey -Name "DisplayName" -Value "$AppName Screensaver"
Set-ItemProperty -Path $RegKey -Name "UninstallString" -Value "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$InstallDir\uninstall.ps1`""
Set-ItemProperty -Path $RegKey -Name "Publisher" -Value "Itchenor Tide"
Set-ItemProperty -Path $RegKey -Name "DisplayVersion" -Value $AppVersion
Set-ItemProperty -Path $RegKey -Name "InstallLocation" -Value $InstallDir
Set-ItemProperty -Path $RegKey -Name "EstimatedSize" -Value $installSizeKb -Type DWord
Set-ItemProperty -Path $RegKey -Name "NoModify" -Value 1 -Type DWord
Set-ItemProperty -Path $RegKey -Name "NoRepair" -Value 1 -Type DWord

Write-Host ""
Write-Host "$AppName installed."
Write-Host "It will now appear in Settings > Apps > Installed apps, with a working Uninstall button."
Write-Host "Launch it any time from the Start Menu or Desktop shortcut."
if ($AddToStartup) {
  Write-Host "It's also set to start automatically next time you log in."
}
Write-Host ""
Write-Host "Reminder: js\config.js inside the installed copy holds your WorldTides API key."
