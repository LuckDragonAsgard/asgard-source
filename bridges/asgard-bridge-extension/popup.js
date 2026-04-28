async function refresh() {
  const s = await chrome.storage.local.get(['statusText', 'statusColor', 'pin', 'enabled']);
  const dot = document.getElementById('dot');
  const status = document.getElementById('status');
  const txt = s.statusText || 'idle';
  status.textContent = 'Asgard Bridge — ' + txt;
  dot.className = 'dot ' + txt;
  document.getElementById('pin').value = s.pin || '';
  document.getElementById('enabled').checked = s.enabled !== false;
}

document.getElementById('pin').addEventListener('change', async (e) => {
  await chrome.storage.local.set({ pin: e.target.value });
});
document.getElementById('enabled').addEventListener('change', async (e) => {
  await chrome.storage.local.set({ enabled: e.target.checked });
});
document.getElementById('poll').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'poll-now' });
  setTimeout(refresh, 600);
});

refresh();
setInterval(refresh, 2000);
