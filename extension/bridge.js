// Draait in het Reconstruct-tabblad: geeft verversverzoeken van de app door aan de extensie en terug.
document.documentElement.dataset.reconstructExtension = '1';
window.postMessage({ source: 'reconstruct-ext', type: 'ready' }, '*');

window.addEventListener('message', (ev) => {
  if (ev.source !== window || ev.data?.source !== 'reconstruct-app' || ev.data.type !== 'fetch-page') return;
  const { id, url } = ev.data;
  const fail = (error) => window.postMessage({ source: 'reconstruct-ext', type: 'fetch-result', id, ok: false, error }, '*');
  // na het herladen van de extensie is dit script verweesd tot de pagina ververst wordt
  if (!chrome.runtime?.id) return fail('extensie is herladen: ververs deze pagina');
  try {
    chrome.runtime.sendMessage({ type: 'fetch-page', url }, (res) => {
      const reply = res || { ok: false, error: chrome.runtime.lastError?.message || 'geen antwoord' };
      window.postMessage({ source: 'reconstruct-ext', type: 'fetch-result', id, ...reply }, '*');
    });
  } catch {
    fail('extensie is herladen: ververs deze pagina');
  }
});
