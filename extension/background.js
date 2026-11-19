// Leest de liveblog in het actieve tabblad en geeft die door aan het Reconstruct-tabblad.
const APP_URL = 'https://news-reconstruct.vercel.app/';
// een al open tabblad wint, ook de lokale versie
const APP_PATTERNS = ['https://news-reconstruct.vercel.app/*', 'http://localhost:8777/*', 'http://127.0.0.1:8777/*'];

function badge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 4000);
}

async function openApp() {
  // online versie eerst; een open lokaal tabblad alleen als er geen online tabblad is
  let existing = null;
  for (const pattern of APP_PATTERNS) {
    [existing] = await chrome.tabs.query({ url: pattern });
    if (existing) break;
  }
  if (existing) {
    await chrome.tabs.update(existing.id, { active: true });
    await chrome.windows.update(existing.windowId, { focused: true });
    return existing;
  }
  return chrome.tabs.create({ url: APP_URL, active: true });
}

// wacht tot de app geladen is en de importfunctie beschikbaar is
async function waitForApp(tabId, timeoutMs = 15000) {
  const until = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < until) {
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: () => typeof window.reconstructImport === 'function'
      });
      if (result) return;
      lastError = 'importfunctie nog niet geladen';
    } catch (err) { lastError = String(err?.message || err); }
    await new Promise(r => setTimeout(r, 300));
  }
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  throw new Error(`Reconstruct reageert niet (${tab?.url || 'onbekend tabblad'}): ${lastError}`);
}

// Verversen: haal de liveblogpagina op met de cookies van de gebruiker (toestemming is al gegeven in Chrome).
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type !== 'fetch-page') return false;
  const fromApp = APP_PATTERNS.some(p => (sender.url || '').startsWith(p.replace('*', '')));
  if (!fromApp || !/^https:\/\//.test(msg.url || '')) {
    sendResponse({ ok: false, error: 'niet toegestaan' });
    return false;
  }
  // zonder hostrechten blokkeert CORS het verzoek toch; dan niet eens proberen
  if (!hasHostAccess(msg.url)) {
    console.info('Overgeslagen (geen toegang):', msg.url);
    sendResponse({ ok: false, error: 'geen toegang', noAccess: true });
    return false;
  }
  fetch(msg.url, { credentials: 'include', cache: 'no-store', redirect: 'follow' })
    .then(async r => sendResponse({ ok: r.ok, status: r.status, finalUrl: r.url, html: await r.text() }))
    .catch(err => sendResponse({ ok: false, error: String(err?.message || err) }));
  return true;
});

// matcht een URL tegen de host_permissions uit de manifest (https://*.ad.nl/*, https://nos.nl/*, ...)
function hasHostAccess(url) {
  let host;
  try { host = new URL(url).hostname.toLowerCase(); } catch { return false; }
  return (chrome.runtime.getManifest().host_permissions || []).some(pattern => {
    const m = pattern.match(/^https:\/\/(\*\.)?([^/]+)\//);
    if (!m) return false;
    const base = m[2].toLowerCase();
    return host === base || (!!m[1] && host.endsWith('.' + base));
  });
}

// Tickaroo staat de API alleen toe vanaf sitedomeinen; in het liveblog-tabblad is de oorsprong goed, in de extensie niet.
chrome.runtime.onInstalled.addListener(setTickarooOrigin);
chrome.runtime.onStartup.addListener(setTickarooOrigin);
setTickarooOrigin();
function setTickarooOrigin() {
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1],
    addRules: [{
      id: 1,
      condition: { urlFilter: '||cdn.tickaroo.com/api/', resourceTypes: ['xmlhttprequest'] },
      action: { type: 'modifyHeaders', requestHeaders: [{ header: 'Origin', operation: 'set', value: 'https://www.telegraaf.nl' }] }
    }]
  }).catch(err => console.warn('Origin-regel niet gezet:', err));
}

