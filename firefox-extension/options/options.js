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

const fields = {
  bitlyToken: document.getElementById('bitlyToken'),
  tinyUrlToken: document.getElementById('tinyUrlToken'),
  rebrandlyToken: document.getElementById('rebrandlyToken'),
  rebrandlyDomain: document.getElementById('rebrandlyDomain')
};

const saveBtn = document.getElementById('saveBtn');
const historyList = document.getElementById('historyList');
const message = document.getElementById('message');

init().catch((error) => {
  message.textContent = `Erreur: ${error.message}`;
});

async function init() {
  const settingsData = await browser.storage.sync.get(KEYS.settings);
  const settings = { ...DEFAULT_SETTINGS, ...(settingsData[KEYS.settings] || {}) };

  Object.entries(fields).forEach(([key, node]) => {
    node.value = settings[key] || '';
  });

  saveBtn.addEventListener('click', saveSettings);
  await renderHistory();
}

async function saveSettings() {
  const settings = Object.fromEntries(
    Object.entries(fields).map(([key, node]) => [key, node.value.trim()])
  );

  await browser.storage.sync.set({ [KEYS.settings]: settings });
  message.textContent = 'Paramètres enregistrés.';
}

async function renderHistory() {
  const historyData = await browser.storage.local.get(KEYS.history);
  const history = Array.isArray(historyData[KEYS.history]) ? historyData[KEYS.history] : [];

  historyList.innerHTML = '';
  if (!history.length) {
    const li = document.createElement('li');
    li.textContent = 'Aucun lien pour le moment.';
    historyList.appendChild(li);
    return;
  }

  history.slice(0, 20).forEach((item) => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${escapeHtml(item.service || 'Service')}</strong> — <a href="${escapeHtml(item.shortUrl || '#')}" target="_blank" rel="noreferrer">${escapeHtml(item.shortUrl || '')}</a>`;
    historyList.appendChild(li);
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
