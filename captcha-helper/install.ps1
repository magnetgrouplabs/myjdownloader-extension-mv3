# MyJDownloader CAPTCHA Helper Installer
# Run with: powershell -ExecutionPolicy Bypass -File install.ps1

param(
    [switch]$Uninstall,
    [switch]$Status
)

$ErrorActionPreference = "Stop"

# Configuration
$InstallDir = "$env:LOCALAPPDATA\MyJDownloader\captcha-helper"
$BinaryName = "myjd-captcha-helper.exe"
$ManifestName = "myjd-native-host.json"
$RegistryKey = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\org.jdownloader.captcha_helper"
$ExtensionID = "fbcohnmimjicjdomonkcbcpbpnhggkip"

function Check-WebView2 {
    # Check for WebView2 runtime version directories
    $webviewPath = "C:\Program Files (x86)\Microsoft\EdgeWebView\Application"
    if (Test-Path $webviewPath) {
        $versions = Get-ChildItem -Path $webviewPath -Directory -ErrorAction SilentlyContinue | 
                    Where-Object { $_.Name -match '^\d+\.\d+\.\d+\.\d+$' }
        if ($versions) { return $true }
    }
    # Also check user install
    $userPath = "$env:LOCALAPPDATA\Microsoft\EdgeWebView\Application"
    if (Test-Path $userPath) {
        $versions = Get-ChildItem -Path $userPath -Directory -ErrorAction SilentlyContinue | 
                    Where-Object { $_.Name -match '^\d+\.\d+\.\d+\.\d+$' }
        if ($versions) { return $true }
    }
    return $false
}

function Get-WebView2Installer {
    Write-Host "Downloading WebView2 Runtime bootstrapper..."
    $url = "https://go.microsoft.com/fwlink/p/?LinkId=2124703"
    $output = "$env:TEMP\MicrosoftEdgeWebview2Setup.exe"
    Invoke-WebRequest -Uri $url -OutFile $output -UseBasicParsing
    return $output
}

if ($Status) {
    Write-Host "MyJDownloader CAPTCHA Helper Status" -ForegroundColor Cyan
    Write-Host "=================================="
    
    $installed = Test-Path $InstallDir
    Write-Host "Installed: $installed"
    
    if ($installed) {
        $binary = Join-Path $InstallDir $BinaryName
        Write-Host "Binary: $binary"
        Write-Host "  Exists: $(Test-Path $binary)"
        
        $manifest = Join-Path $InstallDir $ManifestName
        Write-Host "Manifest: $manifest"
        Write-Host "  Exists: $(Test-Path $manifest)"
    }
    
    Write-Host "Registry: $RegistryKey"
    Write-Host "  Exists: $(Test-Path $RegistryKey)"
    
    Write-Host "WebView2 Runtime: $(Check-WebView2)"
    exit 0
}

if ($Uninstall) {
    Write-Host "Uninstalling MyJDownloader CAPTCHA Helper..." -ForegroundColor Yellow
    
    # Remove files
    if (Test-Path $InstallDir) {
        Remove-Item -Path $InstallDir -Recurse -Force
        Write-Host "Removed: $InstallDir"
    }
    
    # Remove registry
    if (Test-Path $RegistryKey) {
        Remove-Item -Path $RegistryKey -Force
        Write-Host "Removed: $RegistryKey"
    }
    
    Write-Host ""
    Write-Host "Uninstalled successfully!" -ForegroundColor Green
    exit 0
}

Write-Host ""
Write-Host "MyJDownloader CAPTCHA Helper Installer" -ForegroundColor Cyan
Write-Host "======================================="
Write-Host ""

# Check for WebView2
Write-Host "Checking WebView2 Runtime..." -NoNewline
if (Check-WebView2) {
    Write-Host " Found!" -ForegroundColor Green
} else {
    Write-Host " Not found!" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "WebView2 Runtime is required for CAPTCHA windows." -ForegroundColor Yellow
    Write-Host ""
    $install = Read-Host "Download and install WebView2? (Y/n)"
    if ($install -ne "n" -and $install -ne "N") {
        $installer = Get-WebView2Installer
        Write-Host "Installing WebView2 Runtime..."
        Start-Process -FilePath $installer -Wait
        Remove-Item $installer -Force -ErrorAction SilentlyContinue
        
        if (-not (Check-WebView2)) {
            Write-Host ""
            Write-Host "WebView2 installation may require a restart." -ForegroundColor Yellow
            Write-Host "Please restart your computer and run this installer again."
            exit 1
        }
        Write-Host "WebView2 installed successfully!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "Continuing without WebView2. CAPTCHA windows may not work." -ForegroundColor Yellow
    }
}

Write-Host ""

# Create install directory
Write-Host "Creating installation directory..."
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null

# Copy binary
$BinaryPath = Join-Path $PSScriptRoot $BinaryName
if (Test-Path $BinaryPath) {
    Copy-Item $BinaryPath $InstallDir -Force
    Write-Host "Installed: $(Join-Path $InstallDir $BinaryName)"
} else {
    Write-Error "Binary not found: $BinaryPath"
    Write-Host "Please run 'cargo build --release' first or download the pre-built binary."
    exit 1
}

# Create manifest with correct paths
$InstalledBinaryPath = Join-Path $InstallDir $BinaryName
$ManifestPath = Join-Path $InstallDir $ManifestName
$ManifestContent = @"
{
  "name": "org.jdownloader.captcha_helper",
  "description": "MyJDownloader Captcha Helper",
  "path": "$($InstalledBinaryPath -replace '\\', '\\')",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$ExtensionID/"]
}
"@
[System.IO.File]::WriteAllText($ManifestPath, $ManifestContent, [System.Text.UTF8Encoding]::new($false))
Write-Host "Created: $ManifestPath"

# Create registry entry
New-Item -Path $RegistryKey -Force | Out-Null
Set-ItemProperty -Path $RegistryKey -Name "(Default)" -Value $ManifestPath -Force
Write-Host "Registered: $RegistryKey"

# Copy test files
$TestHtml = Join-Path $PSScriptRoot "test-native-messaging.html"
$TestJs = Join-Path $PSScriptRoot "test-native-messaging.js"
if (Test-Path $TestHtml) { Copy-Item $TestHtml $InstallDir -Force }
if (Test-Path $TestJs) { Copy-Item $TestJs $InstallDir -Force }

Write-Host ""
Write-Host "Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Files installed to: $InstallDir"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Open chrome://extensions/ in Chrome"
Write-Host "2. Enable 'Developer mode' (top right)"
Write-Host "3. Click 'Reload' on the MyJDownloader extension"
Write-Host "4. Test by opening: chrome-extension://$ExtensionID/captcha-helper/test-native-messaging.html"
Write-Host ""
Write-Host "To uninstall: powershell -ExecutionPolicy Bypass -File install.ps1 -Uninstall"
Write-Host ""