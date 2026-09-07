@echo off
setlocal enabledelayedexpansion
title Construction Props - build

echo.
echo  Construction Props - building ConstructionProps.dll
echo  ---------------------------------------------------
echo.

cd /d "%~dp0"

rem ---- 1. find the C# compiler that ships with Windows (no Visual Studio needed) ----
set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
if not exist "%CSC%" (
  echo  [X] Could not find csc.exe ^(the .NET Framework 4 compiler^).
  echo      It normally lives at %WINDIR%\Microsoft.NET\Framework64\v4.0.30319\
  echo      Install the .NET Framework 4.x runtime and run this again.
  goto :fail
)
echo  [1/3] Compiler: %CSC%

rem ---- 2. find ScriptHookVDotNet3.dll ----
set "SHVDN="
for %%P in (
  "%~dp0lib\ScriptHookVDotNet3.dll"
  "%~dp0ScriptHookVDotNet3.dll"
  "C:\Program Files\Rockstar Games\Grand Theft Auto V\ScriptHookVDotNet3.dll"
  "C:\Program Files (x86)\Steam\steamapps\common\Grand Theft Auto V\ScriptHookVDotNet3.dll"
  "C:\Program Files\Steam\steamapps\common\Grand Theft Auto V\ScriptHookVDotNet3.dll"
  "C:\Program Files\Epic Games\GTAV\ScriptHookVDotNet3.dll"
  "D:\Steam\steamapps\common\Grand Theft Auto V\ScriptHookVDotNet3.dll"
  "D:\Program Files\Rockstar Games\Grand Theft Auto V\ScriptHookVDotNet3.dll"
) do (
  if not defined SHVDN if exist %%P set "SHVDN=%%~P"
)

if not defined SHVDN (
  echo.
  echo  [X] Could not find ScriptHookVDotNet3.dll.
  echo.
  echo      Copy it from your GTA V folder ^(it sits next to GTA5.exe^) into:
  echo        %~dp0lib\
  echo      then run this script again.
  goto :fail
)
echo  [2/3] ScriptHookVDotNet3: %SHVDN%

rem ---- 3. compile ----
"%CSC%" /nologo /target:library /optimize+ /out:"ConstructionProps.dll" ^
  /reference:"%SHVDN%" ^
  /reference:"System.dll" /reference:"System.Drawing.dll" /reference:"System.Windows.Forms.dll" ^
  "src\*.cs"

if errorlevel 1 goto :fail
if not exist "ConstructionProps.dll" goto :fail

echo  [3/3] Built: %~dp0ConstructionProps.dll
echo.
echo  ===================================================
echo   Done. Copy ConstructionProps.dll into your
echo   GTA V \scripts\ folder, start the game, press F5.
echo  ===================================================
echo.

rem ---- optional: offer to install it straight into scripts\ ----
for %%D in ("%SHVDN%") do set "GAMEDIR=%%~dpD"
if exist "%GAMEDIR%scripts\" (
  echo  Found %GAMEDIR%scripts\
  set /p INSTALL="  Copy it there now? [y/N] "
  if /i "!INSTALL!"=="y" (
    copy /y "ConstructionProps.dll" "%GAMEDIR%scripts\ConstructionProps.dll" >nul
    if errorlevel 1 (
      echo  [!] Copy failed - try running this as administrator.
    ) else (
      echo  [+] Installed to %GAMEDIR%scripts\ConstructionProps.dll
    )
  )
)

echo.
pause
exit /b 0

:fail
echo.
echo  Build failed.
echo.
pause
exit /b 1
