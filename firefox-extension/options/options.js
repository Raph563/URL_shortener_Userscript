const KEYS = {
  settings: 'ffExt.settings'
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

const SERVICE_META = {
  bitly: { label: 'Bitly', tier: 'Payant' },
  tinyurl: { label: 'TinyURL', tier: 'Payant' },
  rebrandly: { label: 'Rebrandly', tier: 'Payant' },
  isgd: { label: 'is.gd', tier: 'Gratuit' },
  vgd: { label: 'v.gd', tier: 'Gratuit' }
};

const SERVICE_DOCS = [
  {
    label: 'Bitly API',
    url: 'https://dev.bitly.com/',
    icon: '../assets/services/bitly.svg'
  },
  {
    label: 'TinyURL API',
    url: 'https://tinyurl.com/app/dev',
    icon: '../assets/services/tinyurl.svg'
  },
  {
    label: 'Rebrandly API',
    url: 'https://developers.rebrandly.com/',
    icon: '../assets/services/rebrandly.svg'
  }
];

const fields = {
  bitlyToken: document.getElementById('bitlyToken'),
  tinyUrlToken: document.getElementById('tinyUrlToken'),
  rebrandlyToken: document.getElementById('rebrandlyToken'),
  rebrandlyDomain: document.getElementById('rebrandlyDomain')
};

const saveBtn = document.getElementById('saveBtn');
const message = document.getElementById('message');
const apiLinks = document.getElementById('apiLinks');
const serviceOrderList = document.getElementById('serviceOrderList');

let settingsState = { ...DEFAULT_SETTINGS };
let serviceOrderState = normalizeServiceOrder(DEFAULT_SETTINGS.serviceOrder);

init().catch((error) => {
  message.textContent = `Erreur: ${error.message}`;
});

async function init() {
  const settingsData = await browser.storage.sync.get(KEYS.settings);
  settingsState = { ...DEFAULT_SETTINGS, ...(settingsData[KEYS.settings] || {}) };
  serviceOrderState = normalizeServiceOrder(settingsState.serviceOrder);

  Object.entries(fields).forEach(([key, node]) => {
    node.value = settingsState[key] || '';
  });

  renderApiLinks();
  renderServiceOrder();

  serviceOrderList.addEventListener('click', onOrderAction);
  serviceOrderList.addEventListener('change', onToggleService);
  saveBtn.addEventListener('click', saveSettings);
}

function renderApiLinks() {
  apiLinks.innerHTML = '';
  SERVICE_DOCS.forEach((service) => {
    const card = document.createElement('article');
    card.className = 'link-card';
    card.innerHTML = `
      <div>
        <img src="${service.icon}" alt="" />
        <strong>${escapeHtml(service.label)}</strong>
      </div>
      <a href="${escapeHtml(service.url)}" target="_blank" rel="noreferrer">Ouvrir</a>
    `;
    apiLinks.appendChild(card);
  });
}

function renderServiceOrder() {
  serviceOrderList.innerHTML = '';

  serviceOrderState.forEach((item, index) => {
    const meta = SERVICE_META[item.id] || { label: item.id, tier: '' };
    const li = document.createElement('li');
    li.className = 'order-item';
    li.innerHTML = `
      <div class="order-left">
        <input type="checkbox" data-id="${item.id}" ${item.enabled ? 'checked' : ''} />
        <div>
          <strong>${escapeHtml(meta.label)}</strong>
          <div>${escapeHtml(meta.tier)}</div>
        </div>
      </div>
      <div class="order-actions">
        <button class="icon-btn" type="button" data-action="up" data-index="${index}" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button class="icon-btn" type="button" data-action="down" data-index="${index}" ${index === serviceOrderState.length - 1 ? 'disabled' : ''}>↓</button>
      </div>
    `;
    serviceOrderList.appendChild(li);
  });
}

function onOrderAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const index = Number(button.dataset.index);
  if (!Number.isInteger(index)) return;

  if (button.dataset.action === 'up' && index > 0) {
    [serviceOrderState[index - 1], serviceOrderState[index]] = [serviceOrderState[index], serviceOrderState[index - 1]];
  }

  if (button.dataset.action === 'down' && index < serviceOrderState.length - 1) {
    [serviceOrderState[index + 1], serviceOrderState[index]] = [serviceOrderState[index], serviceOrderState[index + 1]];
  }

  renderServiceOrder();
}

function onToggleService(event) {
  const checkbox = event.target.closest('input[type="checkbox"][data-id]');
  if (!checkbox) return;

  const item = serviceOrderState.find((entry) => entry.id === checkbox.dataset.id);
  if (!item) return;
  item.enabled = checkbox.checked;
}

async function saveSettings() {
  const updatedSettings = {
    ...settingsState,
    ...Object.fromEntries(Object.entries(fields).map(([key, node]) => [key, node.value.trim()])),
    serviceOrder: serviceOrderState
  };

  await browser.storage.sync.set({ [KEYS.settings]: updatedSettings });
  message.textContent = 'Parametres enregistres.';
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

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}