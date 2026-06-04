@echo off
echo Syncing frontend source...
scp -r C:\dev\k9sar_frontend\* k9sar:~/k9sar_frontend/frontend-src/
if errorlevel 1 goto fail
echo Frontend source copied successfully.
goto end

:fail
echo scp copy failed.
exit /b 1

:end