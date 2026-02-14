# URL_shortener_Userscript

Ce dépôt fournit maintenant une **vraie extension Firefox (WebExtension)** pour avoir un bouton dans l’interface du navigateur, utilisable sur toutes les pages web.

## ✅ Ce que fait l’extension

- Ajoute un bouton natif **URL Shortener** dans la barre d’outils Firefox.
- Ouvre un popup quand tu cliques dessus.
- Pré-remplit automatiquement l’URL de l’onglet actif (celle de ta barre d’URL).
- Raccourcit via : **Bitly**, **TinyURL**, **Rebrandly**, **is.gd**, **v.gd**.
- Permet de copier l’URL courte et d’afficher l’URL finale.
- Inclut une page de paramètres pour les clés API + un historique local.

## Dossier extension

- `firefox-extension/manifest.json`
- `firefox-extension/popup/*`
- `firefox-extension/options/*`

## Installation dans Firefox (mode développeur)

1. Ouvre Firefox puis va sur `about:debugging#/runtime/this-firefox`.
2. Clique **Charger un module complémentaire temporaire**.
3. Sélectionne le fichier :
   - `firefox-extension/manifest.json`
4. L’icône de l’extension apparaît dans la barre d’outils.
5. Clique dessus pour raccourcir l’URL de l’onglet actuel.

## Paramètres API

Dans le popup, clique sur ⚙ pour ouvrir la page options, puis renseigne les tokens :

- Bitly token
- TinyURL token
- Rebrandly token
- Domaine Rebrandly (optionnel)

## Notes

- Bitly, TinyURL et Rebrandly nécessitent un token API.
- is.gd et v.gd fonctionnent sans token.
- Le chargement "temporaire" disparaît au redémarrage de Firefox ; pour usage permanent, il faut empaqueter/signer l’extension.
