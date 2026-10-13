@echo off
chcp 65001 >nul
title Corpsman - локальный просмотр
cd /d "%~dp0"

set PORT=8000
echo.
echo  Corpsman: локальный просмотр сайта
echo  Папка: %CD%
echo  Адрес: http://localhost:%PORT%/
echo  Чтобы остановить сервер, закройте это окно или нажмите Ctrl+C.
echo.

rem Открываем браузер через пару секунд, когда сервер уже запустится
start "" /b cmd /c "timeout /t 2 >nul & start http://localhost:%PORT%/"

where py >nul 2>nul
if %errorlevel%==0 (
  py -3 -m http.server %PORT% --bind 127.0.0.1
  goto end
)

where python >nul 2>nul
if %errorlevel%==0 (
  python -c "import sys; sys.exit(0 if sys.version_info[0]==3 else 1)" >nul 2>nul
  if not errorlevel 1 (
    python -m http.server %PORT% --bind 127.0.0.1
    goto end
  )
)

echo  Python не найден, запускаю встроенный сервер PowerShell...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\local-server.ps1" -Port %PORT% -Root "%CD%"

:end
echo.
echo  Сервер остановлен.
pause
