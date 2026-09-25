@REM Minimal Maven wrapper for Windows.
@REM First run downloads Apache Maven from repo.maven.apache.org into
@REM %USERPROFILE%\.m2\wrapper and reuses it from then on. Nothing is installed
@REM system-wide and nothing outside that folder is touched.
@echo off
setlocal

set "MVN_VERSION=3.9.9"
set "WRAPPER_HOME=%USERPROFILE%\.m2\wrapper"
set "MVN_HOME=%WRAPPER_HOME%\apache-maven-%MVN_VERSION%"
set "MVN_URL=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/%MVN_VERSION%/apache-maven-%MVN_VERSION%-bin.zip"

if not exist "%MVN_HOME%\bin\mvn.cmd" (
  echo Maven %MVN_VERSION% not found locally. Downloading once to %WRAPPER_HOME% ...
  if not exist "%WRAPPER_HOME%" mkdir "%WRAPPER_HOME%"
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ErrorActionPreference='Stop';" ^
    "$zip = Join-Path '%WRAPPER_HOME%' 'maven.zip';" ^
    "Invoke-WebRequest -Uri '%MVN_URL%' -OutFile $zip;" ^
    "Expand-Archive -Path $zip -DestinationPath '%WRAPPER_HOME%' -Force;" ^
    "Remove-Item $zip"
  if errorlevel 1 (
    echo.
    echo Could not download Maven. Check your internet connection, or install
    echo Maven manually and use 'mvn' instead of 'mvnw'.
    exit /b 1
  )
)

call "%MVN_HOME%\bin\mvn.cmd" %*
