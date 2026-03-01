@echo off
setlocal EnableExtensions EnableDelayedExpansion
title FirePack Installer

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Requesting administrative privileges...
    powershell -NoProfile -Command ^
        "Start-Process -FilePath '%~f0' -ArgumentList '%*' -Verb RunAs -WorkingDirectory '%CD%'"
    exit /b
)

cls
echo ============================================
echo           FirePack Installer
echo ============================================
echo.

tasklist | find /i "firefox.exe" >nul
if %errorlevel%==0 (
    echo ERROR: Firefox is currently running.
    echo Please close Firefox before installing a pack.
    echo.
    pause
    exit /b 1
)

set "PACK=%~1"

if "%PACK%"=="" (
    echo Drag and drop your .fpack file onto this installer.
    echo.
    pause
    exit /b 1
)

if not exist "%PACK%" (
    echo ERROR: Pack file not found.
    pause
    exit /b 1
)

set "TEMPZIP=%TEMP%\firepack_temp.zip"
set "TEMPDIR=%TEMP%\firepack_extract"

if exist "%TEMPDIR%" rmdir /S /Q "%TEMPDIR%"
if exist "%TEMPZIP%" del "%TEMPZIP%"

copy "%PACK%" "%TEMPZIP%" >nul

powershell -NoProfile -Command ^
 "Try { Expand-Archive -Path '%TEMPZIP%' -DestinationPath '%TEMPDIR%' -Force -ErrorAction Stop } Catch { exit 1 }"

if %errorlevel% neq 0 (
    echo ERROR: Failed to extract pack.
    pause
    exit /b 1
)

set "PACKJSON="

for /r "%TEMPDIR%" %%F in (pack.json) do (
    set "PACKJSON=%%F"
)

if not defined PACKJSON (
    echo ERROR: pack.json not found inside pack.
    pause
    exit /b 1
)

for /f "usebackq tokens=*" %%A in (`powershell -NoProfile -Command ^
 "(Get-Content '%PACKJSON%' | ConvertFrom-Json).name"`) do set PACK_NAME=%%A

for /f "usebackq tokens=*" %%A in (`powershell -NoProfile -Command ^
 "(Get-Content '%PACKJSON%' | ConvertFrom-Json).version"`) do set PACK_VERSION=%%A

if "%PACK_NAME%"=="" (
    echo ERROR: Invalid pack.json (missing name).
    pause
    exit /b 1
)

echo ============================================
echo Pack Name   : %PACK_NAME%
echo Version     : %PACK_VERSION%
echo ============================================
echo.

set "MOZ_ROOT=%APPDATA%\Mozilla\Firefox"
set "INI_FILE=%MOZ_ROOT%\profiles.ini"

if not exist "%INI_FILE%" (
    echo ERROR: Firefox profiles.ini not found.
    pause
    exit /b 1
)

set COUNT=0
set DEFAULT_PROFILE=

for /f "usebackq tokens=1,* delims==" %%A in (`findstr /R "^Path= ^Default=" "%INI_FILE%"`) do (

    if "%%A"=="Path" (
        set /a COUNT+=1
        set PROFILE_!COUNT!=%%B
    )

    if "%%A"=="Default" (
        if "%%B"=="1" (
            set DEFAULT_PROFILE=!COUNT!
        )
    )
)

if %COUNT%==0 (
    echo ERROR: No Firefox profiles found.
    pause
    exit /b 1
)

echo Available Profiles:
for /l %%i in (1,1,%COUNT%) do (
    call echo %%i^) %%PROFILE_%%i%%
)

echo.

if defined DEFAULT_PROFILE (
    echo Default profile detected: %DEFAULT_PROFILE%
    set /p CHOICE=Select profile number (ENTER for default): 
    if "!CHOICE!"=="" set CHOICE=%DEFAULT_PROFILE%
) else (
    set /p CHOICE=Select profile number: 
)

if not defined CHOICE goto invalid
if %CHOICE% GTR %COUNT% goto invalid
if %CHOICE% LSS 1 goto invalid

call set SELECTED=%%PROFILE_%CHOICE%%%

set "FFPROFILE=%MOZ_ROOT%\%SELECTED%"
if not exist "%FFPROFILE%" set "FFPROFILE=%SELECTED%"

if not exist "%FFPROFILE%" (
    echo ERROR: Profile folder not found.
    pause
    exit /b 1
)

echo user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true); > "%FFPROFILE%\user.js"

if not exist "%FFPROFILE%\chrome" mkdir "%FFPROFILE%\chrome"
if not exist "%FFPROFILE%\chrome\firepack" mkdir "%FFPROFILE%\chrome\firepack"

set "DEST=%FFPROFILE%\chrome\firepack\%PACK_NAME%"

if exist "%DEST%" (
    echo Existing version detected. Replacing...
    rmdir /S /Q "%DEST%"
)

mkdir "%DEST%"
xcopy "%TEMPDIR%\*" "%DEST%\" /E /I /Y >nul

del "%TEMPZIP%"
rmdir /S /Q "%TEMPDIR%"

echo.
echo ============================================
echo   %PACK_NAME% v%PACK_VERSION% Installed
echo ============================================
echo.
pause
exit /b 0

:invalid
echo Invalid selection.
pause
exit /b 1