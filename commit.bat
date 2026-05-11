@echo off
set /p MSG="Mensagem do commit: "
if "%MSG%"=="" (
    echo Mensagem nao pode ser vazia.
    pause
    exit /b 1
)
git add .
git commit -m "%MSG%"
git push
echo.
echo Commit e push realizados com sucesso!
pause