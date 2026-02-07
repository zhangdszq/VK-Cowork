# VK Cowork CLI Bundle Script for Windows
# Bundles Claude Code CLI with Node.js runtime for isolated execution

param(
    [string]$Target = "windows"
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

Set-Location $ProjectRoot

function Write-Info { param([string]$Message) Write-Host "[INFO] $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Error { param([string]$Message) Write-Host "[ERROR] $Message" -ForegroundColor Red }

# Target configuration
switch ($Target) {
    "windows" {
        $NodePlatform = "win"
        $NodeArch = "x64"
        $TargetTriple = "x86_64-pc-windows-msvc"
    }
    default {
        Write-Error "Unknown target: $Target"
        Write-Host "Usage: bundle-cli.ps1 [windows]"
        exit 1
    }
}

Write-Info "Bundling Claude Code CLI for $Target ($TargetTriple)"

# Output directory
$OutputDir = Join-Path $ProjectRoot "cli-bundle"
if (Test-Path $OutputDir) {
    Remove-Item -Recurse -Force $OutputDir
}
New-Item -ItemType Directory -Path $OutputDir | Out-Null

# Node.js version
$NodeVersion = "22.2.0"
$NodeFilename = "node-v$NodeVersion-$NodePlatform-$NodeArch"
$NodeUrl = "https://nodejs.org/dist/v$NodeVersion/$NodeFilename.zip"

# Cache directory
$CacheDir = Join-Path $env:USERPROFILE ".vk-cowork\cache"
$CachedNodeDir = Join-Path $CacheDir $NodeFilename
$CachedNode = Join-Path $CachedNodeDir "node.exe"

if (-not (Test-Path $CacheDir)) {
    New-Item -ItemType Directory -Path $CacheDir -Force | Out-Null
}

# Download or use cached Node.js
if (Test-Path $CachedNode) {
    Write-Info "Using cached Node.js v$NodeVersion"
    Copy-Item $CachedNode (Join-Path $OutputDir "node.exe")
} else {
    Write-Info "Downloading Node.js v$NodeVersion for $NodePlatform-$NodeArch..."
    
    $TempDir = Join-Path $env:TEMP "node-download-$(Get-Random)"
    New-Item -ItemType Directory -Path $TempDir | Out-Null
    
    try {
        $ZipPath = Join-Path $TempDir "node.zip"
        Invoke-WebRequest -Uri $NodeUrl -OutFile $ZipPath -UseBasicParsing
        
        Expand-Archive -Path $ZipPath -DestinationPath $TempDir
        
        $NodeExe = Join-Path $TempDir "$NodeFilename\node.exe"
        Copy-Item $NodeExe (Join-Path $OutputDir "node.exe")
        
        # Cache it
        if (-not (Test-Path $CachedNodeDir)) {
            New-Item -ItemType Directory -Path $CachedNodeDir -Force | Out-Null
        }
        Copy-Item $NodeExe $CachedNode
        Write-Info "Node.js cached at $CachedNodeDir"
    }
    catch {
        Write-Warn "Failed to download Node.js: $_"
        Write-Warn "Trying local node..."
        
        $LocalNode = Get-Command node -ErrorAction SilentlyContinue
        if ($LocalNode) {
            Copy-Item $LocalNode.Source (Join-Path $OutputDir "node.exe")
        } else {
            Write-Error "Node.js not available"
            exit 1
        }
    }
    finally {
        if (Test-Path $TempDir) {
            Remove-Item -Recurse -Force $TempDir
        }
    }
}

# Verify Node.js binary
$NodeExePath = Join-Path $OutputDir "node.exe"
if (-not (Test-Path $NodeExePath)) {
    Write-Error "Node.js binary not found"
    exit 1
}

Write-Info "Node.js binary ready"

# Install Claude Code CLI
Set-Location $OutputDir
'{"name":"cli-bundle","private":true,"type":"module"}' | Out-File -FilePath "package.json" -Encoding utf8

Write-Info "Installing @anthropic-ai/claude-code..."

$NpmRegistry = if ($env:NPM_REGISTRY) { $env:NPM_REGISTRY } else { "https://registry.npmjs.org" }
& npm install "@anthropic-ai/claude-code" --registry=$NpmRegistry

# Verify installation
$CliJs = Join-Path $OutputDir "node_modules\@anthropic-ai\claude-code\cli.js"
if (-not (Test-Path $CliJs)) {
    Write-Error "Claude Code installation failed"
    exit 1
}

Write-Info "Claude Code CLI installed successfully"

# Clean up unused platform-specific binaries to reduce size
Write-Info "Cleaning up unused platform binaries..."

$ClaudeKeep = "x64-win32"

# Clean ripgrep vendor directory
$RgVendor = Join-Path $OutputDir "node_modules\@anthropic-ai\claude-code\vendor\ripgrep"
if (Test-Path $RgVendor) {
    Write-Info "Cleaning vendor/ripgrep (keeping $ClaudeKeep)..."
    Get-ChildItem -Path $RgVendor -Directory | ForEach-Object {
        if ($_.Name -ne $ClaudeKeep) {
            Remove-Item -Recurse -Force $_.FullName
            Write-Info "  Removed ripgrep/$($_.Name)"
        }
    }
}

Write-Info "Platform cleanup completed"

# Copy .wasm files to bundle root if needed
Get-ChildItem -Path (Join-Path $OutputDir "node_modules\@anthropic-ai\claude-code") -Filter "*.wasm" -ErrorAction SilentlyContinue | ForEach-Object {
    Copy-Item $_.FullName $OutputDir
}

Set-Location $ProjectRoot

# Create launcher script (claude.cmd)
Write-Info "Creating launcher script..."

$CmdContent = @'
@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
"%SCRIPT_DIR%node.exe" "%SCRIPT_DIR%node_modules\@anthropic-ai\claude-code\cli.js" %*
'@
$CmdContent | Out-File -FilePath (Join-Path $OutputDir "claude.cmd") -Encoding ascii

# Create target-specific launcher
Copy-Item (Join-Path $OutputDir "claude.cmd") (Join-Path $OutputDir "claude-$TargetTriple.cmd")
Write-Info "Created launcher: claude-$TargetTriple.cmd"

# Create claude.mjs for SDK compatibility (SDK uses node to execute .mjs files)
Write-Info "Creating claude.mjs for SDK compatibility..."
$MjsContent = @'
#!/usr/bin/env node
// Wrapper script for Claude Code CLI
// This file exists so the SDK will use node to execute it
import './node_modules/@anthropic-ai/claude-code/cli.js';
'@
$MjsContent | Out-File -FilePath (Join-Path $OutputDir "claude.mjs") -Encoding utf8
Write-Info "Created claude.mjs"

# Report bundle size
$BundleSize = (Get-ChildItem -Path $OutputDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Info "CLI bundle completed!"
Write-Info ("Bundle size: {0:N2} MB" -f $BundleSize)
Write-Info "Output: $OutputDir"
