chrome.action.onClicked.addListener(function () {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});
chrome.runtime.onMessage.addListener(function (message) {
  if (message && message.type === "MYDOCX_OPEN") {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
  }
});