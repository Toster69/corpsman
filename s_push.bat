@echo off
chcp 65001 >nul
cd /d "%~dp0"
set /p msg=Что изменилось? 
git pull
git add .
git commit -m "%msg%"
git push
pause