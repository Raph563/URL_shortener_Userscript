const KEYS = {
  settings: 'ffExt.settings',
  history: 'ffExt.history'
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
    request: async (url) => {
      const response = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`);
      return expectText(response);
    }
  },
  vgd: {
    label: 'v.gd',
    request: async (url) => {
      const response = await fetch(`https://v.gd/create.php?format=simple&url=${encodeURIComponent(url)}`);
      return expectText(response);
    }
  }
};

const ui = {
  longUrl: document.getElementById('longUrl'),
  shortUrl: document.getElementById('shortUrl'),
  service: document.getElementById('service'),
  message: document.getElementById('message'),
  resultSection: document.getElementById('resultSection'),
  expandedText: document.getElementById('expandedText'),
  shortenBtn: document.getElementById('shortenBtn'),
  copyBtn: document.getElementById('copyBtn'),
  expandBtn: document.getElementById('expandBtn'),
  openOptions: document.getElementById('openOptions')
};

let settingsCache = DEFAULT_SETTINGS;

init().catch((error) => setMessage(`Erreur init: ${error.message}`, 'error'));

async function init() {
  const settings = await loadSettings();
  settingsCache = settings;

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.url?.startsWith('http')) {
    ui.longUrl.value = tab.url;
  }

  ui.shortenBtn.addEventListener('click', onShorten);
  ui.copyBtn.addEventListener('click', async () => {
    if (!ui.shortUrl.value) return;
    await navigator.clipboard.writeText(ui.shortUrl.value);
    setMessage('Lien copié dans le presse-papiers.', 'success');
  });
  ui.expandBtn.addEventListener('click', onExpand);
  ui.openOptions.addEventListener('click', () => browser.runtime.openOptionsPage());

  document.querySelectorAll('a[target="_blank"]').forEach((link) => {
    link.addEventListener('click', async (event) => {
      event.preventDefault();
      await browser.tabs.create({ url: link.href });
    });
  });

  browser.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'sync' && changes[KEYS.settings]) {
      settingsCache = await loadSettings();
      setMessage('Paramètres rechargés.', 'info');
    }
  });
}

async function onShorten() {
  const longUrl = ui.longUrl.value.trim();
  const serviceKey = ui.service.value;
  const service = SERVICES[serviceKey];

  if (!isValidUrl(longUrl)) return setMessage('URL invalide.', 'error');
  if (!service) return setMessage('Service inconnu.', 'error');
  if (service.tokenKey && !settingsCache[service.tokenKey]) {
    return setMessage(`Ajoute la clé API ${service.label} dans les paramètres.`, 'error');
  }

  setMessage('Raccourcissement en cours...', 'info');
  try {
    const shortUrl = await service.request(longUrl, settingsCache);
    if (!isValidUrl(shortUrl)) throw new Error('Réponse de service invalide.');

    ui.shortUrl.value = shortUrl;
    ui.expandedText.textContent = '';
    ui.resultSection.classList.remove('hidden');
    setMessage('Lien généré.', 'success');

    await saveHistory({
      id: crypto.randomUUID(),
      service: service.label,
      longUrl,
      shortUrl,
      createdAt: Date.now()
    });
  } catch (error) {
    setMessage(`Erreur: ${error.message}`, 'error');
  }
}

async function onExpand() {
  const value = ui.shortUrl.value.trim();
  if (!isValidUrl(value)) return setMessage('Aucune URL raccourcie valide.', 'error');

  setMessage('Récupération de l’URL finale...', 'info');
  try {
    const response = await fetch(value, { redirect: 'follow', cache: 'no-store' });
    ui.expandedText.textContent = `URL finale: ${response.url}`;
    setMessage('URL finale récupérée.', 'success');
  } catch (error) {
    setMessage(`Impossible d'obtenir l'URL finale: ${error.message}`, 'error');
  }
}

async function loadSettings() {
  const data = await browser.storage.sync.get(KEYS.settings);
  return { ...DEFAULT_SETTINGS, ...(data[KEYS.settings] || {}) };
}

async function saveHistory(entry) {
  const data = await browser.storage.local.get(KEYS.history);
  const history = Array.isArray(data[KEYS.history]) ? data[KEYS.history] : [];
  history.unshift(entry);
  await browser.storage.local.set({ [KEYS.history]: history.slice(0, 30) });
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
