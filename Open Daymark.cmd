@echo off
setlocal
cd /d "%~dp0web"
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22 or newer, then open Daymark again.
  pause
  exit /b 1
)
if not exist node_modules\esbuild\package.json (
  call npm.cmd ci
  if errorlevel 1 exit /b 1
)
call npm.cmd run build
if errorlevel 1 exit /b 1
node scripts/open.mjs
if errorlevel 1 pause