// Draait in het liveblog-tabblad en geeft de volledige Tickaroo-data terug (of null).
async function fetchTickarooInPage() {
  const html = document.documentElement.innerHTML;
  const clientId = html.match(/tickarooClientId\\?"\s*:\s*\\?"([0-9a-f]{24})/i)?.[1]
    || html.match(/<tickaroo-liveblog[^>]*\bclientid=["']([0-9a-f]{24})/i)?.[1];
  const liveblogId = html.match(/\\?"name\\?"\s*:\s*\\?"liveBlogId\\?"\s*,\s*\\?"value\\?"\s*:\s*\\?"([0-9a-f]{24})/i)?.[1]
    || html.match(/<tickaroo-liveblog[^>]*\bliveblogid=["']([0-9a-f]{24})/i)?.[1];
  if (!clientId || !liveblogId) return null;
  try {
    const r = await fetch(`https://cdn.tickaroo.com/api/embed/v4/js/liveblog.json?client_id=${clientId}&liveblogId=${liveblogId}&limit=1000`, { credentials: 'omit' });
    return r.ok ? { liveblogId, text: await r.text() } : null;
  } catch { return null; }
}

// Draait in het liveblog-tabblad: klikt 'meer laden'-knoppen en scrolt door tot er geen nieuwe posts meer bijkomen.
async function expandLiveblog() {
  // sites met een eigen liveblog-API (DPG-regio, Timepath) haalt de app zelf volledig op
  if (/\\?"live(Blog)?Id\\?"\s*:\s*\\?"[0-9a-f]{24}|data-timepath-liveblog-id|tickarooClientId|<tickaroo-liveblog/i.test(document.documentElement.innerHTML)) return -1;
  const LOAD_MORE = /^(laad|toon|bekijk|meer)?\s*(meer|oudere|eerdere)(\s+(laden|berichten|updates|posts|tonen))?$|load more|show more|older posts|meer laden|oudere berichten|eerdere berichten/i;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  // posts tellen via time[datetime] of, zoals bij AD, losse '03:26'-tijdregels
  const count = () => document.querySelectorAll('time[datetime]').length
    + [...document.querySelectorAll('p, span, div')]
      .filter(el => !el.children.length && /^\d{1,2}:\d{2}$/.test((el.textContent || '').trim())).length;
  const startY = window.scrollY;
  const until = Date.now() + 60000;
  let idle = 0;
  while (idle < 3 && Date.now() < until) {
    const before = count();
    const buttons = [...document.querySelectorAll('button, [role="button"], a[href="#"], a:not([href])')]
      .filter(el => el.offsetParent !== null && !el.disabled)
      .filter(el => {
        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        return text.length < 40 && LOAD_MORE.test(text);
      });
    buttons.forEach(el => el.click());
    window.scrollTo(0, document.documentElement.scrollHeight);
    // wachten op nieuwe posts, maximaal ~4 s per ronde
    for (let i = 0; i < 8 && count() === before; i++) await sleep(500);
    idle = count() > before ? 0 : idle + 1;
  }
  window.scrollTo(0, startY);
  return count();
}

chrome.action.onClicked.addListener(async (tab) => {
  try {
    // blijft staan tijdens het openklappen (kan even duren)
    chrome.action.setBadgeText({ text: '…' });
    chrome.action.setBadgeBackgroundColor({ color: '#6750A4' });
    // tijdens het openklappen kan Chrome het tabblad vervangen (nieuw tab-id); dan het actieve tabblad van dat venster nemen
    const runIn = async (func) => {
      try {
        return await chrome.scripting.executeScript({ target: { tabId: tab.id }, func });
      } catch (err) {
        if (!/No tab with id/i.test(String(err?.message))) throw err;
        const [current] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
        if (!current) throw err;
        tab = current;
        return chrome.scripting.executeScript({ target: { tabId: tab.id }, func });
      }
    };
    try {
      await runIn(expandLiveblog);
    } catch (err) {
      console.warn('Openklappen mislukt, ga verder met wat er staat:', err);
    }
    const [{ result: page }] = await runIn(
      () => ({ html: document.documentElement.outerHTML, url: location.href, title: document.title })
    );
    page.tickaroo = (await runIn(fetchTickarooInPage).catch(() => [{}]))[0]?.result || null;
    const appTab = await openApp();
    await waitForApp(appTab.id);
    // een tabblad dat al open stond voor het (her)laden van de extensie mist de bridge; zonder bridge geen liveblog-API
    await chrome.scripting.executeScript({ target: { tabId: appTab.id }, files: ['bridge.js'] });
    const [{ result: ok }] = await chrome.scripting.executeScript({
      target: { tabId: appTab.id },
      world: 'MAIN',
      func: (payload) => window.reconstructImport(payload),
      args: [page]
    });
    badge(ok ? '✓' : '?', ok ? '#1E8E3E' : '#B3261E');
  } catch (err) {
    console.error(err);
    badge('!', '#B3261E');
  }
});
