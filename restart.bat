@echo off
REM Decisium Lopa - Restart Backend & Frontend
REM Script para reiniciar os servidores de desenvolvimento

setlocal enabledelayedexpansion

cls
echo.
echo ========================================
echo  Decisium Lopa - Restart Services
echo ========================================
echo.

REM Change to script directory
cd /d "%~dp0"

echo [1/3] Terminando processos existentes...
echo.

REM Kill Node.js processes (Frontend/Vite)
taskkill /F /IM node.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo  ✓ Processos Node.js encerrados
) else (
    echo  - Nenhum processo Node.js encontrado
)

REM Kill Python processes (Backend)
taskkill /F /IM python.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo  ✓ Processos Python encerrados
) else (
    echo  - Nenhum processo Python encontrado
)

timeout /t 2 /nobreak >nul

echo.
echo [2/3] Iniciando Backend (Uvicorn na porta 8005)...
start "Decisium Backend" cmd /k "npm run dev:backend"

timeout /t 3 /nobreak >nul

echo [3/3] Iniciando Frontend (Vite na porta 3000)...
start "Decisium Frontend" cmd /k "npm run dev"

timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo  ✓ Servidores iniciados com sucesso!
echo ========================================
echo.
echo Backend:  http://localhost:8005
echo Frontend: http://localhost:3000
echo.
echo Feche este cmd para continuar...
echo.

pause

endlocal
