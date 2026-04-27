// Asgard Bridge — background service worker
// Polls asgard-ai for pending commands and executes them in the user's active Chrome tab.

const ASGARD_AI = 'https://asgard-ai.pgallivan.workers.dev';
const POLL_INTERVAL_SEC = 2;
const DEFAULT_PIN = '2967';

async function getConfig() {
  const stored = await chrome.storage.local.get(['pin', 'enabled']);
  return {
    pin: stored.pin || DEFAULT_PIN,
    enabled: stored.enabled !== false
  };
}

async function setStatus(text, color) {
  try {
    await chrome.storage.local.set({ statusText: text, statusColor: color || '#888', statusTs: Date.now() });
    await chrome.action.setBadgeText({ text: text === 'idle' ? '' : '●' });
    await chrome.action.setBadgeBackgroundColor({ color: color || '#888' });
  } catch (e) {}
}

async function poll() {
  const { pin, enabled } = await getConfig();
  if (!enabled) return;
  try {
    const r = await fetch(ASGARD_AI + '/bridge/poll?uid=paddy', { headers: { 'X-Pin': pin } });
    if (!r.ok) {
      await setStatus('error', '#f87171');
      return;
    }
    const data = await r.json();
    if (data.idle) {
      await setStatus('idle', '#4ade80');
      return;
    }
    await setStatus('busy', '#facc15');
    const result = await execute(data.command);
    await fetch(ASGARD_AI + '/bridge/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Pin': pin },
      body: JSON.stringify({ id: data.id, result })
    });
    await setStatus('idle', '#4ade80');
  } catch (e) {
    await setStatus('error', '#f87171');
    console.error('Asgard bridge poll failed:', e);
  }
}

async function execute(command) {
  const type = command.type;
  const input = command.input || {};
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab) return { ok: false, error: 'No active tab' };

    if (type === 'navigate') {
      await chrome.tabs.update(tab.id, { url: input.url });
      // Wait for load
      await new Promise(res => {
        function onUpdated(tabId, info) {
          if (tabId === tab.id && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(onUpdated);
            res();
          }
        }
        chrome.tabs.onUpdated.addListener(onUpdated);
        setTimeout(() => { chrome.tabs.onUpdated.removeListener(onUpdated); res(); }, 15000);
      });
      const after = await chrome.tabs.get(tab.id);
      return { ok: true, url: after.url, title: after.title };
    }

    if (type === 'screenshot') {
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      return { ok: true, image_data_url: dataUrl, url: tab.url, title: tab.title };
    }

    if (type === 'extract') {
      const sel = input.selector || 'body';
      const fmt = input.format || 'text';
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (sel, fmt) => {
          const el = sel === 'body' ? document.body : document.querySelector(sel);
          if (!el) return { ok: false, error: 'selector not found: ' + sel };
          if (fmt === 'html') return { ok: true, html: el.innerHTML.substring(0, 60000), length: el.innerHTML.length };
          return { ok: true, text: (el.innerText || el.textContent || '').substring(0, 60000) };
        },
        args: [sel, fmt]
      });
      return Object.assign({ url: tab.url }, result);
    }

    if (type === 'click') {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (sel) => {
          const el = document.querySelector(sel);
          if (!el) return { ok: false, error: 'selector not found: ' + sel };
          el.click();
          return { ok: true, clicked: sel };
        },
        args: [input.selector]
      });
      return Object.assign({ url: tab.url }, result);
    }

    if (type === 'type') {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (sel, text, submit) => {
          const el = document.querySelector(sel);
          if (!el) return { ok: false, error: 'selector not found: ' + sel };
          el.focus();
          if (el.isContentEditable) el.textContent = text;
          else el.value = text;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          if (submit) {
            const form = el.closest('form');
            if (form) form.submit();
            else el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          }
          return { ok: true, typed: sel };
        },
        args: [input.selector, input.text || '', !!input.submit]
      });
      return Object.assign({ url: tab.url }, result);
    }

    return { ok: false, error: 'Unknown command type: ' + type };
  } catch (e) {
    return { ok: false, error: e.message, stack: e.stack ? e.stack.substring(0, 400) : null };
  }
}

// Set up polling alarm (runs even when popup closed; service worker wakes on alarm)
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('asgard-poll', { periodInMinutes: 0.05 }); // ~3s minimum granularity
  setStatus('idle', '#4ade80');
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('asgard-poll', { periodInMinutes: 0.05 });
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'asgard-poll') poll();
});

// Also poll immediately on message from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'poll-now') { poll().then(() => sendResponse({ ok: true })); return true; }
});
