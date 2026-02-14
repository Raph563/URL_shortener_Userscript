function updatePageAction(tabId, url) {
  if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    browser.pageAction.hide(tabId);
    return;
  }
  browser.pageAction.show(tabId);
}

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' || changeInfo.url) {
    updatePageAction(tabId, changeInfo.url || tab.url);
  }
});

browser.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await browser.tabs.get(tabId);
  updatePageAction(tabId, tab.url);
});

browser.runtime.onInstalled.addListener(async () => {
  const tabs = await browser.tabs.query({});
  tabs.forEach((tab) => updatePageAction(tab.id, tab.url));
});

browser.runtime.onStartup.addListener(async () => {
  const tabs = await browser.tabs.query({});
  tabs.forEach((tab) => updatePageAction(tab.id, tab.url));
});