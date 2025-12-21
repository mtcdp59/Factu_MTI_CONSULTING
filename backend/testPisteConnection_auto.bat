@echo off
REM Script Windows pour automatiser le test de connexion PISTE
REM 1. Installe la dépendance querystring si besoin
REM 2. Lance le script Node.js

cd /d %~dp0

REM Vérifie si node_modules/querystring existe
if not exist node_modules\querystring (
    echo Installation de la dépendance querystring...
    npm install querystring
)

echo Lancement du test de connexion PISTE...
node testPisteConnection.node.js

pause
