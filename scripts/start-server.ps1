# MTI CONSULTING - Script de démarrage serveur local
# Ce script démarre un serveur HTTP local pour permettre l'authentification OAuth2 Google

Write-Host "🚀 MTI CONSULTING - Démarrage du serveur local..." -ForegroundColor Cyan
Write-Host ""

# Vérifier si Python est installé
$pythonExists = Get-Command python -ErrorAction SilentlyContinue

if ($pythonExists) {
    Write-Host "✅ Python détecté - Démarrage du serveur sur http://localhost:8000" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Instructions :" -ForegroundColor Yellow
    Write-Host "   1. Le serveur va démarrer dans quelques secondes"
    Write-Host "   2. Ouvrez votre navigateur sur : http://localhost:8000/index.html"
    Write-Host "   3. Appuyez sur CTRL+C pour arrêter le serveur"
    Write-Host ""
    Write-Host "🌐 Ouverture automatique du navigateur dans 3 secondes..." -ForegroundColor Cyan
    Start-Sleep -Seconds 3
    
    # Ouvrir le navigateur
    Start-Process "http://localhost:8000/index.html"
    
    # Démarrer le serveur Python
    python -m http.server 8000
} else {
    Write-Host "❌ Python n'est pas installé sur ce système" -ForegroundColor Red
    Write-Host ""
    Write-Host "📦 Alternatives :" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option 1 - Installer Python :" -ForegroundColor White
    Write-Host "   https://www.python.org/downloads/"
    Write-Host "   Puis relancez ce script"
    Write-Host ""
    Write-Host "Option 2 - Utiliser Node.js (si installé) :" -ForegroundColor White
    Write-Host "   npx http-server -p 8000"
    Write-Host "   Puis : http://localhost:8000/index.html"
    Write-Host ""
    Write-Host "Option 3 - VS Code Live Server :" -ForegroundColor White
    Write-Host "   1. Installer l'extension 'Live Server' dans VS Code"
    Write-Host "   2. Clic droit sur index.html → 'Open with Live Server'"
    Write-Host ""
    
    # Vérifier si Node.js est installé
    $nodeExists = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeExists) {
        Write-Host "✅ Node.js détecté ! Voulez-vous utiliser http-server ? (O/N)" -ForegroundColor Green
        $response = Read-Host
        if ($response -eq "O" -or $response -eq "o") {
            Write-Host "🌐 Démarrage avec Node.js http-server..." -ForegroundColor Cyan
            Start-Sleep -Seconds 2
            Start-Process "http://localhost:8000/index.html"
            npx http-server -p 8000
        }
    }
    
    Read-Host "Appuyez sur Entrée pour quitter"
}
