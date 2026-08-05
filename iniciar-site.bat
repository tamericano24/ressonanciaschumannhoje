@echo off
REM Arranca o site localmente e abre no navegador.
REM Faca duplo clique neste ficheiro.
REM
REM Porque e preciso: abrir o index.html com duplo clique usa o protocolo file://,
REM e os navegadores bloqueiam pedidos a APIs externas nesse modo (CORS).
REM Os numeros ficariam a carregar para sempre. Servido por http:// funciona tudo.

cd /d "%~dp0"
echo.
echo  Site a arrancar em http://localhost:4321
echo  Feche esta janela para parar o servidor.
echo.
start "" http://localhost:4321
python -m http.server 4321
pause
