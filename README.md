# URL_shortener_Userscript

Extension Firefox URL Shortener Hub.

## Fonctions

- Petite icone dans la barre d'adresse (page action).
- Raccourcissement automatique des URL: services payants d'abord, puis gratuits.
- Mode auto (interrupteur dans le popup): au prochain clic, l'URL active est raccourcie automatiquement.
- Generation d'un QR code de l'URL originale.
- Onglet Historique dans le popup avec:
  - URL d'origine
  - URL raccourcie
  - favicon du site
  - miniature screenshot de la page
- Page Options pour:
  - renseigner les APIs necessaires: Bitly, TinyURL, Rebrandly
  - activer/desactiver des services
  - gerer l'ordre de priorite (haut/bas)

## Services

- Payants: Bitly, TinyURL, Rebrandly
- Gratuits: is.gd, v.gd

Si un service payant n'a pas de token configure, il est ignore automatiquement.

## Liens API

- Bitly: <https://dev.bitly.com/>
- TinyURL: <https://tinyurl.com/app/dev>
- Rebrandly: <https://developers.rebrandly.com/>

## Sources d'icones

- Simple Icons: <https://simpleicons.org/>
- Tabler Icons: <https://tabler-icons.io/>

## Installation (temporaire)

1. Ouvre `about:debugging#/runtime/this-firefox`.
2. Clique **Charger un module complementaire temporaire**.
3. Selectionne `firefox-extension/manifest.json`.
