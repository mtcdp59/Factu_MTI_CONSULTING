@echo off
chcp 65001 >nul
title MTI CONSULTING - Serveur Local

echo.
echo ═══════════════════════════════════════════════════════════
echo      🚀 MTI CONSULTING - Démarrage du serveur local
echo ═══════════════════════════════════════════════════════════
echo.

REM Vérifier si Python est installé
where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ Python détecté
    echo.
    echo 📋 Le serveur va démarrer sur : http://localhost:8000
    echo 🌐 Ouverture automatique du navigateur...
    echo.
    echo ⚠️  Appuyez sur CTRL+C pour arrêter le serveur
    echo.
    timeout /t 3 /nobreak >nul
    start http://localhost:8000/index.html
    python -m http.server 8000
) else (
    echo ❌ Python n'est pas installé
    echo.
    echo 📦 Solutions alternatives :
    echo.
    echo 1. Installer Python : https://www.python.org/downloads/
    echo 2. Utiliser Node.js : npx http-server -p 8000
    echo 3. VS Code Live Server : Extension "Live Server"
    echo.
    pause
)
