@echo off

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Script not run as admin.. Requesting admin privilages..
    powershell -NoProfile -Command ^
        "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit
)

setlocal EnableDelayedExpansion
title FirePack Installer

echo ----------------------------------------
echo FirePack System installer
echo ----------------------------------------
echo.

set "FFROOT="

if exist "%ProgramFiles%\Mozilla Firefox\firefox.exe" (
    set "FFROOT=%ProgramFiles%\Mozilla Firefox"
)

if not defined FFROOT if exist "%ProgramFiles(x86)%\Mozilla Firefox\firefox.exe" (
    set "FFROOT=%ProgramFiles(x86)%\Mozilla Firefox"
)

if not defined FFROOT (
    echo ERROR: Firefox installation not found.
    pause
    exit
)

echo Firefox detected at:
echo %FFROOT%
echo.

echo Installing config.js...
powershell -NoProfile -Command ^
 "Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/sudoFearlessAdam/FirePack/refs/heads/main/configs/config.js' -OutFile '%FFROOT%\config.js'"

if not exist "%FFROOT%\defaults\pref" (
    mkdir "%FFROOT%\defaults\pref"
)

echo Installing loaderconfig.js...
powershell -NoProfile -Command ^
 "Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/sudoFearlessAdam/FirePack/refs/heads/main/configs/defaults/pref/loaderconfig.js' -OutFile '%FFROOT%\defaults\pref\loaderconfig.js'"

echo configs installed.
echo.

set MOZ_ROOT=%APPDATA%\Mozilla\Firefox
set INI_FILE=%MOZ_ROOT%\profiles.ini

if exist "%INI_FILE%" (
    echo Enabling userChrome.css support in profiles...
    echo.
    echo Do you want to install Betterfox? Betterfox is created by yokoffing and not by me.
    echo Original project link: https://github.com/yokoffing/Betterfox
    set /p INSTALLBF=Y/N ?: 

    for /f "tokens=1,* delims==" %%A in ('findstr /R "^Path=" "%INI_FILE%"') do (
        set PROFILE=%%B
        set FULLPROFILE=%MOZ_ROOT%\!PROFILE!

        if exist "!FULLPROFILE!" (
            echo Processing profile: !FULLPROFILE!

            if /I "!INSTALLBF!"=="Y" (
                echo Downloading Betterfox user.js...
                powershell -NoProfile -Command ^
                 "Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/yokoffing/Betterfox/refs/heads/main/user.js' -OutFile '!FULLPROFILE!\user.js'"

                echo Adding userChrome.css support to Betterfox config...
                echo user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);>> "!FULLPROFILE!\user.js"
            ) else (
                echo Writing user.js for userChrome.css support only...
                echo user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true); > "!FULLPROFILE!\user.js"
            )
        )
    )
)

echo.
echo userChrome.css enabled.
echo.

set "FIREPACKDIR=%ProgramData%\FirePack"
set "ZIPFILE=%TEMP%\corefiles.zip"

if not exist "%FIREPACKDIR%" (
    mkdir "%FIREPACKDIR%"
)

echo Downloading FirePack core files...
powershell -NoProfile -Command ^
 "Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/sudoFearlessAdam/FirePack/raw/refs/heads/main/main/core.zip' -OutFile '%ZIPFILE%'"

if not exist "%ZIPFILE%" (
    echo ERROR: Failed to download core files.
    pause
    exit
)

echo Extracting core files...
powershell -NoProfile -Command ^
 "Expand-Archive -Path '%ZIPFILE%' -DestinationPath '%FIREPACKDIR%' -Force"

if not exist "%FIREPACKDIR%\FirePack_Install.bat" (
    echo ERROR: Extraction failed or FirePack_Install.bat missing.
    pause
    exit
)

del "%ZIPFILE%"

echo Core files installed to:
echo %FIREPACKDIR%
echo.

echo Registering .fpack file association...

assoc .fpack=FirePackFile
ftype FirePackFile="%FIREPACKDIR%\FirePack_Install.bat" "%%1"

cls
echo.
echo .fpack successfully registered.
echo.
cls
echo ----------------------------------------
echo Setup Complete.
echo You can now click on FirePack files (.fpack) to install any pack
echo ----------------------------------------
pause
exit
