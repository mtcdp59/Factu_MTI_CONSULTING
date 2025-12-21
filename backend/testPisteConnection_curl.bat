@echo off
REM Test rapide OAuth2 PISTE avec curl sous Windows
REM Place ce fichier dans backend et double-clique dessus

REM Vérifie si curl est disponible
where curl >nul 2>nul
if errorlevel 1 (
    echo curl n'est pas installe sur ce systeme. Installez-le ou utilisez Git Bash.
    pause
    exit /b
)

set CLIENT_ID=34b37cc5-2c5d-4272-b411-0940742714ec
set CLIENT_SECRET=3af5bad7-5c77-4908-8dbb-ae67e6e82dc2
set OAUTH_URL=https://api.piste.gouv.fr/oauth/token

curl -k -X POST "%OAUTH_URL%" ^
  -H "Content-Type: application/x-www-form-urlencoded" ^
  -H "Accept: application/json" ^
  -d "grant_type=client_credentials&client_id=%CLIENT_ID%&client_secret=%CLIENT_SECRET%&scope=openid"

pause
