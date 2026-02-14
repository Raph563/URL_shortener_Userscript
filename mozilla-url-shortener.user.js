// ==UserScript==
// @name         Firefox URL Shortener Hub
// @namespace    https://addons.mozilla.org/
// @version      1.1.0
// @description  Widget type extension pour raccourcir/expanser des URL depuis n'importe quelle page web dans Firefox.
// @author       Codex
// @match        http://*/*
// @match        https://*/*
// @exclude      about:*
// @exclude      moz-extension://*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      api-ssl.bitly.com
// @connect      api.tinyurl.com
// @connect      api.rebrandly.com
// @connect      is.gd
// @connect      v.gd
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEYS = {
    settings: 'ffShortener.settings',
    links: 'ffShortener.links',
    panelOpen: 'ffShortener.panelOpen'
  };

  const DEFAULT_SETTINGS = {
    bitlyToken: '',
    tinyUrlToken: '',
    rebrandlyToken: '',
    rebrandlyDomain: ''
  };

  const SERVICES = {
    bitly: {
      label: 'Bitly',
      needsToken: 'bitlyToken',
      shorten: (url, settings) => apiRequest({ method: 'POST', url: 'https://api-ssl.bitly.com/v4/shorten', headers: { Authorization: `Bearer ${settings.bitlyToken}`, 'Content-Type': 'application/json' }, data: JSON.stringify({ long_url: url }) }).then((res) => parseJson(res).link)
    },
    tinyurl: {
      label: 'TinyURL',
      needsToken: 'tinyUrlToken',
      shorten: (url, settings) => apiRequest({ method: 'POST', url: 'https://api.tinyurl.com/create', headers: { Authorization: `Bearer ${settings.tinyUrlToken}`, 'Content-Type': 'application/json' }, data: JSON.stringify({ url }) }).then((res) => parseJson(res).data.tiny_url)
    },
    rebrandly: {
      label: 'Rebrandly',
      needsToken: 'rebrandlyToken',
      shorten: (url, settings) => apiRequest({ method: 'POST', url: 'https://api.rebrandly.com/v1/links', headers: { apikey: settings.rebrandlyToken, 'Content-Type': 'application/json' }, data: JSON.stringify({ destination: url, domain: settings.rebrandlyDomain ? { fullName: settings.rebrandlyDomain } : undefined }) }).then((res) => {
        const data = parseJson(res);
        return data.shortUrl.startsWith('http') ? data.shortUrl : `https://${data.shortUrl}`;
      })
    },
    isgd: {
      label: 'is.gd',
      shorten: (url) => apiRequest({ method: 'GET', url: `https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}` }).then((res) => res.responseText.trim())
    },
    vgd: {
      label: 'v.gd',
      shorten: (url) => apiRequest({ method: 'GET', url: `https://v.gd/create.php?format=simple&url=${encodeURIComponent(url)}` }).then((res) => res.responseText.trim())
    }
  };

  const state = {
    settings: loadData(STORAGE_KEYS.settings, DEFAULT_SETTINGS),
    links: loadData(STORAGE_KEYS.links, []),
    panelOpen: Boolean(loadData(STORAGE_KEYS.panelOpen, false))
  };

  injectStyles();
  const ui = createUI();
  document.body.appendChild(ui.launcher);
  document.body.appendChild(ui.panel);
  setPanelOpen(state.panelOpen, ui.panel, ui.launcher);
  renderLinks(ui.linksContainer, ui.emptyState);

  function createUI() {
    const launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.className = 'ff-shortener-launcher';
    launcher.title = 'Ouvrir URL Shortener';
    launcher.textContent = '🔗';

    const panel = document.createElement('aside');
    panel.className = 'ff-shortener-widget';

    panel.innerHTML = `
      <header class="ff-shortener-header">
        <strong>Firefox URL Shortener</strong>
        <div>
          <button type="button" class="ff-shortener-btn" data-action="toggle-list">URLs</button>
          <button type="button" class="ff-shortener-btn" data-action="open-settings">⚙</button>
          <button type="button" class="ff-shortener-btn" data-action="hide-panel">✕</button>
        </div>
      </header>
      <label class="ff-shortener-label" for="ff-shortener-url">URL à raccourcir</label>
      <input id="ff-shortener-url" class="ff-shortener-input" type="url" placeholder="https://..." />
      <label class="ff-shortener-label" for="ff-shortener-service">Service</label>
      <select id="ff-shortener-service" class="ff-shortener-select">
        ${Object.entries(SERVICES).map(([key, service]) => `<option value="${key}">${service.label}</option>`).join('')}
      </select>
      <button type="button" class="ff-shortener-primary" data-action="shorten">Raccourcir</button>
      <p class="ff-shortener-message" data-role="message"></p>
      <section class="ff-shortener-list hidden" data-role="list-wrap">
        <h4>Historique</h4>
        <p class="ff-shortener-empty" data-role="empty">Aucun lien raccourci.</p>
        <ul data-role="links"></ul>
      </section>
      <small class="ff-shortener-note">Note: un UserScript ne peut pas ajouter un vrai bouton de barre d'outils Firefox (il faut une WebExtension).</small>
    `;

    const urlInput = panel.querySelector('#ff-shortener-url');
    const serviceSelect = panel.querySelector('#ff-shortener-service');
    const message = panel.querySelector('[data-role="message"]');
    const linksContainer = panel.querySelector('[data-role="links"]');
    const emptyState = panel.querySelector('[data-role="empty"]');
    const listWrap = panel.querySelector('[data-role="list-wrap"]');

    launcher.addEventListener('click', () => {
      setPanelOpen(!state.panelOpen, panel, launcher);
    });

    panel.addEventListener('click', async (event) => {
      const target = event.target.closest('[data-action]');
      const action = target?.dataset.action;
      if (!action) return;

      if (action === 'shorten') {
        await shortenUrl(urlInput.value.trim(), serviceSelect.value, message);
        renderLinks(linksContainer, emptyState);
      }
      if (action === 'toggle-list') listWrap.classList.toggle('hidden');
      if (action === 'open-settings') openSettingsModal();
      if (action === 'hide-panel') setPanelOpen(false, panel, launcher);
      if (action === 'expand') await expandLink(target.dataset.id, message, linksContainer, emptyState);
      if (action === 'copy') {
        await navigator.clipboard.writeText(target.dataset.url || '');
        setMessage(message, 'Lien copié.', 'success');
      }
    });

    return { launcher, panel, linksContainer, emptyState };
  }

  function setPanelOpen(open, panel, launcher) {
    state.panelOpen = open;
    saveData(STORAGE_KEYS.panelOpen, state.panelOpen);
    panel.classList.toggle('hidden', !open);
    launcher.classList.toggle('hidden', open);
  }

  function openSettingsModal() {
    const overlay = document.createElement('div');
    overlay.className = 'ff-shortener-overlay';
    overlay.innerHTML = `
      <div class="ff-shortener-modal" role="dialog" aria-modal="true">
        <h3>Paramètres API</h3>
        <label>Bitly token<input data-key="bitlyToken" class="ff-shortener-input" value="${escapeHtml(state.settings.bitlyToken)}" /></label>
        <label>TinyURL token<input data-key="tinyUrlToken" class="ff-shortener-input" value="${escapeHtml(state.settings.tinyUrlToken)}" /></label>
        <label>Rebrandly token<input data-key="rebrandlyToken" class="ff-shortener-input" value="${escapeHtml(state.settings.rebrandlyToken)}" /></label>
        <label>Domaine Rebrandly (optionnel)<input data-key="rebrandlyDomain" class="ff-shortener-input" placeholder="rebrand.ly" value="${escapeHtml(state.settings.rebrandlyDomain)}" /></label>
        <div class="ff-shortener-modal-actions">
          <button class="ff-shortener-btn" data-action="cancel">Annuler</button>
          <button class="ff-shortener-primary" data-action="save">Enregistrer</button>
        </div>
      </div>
    `;

    overlay.addEventListener('click', (event) => {
      const action = event.target.dataset.action;
      if (event.target === overlay || action === 'cancel') overlay.remove();
      if (action === 'save') {
        overlay.querySelectorAll('[data-key]').forEach((input) => {
          state.settings[input.dataset.key] = input.value.trim();
        });
        saveData(STORAGE_KEYS.settings, state.settings);
        overlay.remove();
      }
    });

    document.body.appendChild(overlay);
  }

  function renderLinks(container, emptyState) {
    container.innerHTML = '';
    emptyState.style.display = state.links.length ? 'none' : 'block';
    state.links.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'ff-shortener-link-item';
      li.innerHTML = `
        <div><strong>${item.service}</strong></div>
        <a href="${item.shortUrl}" target="_blank" rel="noreferrer">${item.shortUrl}</a>
        ${item.expandedUrl ? `<div class="ff-shortener-expanded">URL complète: <a href="${item.expandedUrl}" target="_blank" rel="noreferrer">${item.expandedUrl}</a></div>` : ''}
        <div class="ff-shortener-actions">
          <button class="ff-shortener-btn" data-action="copy" data-url="${item.shortUrl}">Copier</button>
          <button class="ff-shortener-btn" data-action="expand" data-id="${item.id}">Afficher URL</button>
        </div>
      `;
      container.appendChild(li);
    });
  }

  async function shortenUrl(longUrl, serviceKey, messageNode) {
    if (!isValidUrl(longUrl)) return setMessage(messageNode, 'URL invalide.', 'error');
    const service = SERVICES[serviceKey];
    if (!service) return setMessage(messageNode, 'Service inconnu.', 'error');
    if (service.needsToken && !state.settings[service.needsToken]) {
      return setMessage(messageNode, `Ajoute la clé API pour ${service.label} dans les paramètres.`, 'error');
    }

    setMessage(messageNode, 'Raccourcissement en cours...', 'info');
    try {
      const shortUrl = await service.shorten(longUrl, state.settings);
      if (!isValidUrl(shortUrl)) throw new Error('Réponse invalide du service.');
      state.links.unshift({ id: crypto.randomUUID(), service: service.label, longUrl, shortUrl, expandedUrl: '' });
      state.links = state.links.slice(0, 20);
      saveData(STORAGE_KEYS.links, state.links);
      setMessage(messageNode, `URL raccourcie: ${shortUrl}`, 'success');
    } catch (error) {
      setMessage(messageNode, `Erreur: ${error.message}`, 'error');
    }
  }

  async function expandLink(id, messageNode, linksContainer, emptyState) {
    const item = state.links.find((link) => link.id === id);
    if (!item) return setMessage(messageNode, 'Lien introuvable.', 'error');

    setMessage(messageNode, 'Récupération de l\'URL complète...', 'info');
    try {
      const response = await apiRequest({ method: 'GET', url: item.shortUrl, headers: { 'Cache-Control': 'no-cache' } });
      item.expandedUrl = response.finalUrl || item.shortUrl;
      saveData(STORAGE_KEYS.links, state.links);
      renderLinks(linksContainer, emptyState);
      setMessage(messageNode, 'URL complète récupérée.', 'success');
    } catch (error) {
      setMessage(messageNode, `Impossible d\'afficher l'URL complète: ${error.message}`, 'error');
    }
  }

  function apiRequest(options) {
    if (typeof GM_xmlhttpRequest === 'function') {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          ...options,
          onload: (response) => (response.status >= 200 && response.status < 400 ? resolve(response) : reject(new Error(response.responseText || `HTTP ${response.status}`))),
          onerror: () => reject(new Error('Requête réseau bloquée.'))
        });
      });
    }

    return fetch(options.url, { method: options.method, headers: options.headers, body: options.data, redirect: 'follow' }).then(async (response) => {
      const text = await response.text();
      if (!response.ok) throw new Error(text || `HTTP ${response.status}`);
      return { responseText: text, finalUrl: response.url, status: response.status };
    });
  }

  function parseJson(response) {
    try { return JSON.parse(response.responseText); } catch { throw new Error('Réponse JSON invalide.'); }
  }
  function loadData(key, fallback) {
    try {
      if (typeof GM_getValue === 'function') return GM_getValue(key, fallback);
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }
  function saveData(key, value) {
    if (typeof GM_setValue === 'function') return GM_setValue(key, value);
    localStorage.setItem(key, JSON.stringify(value));
  }
  function setMessage(node, text, type) { node.textContent = text; node.dataset.type = type; }
  function isValidUrl(value) {
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol); } catch { return false; }
  }
  function escapeHtml(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function injectStyles() {
    const css = `
      .ff-shortener-launcher {
        position: fixed; top: 18px; right: 18px; z-index: 2147483647;
        width: 42px; height: 42px; border: none; border-radius: 999px;
        background: #ff7139; color: #fff; cursor: pointer; font-size: 18px;
        box-shadow: 0 8px 20px rgba(0,0,0,.2);
      }
      .ff-shortener-widget {
        position: fixed; top: 16px; right: 16px; width: 330px; z-index: 2147483647;
        background: #fff; border: 1px solid #d8d8e2; border-radius: 12px; padding: 12px;
        box-shadow: 0 8px 20px rgba(0,0,0,.12); font-family: system-ui,sans-serif; color: #111;
      }
      .ff-shortener-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
      .ff-shortener-label { display: block; font-size: 12px; margin: 8px 0 4px; }
      .ff-shortener-input,.ff-shortener-select { width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #c8c8d0; box-sizing: border-box; }
      .ff-shortener-primary,.ff-shortener-btn { border: none; border-radius: 8px; padding: 7px 10px; cursor: pointer; margin-top: 8px; }
      .ff-shortener-primary { background: #0060df; color: #fff; width: 100%; }
      .ff-shortener-btn { background: #ebebf0; color: #111; }
      .ff-shortener-message { font-size: 12px; margin: 8px 0; }
      .ff-shortener-message[data-type="error"] { color: #c7001e; }
      .ff-shortener-message[data-type="success"] { color: #006504; }
      .ff-shortener-message[data-type="info"] { color: #4a4f57; }
      .ff-shortener-list ul { margin: 0; padding: 0; list-style: none; max-height: 240px; overflow: auto; }
      .ff-shortener-link-item { padding: 8px; border: 1px solid #ececf2; border-radius: 8px; margin-bottom: 8px; font-size: 12px; }
      .ff-shortener-link-item a { word-break: break-all; }
      .ff-shortener-actions { display: flex; gap: 6px; }
      .ff-shortener-expanded { margin-top: 6px; }
      .ff-shortener-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 2147483647; display: flex; align-items: center; justify-content: center; }
      .ff-shortener-modal { width: min(420px, calc(100vw - 24px)); background: #fff; border-radius: 12px; padding: 14px; }
      .ff-shortener-modal label { display: block; font-size: 13px; margin-bottom: 10px; }
      .ff-shortener-modal-actions { display: flex; justify-content: flex-end; gap: 6px; }
      .ff-shortener-note { color: #5b5f66; display: block; margin-top: 10px; font-size: 11px; }
      .hidden { display: none !important; }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }
})();
