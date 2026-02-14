# URL_shortener_Userscript

Le projet fournit maintenant une **WebExtension Firefox** qui affiche un **petit icône dans la barre d’URL** (page action) sur les pages `http(s)`.

## Fonctionnalités

- Petit icône directement dans la barre d’URL Firefox.
- Clic sur l’icône → popup de raccourcissement.
- Pré-remplissage automatique avec l’URL de l’onglet actif.
- Services : **Bitly**, **TinyURL**, **Rebrandly**, **is.gd**, **v.gd**.
- Copie rapide du lien + affichage de l’URL finale.
- Page paramètres pour tokens API + historique local.
- Section de liens API et ressources d’icônes pour développeurs.

## Structure

- `firefox-extension/manifest.json`
- `firefox-extension/background.js`
- `firefox-extension/popup/*`
- `firefox-extension/options/*`
- `firefox-extension/icons/*`

## Installation dans Firefox

1. Ouvre `about:debugging#/runtime/this-firefox`.
2. Clique **Charger un module complémentaire temporaire**.
3. Sélectionne `firefox-extension/manifest.json`.
4. Ouvre n’importe quel site web (`http`/`https`), puis utilise le petit icône dans la barre d’URL.

## Liens pour récupérer les API

- Bitly : https://dev.bitly.com/
- TinyURL : https://tinyurl.com/app/dev
- Rebrandly : https://developers.rebrandly.com/docs
- is.gd API : https://is.gd/apishorteningreference.php
- v.gd API : https://v.gd/apishorteningreference.php

## Sites d’icônes pour développeurs

- Google Material Icons : https://fonts.google.com/icons
- Heroicons : https://heroicons.com/
- Font Awesome : https://fontawesome.com/icons
- Tabler Icons : https://tabler.io/icons

Tu peux remplacer les icônes par défaut dans `firefox-extension/icons/`, puis ajuster les chemins dans `manifest.json`.

## Notes

- Bitly, TinyURL et Rebrandly nécessitent un token.
- `is.gd` et `v.gd` fonctionnent sans token.
- En mode temporaire (`about:debugging`), l’extension doit être rechargée après redémarrage de Firefox.
