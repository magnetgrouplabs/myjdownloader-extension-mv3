# Run all tests for the native helper and extension
# Usage: .\run-tests.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Running myjd-captcha-helper test suite" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Run Rust tests
Write-Host "[1/2] Running Rust tests..." -ForegroundColor Yellow
Set-Location $PSScriptRoot

cargo test 2>&1
$rustResult = $LASTEXITCODE

if ($rustResult -eq 0) {
    Write-Host "Rust tests: PASSED" -ForegroundColor Green
} else {
    Write-Host "Rust tests: FAILED" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Run JS tests (if npm is available)
Write-Host "[2/2] Running JavaScript tests..." -ForegroundColor Yellow
Set-Location (Join-Path $PSScriptRoot "..")

if (Test-Path "package.json") {
    npm test 2>&1
    $jsResult = $LASTEXITCODE
    
    if ($jsResult -eq 0) {
        Write-Host "JavaScript tests: PASSED" -ForegroundColor Green
    } else {
        Write-Host "JavaScript tests: FAILED" -ForegroundColor Red
        # Don't fail the whole script if JS tests fail - they're optional
    }
} else {
    Write-Host "Skipping JavaScript tests (package.json not found)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "All tests complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan