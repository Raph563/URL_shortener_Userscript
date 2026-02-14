function isSupportedUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

async function updatePageAction(tabId) {
  try {
    const tab = await browser.tabs.get(tabId);
    if (tab && isSupportedUrl(tab.url)) {
      await browser.pageAction.show(tabId);
    }
  } catch {
    // ignore tabs that cannot be queried/shown
  }
}

browser.tabs.onActivated.addListener(async ({ tabId }) => {
  await updatePageAction(tabId);
});

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    if (isSupportedUrl(tab.url)) {
      await browser.pageAction.show(tabId);
    }
  }
});

browser.runtime.onInstalled.addListener(async () => {
  const tabs = await browser.tabs.query({});
  await Promise.all(tabs.map((tab) => updatePageAction(tab.id)));
});
