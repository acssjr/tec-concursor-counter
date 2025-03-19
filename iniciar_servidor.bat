@echo off
echo Iniciando o servidor do Contador de Questoes...
echo.
echo Abra seu navegador e acesse http://localhost:5000/
echo.
echo Para interromper o servidor, pressione Ctrl+C nesta janela e depois S para confirmar
echo.
cd /d "%~dp0"
python app.py
pause
