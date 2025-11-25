# Script de déploiement automatique de la configuration vers GitHub Pages
# Usage: .\scripts\deploy-config.ps1

$ErrorActionPreference = "Stop"

Write-Host "🚀 Déploiement de la configuration MTI CONSULTING" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier que config.js existe
if (-not (Test-Path "config.js")) {
    Write-Host "❌ Erreur: fichier config.js introuvable" -ForegroundColor Red
    Write-Host "   Créez d'abord un fichier config.js à la racine" -ForegroundColor Yellow
    exit 1
}

# Lire le contenu de config.js
Write-Host "📖 Lecture de config.js..." -ForegroundColor Yellow
$configContent = Get-Content "config.js" -Raw

# Parser le JSON (extraction simplifiée)
$backendUrl = if ($configContent -match "BACKEND_URL:\s*'([^']+)'") { $matches[1] } else { "" }
$clientId = if ($configContent -match "GOOGLE_CLIENT_ID:\s*'([^']+)'") { $matches[1] } else { "" }
$clientSecret = if ($configContent -match "GOOGLE_CLIENT_SECRET:\s*'([^']+)'") { $matches[1] } else { "" }

if (-not $backendUrl -or -not $clientId -or -not $clientSecret) {
    Write-Host "❌ Erreur: config.js invalide ou incomplet" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Configuration chargée:" -ForegroundColor Green
Write-Host "   Backend URL: $backendUrl" -ForegroundColor Gray
Write-Host "   Client ID: $clientId" -ForegroundColor Gray
Write-Host "   Client Secret: $($clientSecret.Substring(0,10))..." -ForegroundColor Gray
Write-Host ""

# Créer l'objet JSON
$configJson = @{
    BACKEND_URL = $backendUrl
    GOOGLE_CLIENT_ID = $clientId
    GOOGLE_CLIENT_SECRET = $clientSecret
} | ConvertTo-Json -Compress

# Encoder pour URL
$configEncoded = [System.Uri]::EscapeDataString($configJson)

# Construire l'URL GitHub Pages
$githubPagesUrl = "https://mtcdp59.github.io/Factu_MTI_CONSULTING/?autoconfig=$configEncoded"

Write-Host "🌐 Ouverture de GitHub Pages avec configuration..." -ForegroundColor Cyan
Write-Host ""

# Ouvrir dans le navigateur par défaut
Start-Process $githubPagesUrl

Write-Host "✅ Configuration déployée !" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Actions à effectuer dans le navigateur:" -ForegroundColor Yellow
Write-Host "   1. Vérifiez le message de confirmation" -ForegroundColor White
Write-Host "   2. Rechargez la page (F5)" -ForegroundColor White
Write-Host "   3. Testez la connexion au backend" -ForegroundColor White
Write-Host ""
Write-Host "✨ Terminé !" -ForegroundColor Green
