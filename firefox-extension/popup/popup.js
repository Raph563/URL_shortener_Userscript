const KEYS = {
  settings: 'ffExt.settings',
  history: 'ffExt.history'
};

const SERVICE_IDS = ['bitly', 'tinyurl', 'rebrandly', 'isgd', 'vgd'];

const DEFAULT_SETTINGS = {
  bitlyToken: '',
  tinyUrlToken: '',
  rebrandlyToken: '',
  rebrandlyDomain: '',
  autoMode: false,
  serviceOrder: SERVICE_IDS.map((id) => ({ id, enabled: true }))
};

const SERVICES = {
  bitly: {
    label: 'Bitly',
    tier: 'paid',
    tokenKey: 'bitlyToken',
    request: async (url, settings) => {
      const response = await fetch('https://api-ssl.bitly.com/v4/shorten', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.bitlyToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ long_url: url })
      });
      const data = await parseJson(response);
      return data.link;
    }
  },
  tinyurl: {
    label: 'TinyURL',
    tier: 'paid',
    tokenKey: 'tinyUrlToken',
    request: async (url, settings) => {
      const response = await fetch('https://api.tinyurl.com/create', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.tinyUrlToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
      });
      const data = await parseJson(response);
      return data.data?.tiny_url;
    }
  },
  rebrandly: {
    label: 'Rebrandly',
    tier: 'paid',
    tokenKey: 'rebrandlyToken',
    request: async (url, settings) => {
      const payload = { destination: url };
      if (settings.rebrandlyDomain) payload.domain = { fullName: settings.rebrandlyDomain };

      const response = await fetch('https://api.rebrandly.com/v1/links', {
        method: 'POST',
        headers: {
          apikey: settings.rebrandlyToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await parseJson(response);
      return data.shortUrl?.startsWith('http') ? data.shortUrl : `https://${data.shortUrl}`;
    }
  },
  isgd: {
    label: 'is.gd',
    tier: 'free',
    request: async (url) => {
      const response = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`);
      return expectText(response);
    }
  },
  vgd: {
    label: 'v.gd',
    tier: 'free',
    request: async (url) => {
      const response = await fetch(`https://v.gd/create.php?format=simple&url=${encodeURIComponent(url)}`);
      return expectText(response);
    }
  }
};

const ui = {
  longUrl: document.getElementById('longUrl'),
  shortUrl: document.getElementById('shortUrl'),
  usedService: document.getElementById('usedService'),
  qrImage: document.getElementById('qrImage'),
  message: document.getElementById('message'),
  resultSection: document.getElementById('resultSection'),
  expandedText: document.getElementById('expandedText'),
  shortenBtn: document.getElementById('shortenBtn'),
  copyBtn: document.getElementById('copyBtn'),
  expandBtn: document.getElementById('expandBtn'),
  openOptions: document.getElementById('openOptions'),
  autoModeToggle: document.getElementById('autoModeToggle'),
  tabShorten: document.getElementById('tabShorten'),
  tabHistory: document.getElementById('tabHistory'),
  shortenPanel: document.getElementById('shortenPanel'),
  historyPanel: document.getElementById('historyPanel'),
  historyList: document.getElementById('historyList')
};

let settingsCache = { ...DEFAULT_SETTINGS };
let autoTriggered = false;

init().catch((error) => setMessage(`Erreur init: ${error.message}`, 'error'));

async function init() {
  settingsCache = await loadSettings();
  ui.autoModeToggle.checked = Boolean(settingsCache.autoMode);

  const tab = await getActiveTab();
  if (tab?.url?.startsWith('http')) {
    ui.longUrl.value = tab.url;
    updateQr(tab.url);
  }

  ui.longUrl.addEventListener('input', () => updateQr(ui.longUrl.value.trim()));
  ui.shortenBtn.addEventListener('click', () => onShorten(false));
  ui.copyBtn.addEventListener('click', onCopy);
  ui.expandBtn.addEventListener('click', onExpand);
  ui.openOptions.addEventListener('click', () => browser.runtime.openOptionsPage());
  ui.autoModeToggle.addEventListener('change', onToggleAutoMode);
  ui.tabShorten.addEventListener('click', () => switchTab('shorten'));
  ui.tabHistory.addEventListener('click', () => switchTab('history'));

  await renderHistory();

  if (settingsCache.autoMode && !autoTriggered) {
    autoTriggered = true;
    await onShorten(true);
  }
}

function switchTab(tab) {
  const showShorten = tab === 'shorten';
  ui.tabShorten.classList.toggle('active', showShorten);
  ui.tabHistory.classList.toggle('active', !showShorten);
  ui.shortenPanel.classList.toggle('active', showShorten);
  ui.historyPanel.classList.toggle('active', !showShorten);
}

async function onToggleAutoMode() {
  settingsCache.autoMode = ui.autoModeToggle.checked;
  await browser.storage.sync.set({ [KEYS.settings]: settingsCache });
  setMessage(`Mode auto ${settingsCache.autoMode ? 'active' : 'desactive'}.`, 'info');
}

async function onShorten(isAuto) {
  const longUrl = ui.longUrl.value.trim();
  if (!isValidUrl(longUrl)) return setMessage('URL invalide.', 'error');

  updateQr(longUrl);
  const sequence = getOrderedServices(settingsCache);
  if (!sequence.length) {
    return setMessage('Aucun service actif. Configure l ordre dans Options.', 'error');
  }

  setMessage('Raccourcissement en cours...', 'info');
  let lastError = 'Aucun service disponible.';

  for (const service of sequence) {
    if (service.tokenKey && !settingsCache[service.tokenKey]) {
      continue;
    }

    try {
      const shortUrl = await service.request(longUrl, settingsCache);
      if (!isValidUrl(shortUrl)) throw new Error('Reponse de service invalide.');

      const tab = await getActiveTab();
      const faviconUrl = tab?.favIconUrl || '';
      const screenshot = await captureTabScreenshot(tab);

      ui.shortUrl.value = shortUrl;
      ui.usedService.textContent = `Service utilise: ${service.label}`;
      ui.expandedText.textContent = '';
      ui.resultSection.classList.remove('hidden');
      triggerSuccessAnimation();
      setMessage(isAuto ? 'Lien genere automatiquement.' : 'Lien genere.', 'success');

      await saveHistory({
        id: crypto.randomUUID(),
        service: service.label,
        longUrl,
        shortUrl,
        createdAt: Date.now(),
        faviconUrl,
        screenshot
      });
      await renderHistory();
      return;
    } catch (error) {
      lastError = `${service.label}: ${error.message}`;
    }
  }

  setMessage(`Echec de tous les services. ${lastError}`, 'error');
}

function getOrderedServices(settings) {
  const normalized = normalizeServiceOrder(settings.serviceOrder);
  const enabledIds = normalized.filter((item) => item.enabled).map((item) => item.id);

  const paid = [];
  const free = [];

  enabledIds.forEach((id) => {
    const service = SERVICES[id];
    if (!service) return;
    if (service.tier === 'paid') paid.push(service);
    else free.push(service);
  });

  return [...paid, ...free];
}

async function onCopy() {
  if (!ui.shortUrl.value) return;
  await navigator.clipboard.writeText(ui.shortUrl.value);
  setMessage('Lien copie dans le presse-papiers.', 'success');
}

async function onExpand() {
  const value = ui.shortUrl.value.trim();
  if (!isValidUrl(value)) return setMessage('Aucune URL raccourcie valide.', 'error');

  setMessage('Recuperation de l URL finale...', 'info');
  try {
    const response = await fetch(value, { redirect: 'follow', cache: 'no-store' });
    ui.expandedText.textContent = `URL finale: ${response.url}`;
    setMessage('URL finale recuperee.', 'success');
  } catch (error) {
    setMessage(`Impossible d obtenir l URL finale: ${error.message}`, 'error');
  }
}

function updateQr(url) {
  if (!isValidUrl(url)) {
    ui.qrImage.removeAttribute('src');
    return;
  }

  ui.qrImage.src = `https://quickchart.io/qr?size=140&text=${encodeURIComponent(url)}`;
}

function triggerSuccessAnimation() {
  ui.resultSection.classList.remove('success-pop');
  void ui.resultSection.offsetWidth;
  ui.resultSection.classList.add('success-pop');
}

async function renderHistory() {
  const data = await browser.storage.local.get(KEYS.history);
  const history = Array.isArray(data[KEYS.history]) ? data[KEYS.history] : [];

  ui.historyList.innerHTML = '';
  if (!history.length) {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.textContent = 'Aucun lien pour le moment.';
    ui.historyList.appendChild(li);
    return;
  }

  history.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'history-item';
    const date = new Date(item.createdAt || Date.now()).toLocaleString('fr-FR');

    li.innerHTML = `
      <div class="history-meta">
        <div>
          ${item.faviconUrl ? `<img class="history-favicon" src="${escapeHtml(item.faviconUrl)}" alt="" />` : ''}
          <strong>${escapeHtml(item.service || 'Service')}</strong>
        </div>
        ${item.screenshot ? `<img class="history-screen" src="${escapeHtml(item.screenshot)}" alt="Capture" />` : ''}
      </div>
      <div><small>${escapeHtml(date)}</small></div>
      <a class="history-link" href="${escapeHtml(item.longUrl || '#')}" target="_blank" rel="noreferrer">Origine: ${escapeHtml(item.longUrl || '')}</a>
      <a class="history-link" href="${escapeHtml(item.shortUrl || '#')}" target="_blank" rel="noreferrer">Court: ${escapeHtml(item.shortUrl || '')}</a>
    `;

    ui.historyList.appendChild(li);
  });
}

