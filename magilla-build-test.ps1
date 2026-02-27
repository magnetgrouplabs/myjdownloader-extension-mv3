# Build and register native messaging host
$RepoRoot = "C:\Users\anthony\jdownloader-extension-manifestv3"
$HelperRoot = Join-Path $RepoRoot "captcha-helper"
$BinaryPath = Join-Path $HelperRoot "target\release\myjd-captcha-helper.exe"
$ManifestPath = Join-Path $HelperRoot "myjd-native-host.json"
$ExtensionID = "fbcohnmimjicjdomonkcbcpbpnhggkip"

Write-Host "Binary: $BinaryPath"
Write-Host "Manifest: $ManifestPath"

# Build
Set-Location $HelperRoot
cargo build --release

# Create manifest
$BinaryPathEscaped = $BinaryPath -replace '\\', '\\'
$manifestContent = @"
{
  "name": "org.jdownloader.captcha_helper",
  "description": "MyJDownloader Captcha Helper",
  "path": "$BinaryPathEscaped",
  "type": "stdio",
  "allowed_origins": [ "chrome-extension://$ExtensionID/" ]
}
"@
[System.IO.File]::WriteAllText($ManifestPath, $manifestContent, [System.Text.UTF8Encoding]::new($false))
Write-Host "Manifest written"

# Register in registry
$RegKey = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\org.jdownloader.captcha_helper"
New-Item -Path $RegKey -Force | Out-Null
Set-ItemProperty -Path $RegKey -Name "(Default)" -Value $ManifestPath -Force
Write-Host "Registry entry created"

# Test
$payload = '{"action":"status"}'
$bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
$lenBytes = [BitConverter]::GetBytes([int]$bytes.Length)
$tempFile = [IO.Path]::GetTempFileName()
[IO.File]::WriteAllBytes($tempFile, $lenBytes + $bytes)
$hostOutput = cmd /c "type `"$tempFile`" | `"$BinaryPath`""
Remove-Item $tempFile -Force
Write-Host "Response: $hostOutput"

# Open test page in Chrome
$testPage = "chrome-extension://$ExtensionID/captcha-helper/test-native-messaging.html"
Start-Process "chrome" $testPage
Write-Host "Done"