async function getActiveTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function captureTabScreenshot(tab) {
  if (!tab || typeof tab.windowId !== 'number') return '';
  try {
    return await browser.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: 25 });
  } catch {
    return '';
  }
}

async function loadSettings() {
  const data = await browser.storage.sync.get(KEYS.settings);
  const settings = { ...DEFAULT_SETTINGS, ...(data[KEYS.settings] || {}) };
  settings.serviceOrder = normalizeServiceOrder(settings.serviceOrder);
  return settings;
}

function normalizeServiceOrder(value) {
  const result = [];
  const seen = new Set();

  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (!item || !SERVICE_IDS.includes(item.id) || seen.has(item.id)) return;
      result.push({ id: item.id, enabled: item.enabled !== false });
      seen.add(item.id);
    });
  }

  SERVICE_IDS.forEach((id) => {
    if (!seen.has(id)) result.push({ id, enabled: true });
  });

  return result;
}

async function saveHistory(entry) {
  const data = await browser.storage.local.get(KEYS.history);
  const history = Array.isArray(data[KEYS.history]) ? data[KEYS.history] : [];
  history.unshift(entry);
  await browser.storage.local.set({ [KEYS.history]: history.slice(0, 60) });
}

async function parseJson(response) {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json();
}

async function expectText(response) {
  const text = await response.text();
  if (!response.ok) throw new Error(text || `HTTP ${response.status}`);
  return text.trim();
}

function setMessage(text, type) {
  ui.message.textContent = text;
  ui.message.dataset.type = type;
}

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
