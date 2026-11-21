/* ============================================================
   Tijdlijn Builder — alles draait lokaal in de browser.
   ============================================================ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const STORAGE_KEY = 'reconstruct.v1';
const LEGACY_STORAGE_KEYS = ['tijdlijn-builder.v3'];

/* Vast kleurenpalet (Material 3 containerkleuren) */
const PALETTE = [
  '#EADDFF', '#D3E3FD', '#C8F0DC', '#FFDE84', '#F9DEDC', '#FFD8E4',
  '#E3E3E3', '#DCEBD8', '#FFE0B2', '#E2E0F5', '#D9EEF3', '#F6DCF0'
];

/* Afmetingen van de slide (= de PNG) */
const SLIDE_W = 1920, PAD_X = 60, PAD_TOP = 48, PAD_BOTTOM = 56;
const AXIS_W = 100, AXIS_GAP = 40, COL_GAP = 32, ROW_GAP = 24;
const LAYER_W = SLIDE_W - 2 * PAD_X - AXIS_W - AXIS_GAP;
// raster: minimaal 6 kolommen (tegels nooit breder dan 1/6), maximaal 8 (smaller wordt slecht leesbaar, ~180px)
const GRID_COLS = 6;
const MAX_GRID_COLS = 8;
// Updates binnen dit aantal minuten van elkaar worden als 'hetzelfde moment' behandeld:
// ze krijgen dezelfde verticale positie, zodat ze als groep ogen en niet steeds verder wegdrijven.
const CLUSTER_MINUTES = 3;
const FAVICON_SIZE = 256;

const SLIDE_FORMATS = {
  auto: { h: null },
  slide: { h: 1080 },
  under: { h: 820 }
};

/* Stapgrootte die bij het bereik hoort: niet te veel en niet te weinig punten. */
function niceStep(minutes) {
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440];
  return steps.find(s => minutes / s <= 8) || 1440;
}

const LOGO_ALIASES = {
  'NU': ['nunl', 'nu'], 'AD': ['ad', 'algemeendagblad'], 'VK': ['vk', 'volkskrant', 'devolkskrant'],
  'TR': ['tr', 'trouw'], 'HP': ['hp', 'parool', 'hetparool'], 'DM': ['dm', 'demorgen', 'morgen'],
  'HLN': ['hln', 'hetlaatstenieuws', 'laatstenieuws'], '7S7': ['7s7', '7sur7', 'sur7'],
  'BD': ['bd', 'brabantsdagblad'], 'BS': ['bs', 'bndestem', 'destem'],
  'DG': ['dg', 'degelderlander', 'gelderlander'], 'ED': ['ed', 'eindhovensdagblad'],
  'PZ': ['pz', 'pzc'], 'ST': ['st', 'destentor', 'stentor'], 'TT': ['tt', 'tubantia', 'tctubantia'],
  'TTA': ['tta'], 'DON': ['don', 'donaldduck', 'donald'], 'FLR': ['flr', 'flair'],
  'LIB': ['lib', 'libelle'], 'LINDA': ['linda'], 'LINDA.meiden': ['lindameiden'],
  'MAR': ['mar', 'margriet'], 'HM': ['hm', 'humo'], 'STO': ['sto', 'story'],
  'VRO': ['vro', 'vrouw'], 'INDEBUURT': ['indebuurt']
};

const BRAND_COLORS = {
  'NU': '#EADDFF', 'DM': '#E3E3E3', 'HLN': '#FFDE84', 'AD': '#F9DEDC', 'VK': '#D3E3FD',
  'TR': '#DCEBD8', 'HP': '#FFD8E4', '7S7': '#FFE0B2', 'LINDA': '#F6DCF0', 'LIB': '#D9EEF3',
  'MAR': '#FFE0B2', 'HM': '#E2E0F5', 'STO': '#F9DEDC', 'DON': '#FFDE84', 'VRO': '#FFD8E4',
  'INDEBUURT': '#C8F0DC'
};

/* Logo's die optisch kleiner ogen dan de rest krijgen extra hoogte */
const LOGO_SCALE = {};

const BRAND_HOST_FALLBACK = {
  nunl: 'www.nu.nl',
  nu: 'www.nu.nl',
  ad: 'www.ad.nl',
  algemeendagblad: 'www.ad.nl',
  volkskrant: 'www.volkskrant.nl',
  devolkskrant: 'www.volkskrant.nl',
  rtl: 'www.rtlnieuws.nl',
  rtlnieuws: 'www.rtlnieuws.nl',
  rtlnieuwsnl: 'www.rtlnieuws.nl',
  trouw: 'www.trouw.nl',
  parool: 'www.parool.nl',
  hetparool: 'www.parool.nl',
  demorgen: 'www.demorgen.be',
  hln: 'www.hln.be',
  hetlaatstenieuws: 'www.hln.be',
  telegraaf: 'www.telegraaf.nl',
  detelegraaf: 'www.telegraaf.nl',
  nos: 'nos.nl',
  nosnl: 'nos.nl',
  nosnieuws: 'nos.nl',
  nrc: 'www.nrc.nl',
  nrcnl: 'www.nrc.nl',
  fd: 'fd.nl',
  financieeldagblad: 'fd.nl',
  bd: 'www.bd.nl',
  brabantsdagblad: 'www.bd.nl',
  bndestem: 'www.bndestem.nl',
  degelderlander: 'www.gelderlander.nl',
  gelderlander: 'www.gelderlander.nl',
  ed: 'www.ed.nl',
  eindhovensdagblad: 'www.ed.nl',
  pzc: 'www.pzc.nl',
  destentor: 'www.destentor.nl',
  stentor: 'www.destentor.nl',
  tubantia: 'www.tubantia.nl',
  tctubantia: 'www.tubantia.nl',
  '7sur7': 'www.7sur7.be',
  humo: 'www.humo.be',
  hartvannederland: 'www.hartvannederland.nl',
  linda: 'www.linda.nl',
  libelle: 'www.libelle.nl',
  margriet: 'www.margriet.nl',
  indebuurt: 'www.indebuurt.nl'
};

const ICON_OPTIONS = [
  ['mail-open', 'Opens'], ['mouse-pointer-click', 'Clicks / CTR'], ['eye', 'Views'],
  ['users', 'Gebruikers'], ['user-plus', 'Nieuwe gebruikers'], ['trending-up', 'Groei'],
  ['percent', 'Percentage'], ['bar-chart-3', 'Volume'], ['activity', 'Engagement'],
  ['clock', 'Tijd'], ['timer', 'Leestijd'], ['bookmark', 'Opgeslagen'],
  ['star', 'Rating'], ['thumbs-up', 'Likes'], ['share-2', 'Shares'],
  ['message-circle', 'Reacties'], ['play', 'Plays'], ['newspaper', 'Artikelen'],
  ['euro', 'Omzet'], ['credit-card', 'Abonnementen'], ['target', 'Conversie'],
  ['zap', 'Pushes'], ['bell', 'Notificaties'], ['arrow-up-right', 'Uplift'],
  ['smartphone', 'App'], ['monitor', 'Web']
];

const FORMATS = [
  ['raw', 'Zoals in de data'], ['number', 'Getal (67.099)'],
  ['percent', 'Percentage (8,63%)'], ['compact', 'Compact (67,1k)']
];

/* ---------- state ---------- */
const defaultState = () => ({
  headers: [], rows: [], raw: '',
  mapping: { brand: null, time: null, title: null, body: null, link: null, premium: null, image: null, articleUrl: null, articleType: null, video: null, social: null, dataviz: null, linkPremium: null },
  metrics: [], brands: {}, removed: [], hiddenTitles: [], datasets: [],
  settings: {
    startTime: '06:00', endTime: '06:20',
    columns: 5, perTitle: 1, showDate: true, slideTitle: '', itemKind: '', format: 'auto',
    relative: false, highlightMax: true, titleLines: 0, cardStyle: 'modern',
    showBody: false,
    showImage: true,
    view: 'timeline',
    compareShow: 'table',
    compareShow2: '',
    chartType: 'bars',
    chartMeasure: '',
    chartFilter: 'all',
    chartColorBy: 'auto',
    chartHighlight: '',
    comboTitle: '',
    autoFit: true,
    rangeMode: 'compact',
    autoRefresh: false,
    periodFrom: '',
    periodTo: '',
    gifSpeed: 'slow',
    exportAction: 'png',
    videoMode: 'cinematic'
  }
});

let state = defaultState();
let zoom = null;
const openBrands = new Set();

let timelineTimer;
function scheduleTimeline() {
  clearTimeout(timelineTimer);
  timelineTimer = setTimeout(() => { renderTimeline(); save(); }, 150);
}

/* ============================================================
   Data inlezen
   ============================================================ */
function detectDelimiter(text) {
  const line = text.split(/\r?\n/).find(l => l.trim().length) || '';
  const counts = [',', ';', '\t', '|'].map(d => {
    let inQ = false, n = 0;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === d && !inQ) n++;
    }
    return [d, n];
  });
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

function parseCSV(text, delim) {
  const rows = [];
  let row = [], field = '', inQ = false;
  text = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  row.push(field);
  if (row.length > 1 || row[0].trim() !== '') rows.push(row);
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

function stripHtmlTags(html) {
  const tmp = document.createElement('div');
  // witruimte op blokgrenzen, anders plakt textContent kop en eerste zin aan elkaar ('opraken' + 'Op sommige')
  tmp.innerHTML = String(html || '').replace(/<\/(?:p|div|h[1-6]|li|ul|ol|blockquote|section|article|figure|tr)>|<br\s*\/?>/gi, '$& ');
  return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
}

/** Kop aan het begin van een post: een kopje of een vetgedrukte eerste regel, mits er daarna nog tekst volgt. */
function leadHeadlineFromHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = String(html || '');
  let el = tmp.firstElementChild;
  if (!el) return '';
  const bold = (x) => /^(STRONG|B)$/.test(x.tagName);
  const text = (x) => (x.textContent || '').replace(/\s+/g, ' ').trim();
  if (el.tagName === 'P' && el.children.length === 1 && bold(el.firstElementChild) && text(el) === text(el.firstElementChild)) el = el.firstElementChild;
  if (!/^(H[1-6]|STRONG|B)$/.test(el.tagName)) return '';
  const head = text(el);
  return head && stripHtmlTags(html).length > head.length + 10 ? head : '';
}

function summarizeUpdateText(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const sentence = clean.match(/^.{20,180}?[.!?](?=\s|$)/);
  if (sentence) return sentence[0].trim();
  return clean.length > 140 ? clean.slice(0, 137).trim() + '...' : clean;
}

function clipText(text, max = 140) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= max) return clean;
  return clean.slice(0, Math.max(1, max - 3)).trimEnd() + '...';
}

// Social embeds en media tellen niet als 'link naar een artikel'.
const NON_ARTICLE_HOST_RE = /(^|\.)(twitter\.com|x\.com|t\.co|instagram\.com|facebook\.com|fb\.com|youtube\.com|youtu\.be|tiktok\.com|bsky\.app|threads\.net|linkedin\.com|tickaroo\.com|timepath\.co|localfocus\.(?:nl|dpgmedia\.net)|localfocus\.dpgmedia\.net|datawrapper\.de|dwcdn\.net|flourish\.studio|flo\.uri\.sh|infogram\.com|apelections\.org)$/i;

// Vergelijkbare vorm van een URL: zonder protocol, www, query, hash en slash aan het eind.
function normalizeArticleUrl(url) {
  try {
    const u = new URL(url);
    return (u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/+$/, '')).toLowerCase();
  } catch {
    return '';
  }
}

function isArticleLink(url, ownUrl = '') {
  if (!isHttpUrl(url)) return false;
  try {
    const u = new URL(url);
    if (NON_ARTICLE_HOST_RE.test(u.hostname)) return false;
    if (/\.(jpe?g|png|gif|webp|avif|svg|mp4|m3u8|css|js|json|woff2?|ico|xml)$/i.test(u.pathname)) return false;
    // bestanden van eigen embeds (bv. De Morgen /redactie/specials/embeds/) zijn geen artikel
    if (/\/(embeds?|assets|static)\//i.test(u.pathname)) return false;
    // rubrieks-, tag- en auteurspagina's zijn geen ander artikel
    if (/\/(tag|tags|onderwerp|onderwerpen|auteur|auteurs|zoeken|search|rubriek)(\/|$)/i.test(u.pathname)) return false;
    const last = u.pathname.split('/').filter(Boolean).pop() || '';
    if (last.length < 12 && !/\d/.test(last)) return false;
    if (ownUrl && normalizeArticleUrl(url) === normalizeArticleUrl(ownUrl)) return false;
    return true;
  } catch {
    return false;
  }
}

function articleLinksFromContent(content, ownUrl = '') {
  const raw = String(content || '');
  if (!raw) return [];
  // relatieve links (/politiek/...~b123/) horen bij de site van de liveblog
  const absolute = (u) => { try { return new URL(u, ownUrl || undefined).href; } catch { return u; } };
  const hrefs = [...raw.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].map(m => absolute(m[1].replace(/&amp;/g, '&')));
  const plain = [...raw.replace(/<[^>]+>/g, ' ').matchAll(/https?:\/\/[^\s"'<>)\]]+/g)].map(m => m[0]);
  return [...new Set([...hrefs, ...plain].filter(u => isArticleLink(u, ownUrl)))];
}

// alle artikellinks van een post: de eerste als 'artikel_link', de hele lijst voor de premiumcontrole
function linkFields(...lists) {
  const links = [...new Set(lists.flat().filter(u => isHttpUrl(u)))];
  return { artikel_link: links[0] || '', artikel_links: links.join(' ') };
}

const rowLinks = (r) => String(r.artikel_links || r.artikel_link || '').split(/\s+/).filter(isHttpUrl);

// video, social en premium-link komen uit gekoppelde kolommen (bij liveblogs automatisch, bij een tabel zelf te kiezen)
const NEGATIVE = /^(nee|no|n|false|onwaar|0|-|geen)?$/i;
const isVideoRow = (r) => !!state.mapping.video && !NEGATIVE.test(String(r[state.mapping.video] ?? '').trim());
const socialOf = (r) => {
  const v = state.mapping.social ? String(r[state.mapping.social] ?? '').trim() : '';
  return NEGATIVE.test(v) ? '' : v;
};
const isLinkPremiumRow = (r) => !!state.mapping.linkPremium && !NEGATIVE.test(String(r[state.mapping.linkPremium] ?? '').trim());
const isDatavizRow = (r) => !!state.mapping.dataviz && !NEGATIVE.test(String(r[state.mapping.dataviz] ?? '').trim());

// korte link- en nieuwsdomeinen die bij dezelfde site horen als het domein van de liveblog
const SITE_ALIASES = { 'vrtnws.be': 'vrt.be', 'rtlnieuws.nl': 'rtl.nl' };
const siteKey = (host) => { const d = String(host || '').toLowerCase().split('.').slice(-2).join('.'); return SITE_ALIASES[d] || d; };

/** Links van een post: naar de eigen site (zelfde domein als de liveblog) of uitgaand. Zonder liveblog-URL tellen alle links als eigen.
 *  cls is één rubriek per post: eigen premium gaat voor eigen gratis, eigen gratis voor uitgaand. */
function linkInfo(r) {
  const m = state.mapping;
  if (!m.link) return { cls: '', own: false, external: false };
  const links = m.link === 'artikel_link' ? rowLinks(r) : [String(r[m.link] ?? '').trim()].filter(isHttpUrl);
  if (!links.length) return { cls: '', own: false, external: false };
  const siteOf = (u) => siteKey(hostFromUrl(u));
  const ownSite = m.articleUrl && isHttpUrl(r[m.articleUrl]) ? siteOf(r[m.articleUrl]) : '';
  const own = ownSite ? links.filter(u => siteOf(u) === ownSite) : links;
  const external = links.length > own.length;
  if (!own.length) return { cls: 'external', own: false, external };
  // premiumlabel van de post geldt voor de eigen links, tenzij juist een uitgaande link als premium bekend is
  const premium = own.some(u => linkMeta[u]?.premium === true)
    || (isLinkPremiumRow(r) && !links.some(u => !own.includes(u) && linkMeta[u]?.premium === true));
  return { cls: premium ? 'premium' : 'own', own: true, external };
}

// elke post valt in precies één mediarubriek; volgorde bij twijfel: video, datavisualisatie, social, foto
function mediaCategory(r, imageCol = state.mapping.image) {
  if (isVideoRow(r)) return 'video';
  if (isDatavizRow(r)) return 'dataviz';
  if (socialOf(r)) return 'social';
  if (imageCol && isHttpUrl(r[imageCol])) return 'foto';
  return '';
}

/* ---------- media per update: video's en social-media-embeds ---------- */
const SOCIAL_EMBEDS = [
  ['X', /(?:twitter\.com|x\.com)\/[^/\s"'<>]+\/status\/\d|twitter-tweet|twitter-component/i],
  ['Instagram', /instagram\.com\/(?:p|reel|tv)\/|instagram-media/i],
  ['YouTube', /youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=|shorts\/)|youtu\.be\//i],
  ['TikTok', /tiktok\.com\/@[^/\s"']+\/video|tiktok-embed/i],
  ['Facebook', /facebook\.com\/[^\s"'<>]+\/(?:posts|videos)\/|fb-post|fb-video/i],
  ['Bluesky', /bsky\.app\/profile\/[^/\s"']+\/post\/|bluesky-embed/i],
  ['Truth Social', /truthsocial\.com\/(?:@[^/\s"']+\/(?:posts\/)?\d|embed)/i],
  ['Threads', /threads\.(?:net|com)\/@[^/\s"']+\/post\//i],
  ['LinkedIn', /linkedin\.com\/(?:posts|embed\/feed)\//i]
];
const VIDEO_MARKERS = /<video\b|embed\.rtl\.nl|youtube(?:-nocookie)?\.com\/embed\/|player\.vimeo\.com|agnoplay|jwplayer|brightcove|dailymotion\.com\/embed|data-video-id|video-component|video-player|videoplayer/i;
// grafieken, kaarten en infographics: bekende embeddiensten of een bloktype in de API-data
const DATAVIZ_MARKERS = /datawrapper\.(?:dwcdn\.net|de)|flo\.uri\.sh|flourish\.studio|infogram\.com|public\.tableau\.com|everviz\.com|arcgis\.com|apelections\.org|localfocus|google\.com\/maps\/(?:d\/)?embed|"(?:blockType|type|_type)"\s*:\s*"[^"]*(?:chart|infogra|datawrapper|flourish|infogram)[^"]*"/i;

/** Herkent video's (incl. still) en social-embeds in de HTML van \u00e9\u00e9n update. */
function mediaFromHtml(html) {
  const raw = String(html || '').replace(/&amp;/g, '&');
  const social = SOCIAL_EMBEDS.filter(([, re]) => re.test(raw)).map(([name]) => name);
  let video = VIDEO_MARKERS.test(raw);
  let still = '';
  const poster = raw.match(/\b(?:poster|data-poster)=["'](https?:[^"']+)["']/i);
  if (poster) still = poster[1];
  const yt = raw.match(/(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/i);
  if (yt) {
    video = true;
    still = still || `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`;
  }
  if (video && !still) {
    const inPlayer = raw.match(/class=["'][^"']*(?:video|player)[^"']*["'][^>]*>[\s\S]{0,800}?<img[^>]+src=["'](https?:[^"']+)["']/i);
    if (inPlayer) still = inPlayer[1];
  }
  return { video, still, social, dataviz: DATAVIZ_MARKERS.test(raw) };
}

function mediaColumns(media) {
  return {
    video: media?.video ? 'ja' : '',
    video_still: media?.still || '',
    social: (media?.social || []).join(', '),
    dataviz: media?.dataviz ? 'ja' : ''
  };
}

const EXTRA_LIVEBLOG_HEADERS = ['artikel_link', 'artikel_links', 'link_premium', 'video', 'video_still', 'social', 'dataviz', 'woorden', 'blokken', 'embed_bronnen', 'update_opmaak'];

/** URL's van iframes en scripts in een embed (ook als src zonder https: of ge-escaped in JSON staat). */
const embedUrls = (html) => [...String(html || '').matchAll(/(?:src|data-src|url)\\?["']?\s*[=:]\s*\\?["']((?:https?:)?\/\/[^"'\\\s>]+)/gi)].map(mm => mm[1]);
// host plus begin van het pad, zodat ook eigen widgets van een site te onderscheiden zijn
const embedHosts = (html) => [...new Set(embedUrls(html)
  .map(u => { try { const x = new URL(u, 'https://x'); return x.hostname + x.pathname.split('/').slice(0, 7).join('/'); } catch { return ''; } })
  .filter(Boolean))].join(', ');

// NU.nl zet een vaste placeholder waar een interactieve widget (uitslagen, kaart) staat; die widget zit niet in de brondata
const PLACEHOLDER_IMAGE = /\/placeholder[-_]/i;
function fixPlaceholderMedia(rows) {
  rows.forEach(r => {
    if (!PLACEHOLDER_IMAGE.test(r.afbeelding || '')) return;
    r.afbeelding = '';
    if (!r.video && !r.social) r.dataviz = 'ja';
  });
  // eerder als 'link' opgeslagen grafieken (bv. LocalFocus bij DPG) zijn een datavisualisatie
  rows.forEach(r => {
    const all = String(r.artikel_links || r.artikel_link || '').split(/\s+/).filter(Boolean);
    const viz = all.filter(u => DATAVIZ_MARKERS.test(u));
    if (!viz.length) return;
    r.dataviz = 'ja';
    const rest = all.filter(u => !viz.includes(u));
    r.artikel_links = rest.join(' ');
    r.artikel_link = rest[0] || '';
  });
  return rows;
}
const withExtraHeaders = (headers) => [...headers, ...EXTRA_LIVEBLOG_HEADERS.filter(h => !headers.includes(h))];
// aantal woorden van kop en tekst samen
const wordCount = (...texts) => String(texts.filter(Boolean).join(' ')).split(/\s+/).filter(w => /\w/.test(w)).length;
// volledige tekst van een post; alleen de kaart kort hem in
const fullText = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** Tekst van een post met alinea's (lege regel ertussen) en links als [tekst](url); leeg als er geen alinea's of links in zitten. */
function richText(html, baseUrl = '') {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  doc.querySelectorAll('script, style, noscript, svg').forEach(x => x.remove());
  const absolute = (u) => { try { return new URL(u, baseUrl || undefined).href; } catch { return ''; } };
  const BLOCK = /^(P|DIV|H[1-6]|LI|UL|OL|BLOCKQUOTE|SECTION|ARTICLE|FIGURE|TABLE|TR)$/;
  const paras = [];
  let cur = '';
  const flush = () => { const t = cur.replace(/\s+/g, ' ').trim(); if (t) paras.push(t); cur = ''; };
  const walk = (n) => {
    if (n.nodeType === 3) { cur += n.nodeValue; return; }
    if (n.nodeType !== 1) return;
    if (n.tagName === 'BR') { flush(); return; }
    if (n.tagName === 'A') {
      const text = (n.textContent || '').replace(/\s+/g, ' ');
      const label = text.trim().replace(/[\[\]]/g, '');
      const href = absolute(n.getAttribute('href'));
      if (isHttpUrl(href) && label) cur += `${/^\s/.test(text) ? ' ' : ''}[${label}](${href.replace(/\)/g, '%29')})${/\s$/.test(text) ? ' ' : ''}`;
      else cur += text;
      return;
    }
    const block = BLOCK.test(n.tagName);
    if (block) flush();
    n.childNodes.forEach(walk);
    if (block) flush();
  };
  walk(doc.body);
  flush();
  return paras.length > 1 || paras.some(p => p.includes('](')) ? paras.join('\n\n') : '';
}

/* ---------- premium-status van gelinkte artikelen (via de extensie, met cache) ---------- */
// v3: DPG-premium via shortId; oude uitkomsten opnieuw laten controleren
const LINK_META_KEY = 'reconstruct.linkmeta.v3';
const linkMeta = (() => {
  try { return JSON.parse(localStorage.getItem(LINK_META_KEY) || '{}') || {}; } catch { return {}; }
})();

function isPaidArticleHtml(html, url = '') {
  const raw = String(html || '');
  // DPG: het artikel zelf staat in de paginadata als shortId + isPremium; de shortId zit in de URL (~b1a2b3c4)
  const shortId = String(url).match(/~[a-z]([0-9a-z]{6,8})(?:\/|$|\?)/i)?.[1];
  if (shortId) {
    const own = raw.match(new RegExp(`shortId\\\\?"\\s*:\\s*\\\\?"${shortId}\\\\?"[^{}]{0,200}?isPremium\\\\?"\\s*:\\s*(true|false)`, 'i'));
    if (own) return own[1].toLowerCase() === 'true';
  }
  // Next.js-sites zetten de JSON-LD ook ge-escapet in hun paginadata
  return /\\?"isAccessibleForFree\\?"\s*:\s*\\?"?false/i.test(raw)
    || /tmg-article_ispaidcontent"\s+content="true"/i.test(raw)
    || /<meta[^>]+content_tier[^>]+content=["'](?:locked|metered|premium)["']/i.test(raw);
}

// premium-status die de bron zelf meegeeft (bv. een artikelteaser in een DPG-post) hoeft niet opgehaald te worden
function rememberLinkPremium(url, premium) {
  if (!isHttpUrl(url)) return;
  linkMeta[url] = { premium, checked: Date.now(), source: 'bron' };
  try { localStorage.setItem(LINK_META_KEY, JSON.stringify(linkMeta)); } catch { /* vol */ }
}

// een post is 'premium' zodra één van zijn links naar een premium-artikel gaat; 'nee' pas als alle links bekend en vrij zijn
function applyLinkMeta() {
  let changed = false;
  state.rows.forEach(r => {
    const links = rowLinks(r);
    if (!links.length) return;
    const metas = links.map(u => linkMeta[u]);
    let value = '';
    if (metas.some(mt => mt && !mt.unchecked && mt.premium)) value = 'ja';
    else if (metas.every(mt => mt && !mt.unchecked && !mt.premium)) value = 'nee';
    else if (r.link_premium === 'ja') value = 'ja';
    if (value && r.link_premium !== value) { r.link_premium = value; changed = true; }
  });
  return changed;
}

let enrichingLinks = false;
async function enrichLinkPremium() {
  if (applyLinkMeta()) renderAll();
  if (enrichingLinks || !extensionBridge) return;
  const todo = [...new Set(state.rows.flatMap(rowLinks).filter(u => !linkMeta[u]))];
  if (!todo.length) return;
  enrichingLinks = true;
  try {
    for (const url of todo) {
      try {
        const html = await requestPage(url);
        linkMeta[url] = { premium: isPaidArticleHtml(html, url), checked: Date.now() };
        try { localStorage.setItem(LINK_META_KEY, JSON.stringify(linkMeta)); } catch { /* vol */ }
        if (applyLinkMeta()) scheduleTimeline();
      } catch (err) {
        console.warn('Premiumcontrole mislukt voor', url, '-', err?.message || err);
        // buitenlandse sites e.d. zijn niet te controleren; niet elke keer opnieuw proberen
        if (err?.noAccess) {
          linkMeta[url] = { unchecked: true, checked: Date.now() };
          try { localStorage.setItem(LINK_META_KEY, JSON.stringify(linkMeta)); } catch { /* vol */ }
          continue;
        }
      }
      // rustig tempo richting de uitgever
      await new Promise(r => setTimeout(r, 1200));
    }
  } finally {
    enrichingLinks = false;
    renderAll();
  }
}

function normalizeBrandName(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const lower = s.toLowerCase();
  if (/\bnu\b|nu\.nl/.test(lower)) return 'NU.nl';
  if (/algemeen\s+dagblad|\bad\b/.test(lower)) return 'AD';
  if (/volkskrant/.test(lower)) return 'de Volkskrant';
  if (/trouw/.test(lower)) return 'Trouw';
  if (/parool/.test(lower)) return 'Het Parool';
  if (/demorgen|de\s+morgen/.test(lower)) return 'De Morgen';
  if (/hln|het\s+laatste\s+nieuws/.test(lower)) return 'HLN';
  if (/rtl\s*nieuws|rtlnieuws|\brtl\b/.test(lower)) return 'RTL Nieuws';
  if (/telegraaf/.test(lower)) return 'De Telegraaf';
  return clipText(s, 40);
}

function detectBrandFromUrl(url) {
  if (!isHttpUrl(url)) return '';
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('nu.nl')) return 'NU.nl';
    if (host.includes('ad.nl')) return 'AD';
    if (host.includes('volkskrant.nl')) return 'de Volkskrant';
    if (host.includes('trouw.nl')) return 'Trouw';
    if (host.includes('parool.nl')) return 'Het Parool';
    if (host.includes('demorgen.be')) return 'De Morgen';
    if (host.includes('hln.be')) return 'HLN';
    if (host.includes('rtlnieuws.nl') || host.includes('rtl.nl')) return 'RTL Nieuws';
    if (host.includes('telegraaf.nl')) return 'De Telegraaf';
  } catch {
    // ignore malformed urls
  }
  return '';
}

function detectBrandFromHtmlDoc(doc) {
  const cls = doc?.documentElement?.className || '';
  const m = cls.match(/\bbrand--([a-z0-9-]+)\b/i);
  if (m) {
    const fromClass = normalizeBrandName(m[1].toUpperCase().replace(/-/g, ' '));
    if (fromClass) return fromClass;
  }

  const siteName = doc?.querySelector('meta[property="og:site_name"]')?.getAttribute('content')
    || doc?.querySelector('meta[name="application-name"]')?.getAttribute('content')
    || '';
  const fromMeta = normalizeBrandName(siteName);
  if (fromMeta) return fromMeta;

  const canonical = doc?.querySelector('link[rel="canonical"]')?.getAttribute('href')
    || doc?.querySelector('meta[property="og:url"]')?.getAttribute('content')
    || '';
  const fromUrl = detectBrandFromUrl(canonical);
  if (fromUrl) return fromUrl;

  return 'LIVEBLOG';
}

function imageUrlFromSchema(node) {
  if (!node) return '';
  if (typeof node === 'string') return isHttpUrl(node) ? node : '';
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = imageUrlFromSchema(item);
      if (found) return found;
    }
    return '';
  }
  if (typeof node === 'object') {
    const srcSetHead = String(node.srcSet || node.srcset || '').split(',')[0]?.trim().split(/\s+/)[0] || '';
    const nestedSrcSetHead = String(node.imgProps?.srcSet || node.imgProps?.srcset || node.pictureProps?.imgProps?.srcSet || '').split(',')[0]?.trim().split(/\s+/)[0] || '';
    const candidates = [
      node.url,
      node.contentUrl,
      node.imageUrl,
      node.thumbnailUrl,
      node.src,
      node.poster,
      node.posterUrl,
      node.imgProps?.src,
      node.pictureProps?.imgProps?.src,
      srcSetHead,
      nestedSrcSetHead,
      node['@id']
    ];
    for (const c of candidates) {
      if (isHttpUrl(c)) return c;
    }

    const nested = [
      node.image,
      node.thumbnail,
      node.posterImage,
      node.imgProps,
      node.pictureProps,
      node.properties,
      node.media,
      node.asset
    ];
    for (const item of nested) {
      const found = imageUrlFromSchema(item);
      if (found) return found;
    }
  }
  return '';
}

function videoStillFromSchema(node) {
  if (!node) return '';
  if (typeof node === 'string') {
    return isLikelyImageStillUrl(node) ? node : '';
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = videoStillFromSchema(item);
      if (found) return found;
    }
    return '';
  }
  if (typeof node === 'object') {
    const direct = [
      node.thumbnailUrl,
      node.poster,
      node.posterUrl,
      node.previewImageUrl,
      node.teaserImageUrl,
      node.url,
      node.contentUrl
    ];
    for (const c of direct) {
      const found = videoStillFromSchema(c);
      if (found) return found;
    }
    const nested = [node.thumbnail, node.image, node.previewImage, node.posterImage];
    for (const n of nested) {
      const found = imageUrlFromSchema(n) || videoStillFromSchema(n);
      if (found) return found;
    }
  }
  return '';
}

function firstImageFromHtml(html) {
  const raw = String(html || '').replace(/&amp;/g, '&');
  if (!raw) return '';

  const direct = raw.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (direct && isHttpUrl(direct[1])) return direct[1];

  const dataSrc = raw.match(/<img[^>]+data-(?:src|original|lazy-src)=["']([^"']+)["']/i);
  if (dataSrc && isHttpUrl(dataSrc[1])) return dataSrc[1];

  const srcSet = raw.match(/<img[^>]+(?:srcset|data-srcset|imagesrcset)=["']([^"']+)["']/i);
  if (srcSet) {
    const first = String(srcSet[1]).split(',')[0]?.trim().split(/\s+/)[0] || '';
    if (isHttpUrl(first)) return first;
  }

  const sourceSet = raw.match(/<source[^>]+srcset=["']([^"']+)["']/i);
  if (sourceSet) {
    const first = String(sourceSet[1]).split(',')[0]?.trim().split(/\s+/)[0] || '';
    if (isHttpUrl(first)) return first;
  }

  return '';
}

function firstVideoStillFromHtml(html) {
  const raw = String(html || '');
  if (!raw) return '';

  const poster = raw.match(/<video[^>]+poster=["']([^"']+)["']/i);
  if (poster && isHttpUrl(poster[1])) return poster[1];

  const thumb = raw.match(/<(?:source|meta)[^>]+(?:thumbnailUrl|thumbnail|content)=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/i);
  if (thumb && isHttpUrl(thumb[1])) return thumb[1];

  const bg = raw.match(/background(?:-image)?\s*:\s*url\((['"]?)(?<u>https?:[^'")]+)\1\)/i);
  if (bg && isHttpUrl(bg.groups?.u)) return bg.groups.u;

  const img = raw.match(/<img[^>]+src=["'](?<u>https?:[^"']+)["']/i);
  if (img && isHttpUrl(img.groups?.u)) return img.groups.u;

  return '';
}

// Zoekt een videostill in het gerenderde paginablok dat bij deze update hoort (video-widgets
// vullen hun poster pas na JS-hydratie, dus die zit niet altijd in de JSON-LD articleBody zelf).
function videoStillFromPageContext(pageHtml, articleBodyHtml) {
  const page = String(pageHtml || '');
  const body = String(articleBodyHtml || '').trim();
  if (!page || !body || body.length < 12) return '';

  const anchor = body.slice(0, Math.min(80, body.length));
  const idx = page.indexOf(anchor);
  if (idx === -1) return '';

  const windowEnd = Math.min(page.length, idx + anchor.length + 4000);
  const windowChunk = page.slice(idx, windowEnd);

  const videoBlockRe = /data-content-type=["']VIDEO["']/i;
  const videoMatch = videoBlockRe.exec(windowChunk);
  if (!videoMatch) return '';

  const blockStart = videoMatch.index;
  const blockEnd = Math.min(windowChunk.length, blockStart + 3000);
  const block = windowChunk.slice(blockStart, blockEnd);

  return firstVideoStillFromHtml(block);
}

function decodeEscapedUrl(v) {
  const s = String(v || '');
  if (!s) return '';
  return s
    .replace(/\\\//g, '/')
    .replace(/\\u0026/g, '&')
    .replace(/\\u003d/g, '=')
    .replace(/\\u003f/g, '?')
    .replace(/\\u0025/g, '%');
}

function isLikelyImageStillUrl(url) {
  if (!isHttpUrl(url)) return false;
  if (/\.(mp4|webm|m3u8)(\?|$)/i.test(url)) return false;
  if (/\.(jpg|jpeg|png|webp|avif|gif)(\?|$)/i.test(url)) return true;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();
    if (/(^|\.)(images|image|img|cdn|media)\./.test(host)) return true;
    if (/(?:\/fit-|\/focus-|\/fill\/|\/crop\/|\/image\/)/.test(path)) return true;
  } catch {
    return false;
  }
  return false;
}

function pickBestImageUrl(urls) {
  const uniq = [...new Set((urls || []).filter(Boolean))];
  return uniq.find(u => isLikelyImageStillUrl(u) && /\.(jpg|jpeg|png|webp|avif|gif)(\?|$)/i.test(u))
    || uniq.find(u => isLikelyImageStillUrl(u) && /https?:\/\/(images\.|image\.|cdn\.|img\.|media\.)/i.test(u))
    || uniq.find(u => isLikelyImageStillUrl(u))
    || uniq.find(u => /https?:\/\//i.test(u))
    || '';
}

function collectImageUrls(chunk) {
  const out = [];
  if (!chunk) return out;

  const mediaMarkerRe = /(?:\\"|\")type(?:\\"|\")\s*:\s*(?:\\"|\")(?<t>IMAGE|PHOTO|FIGURE|MEDIA_IMAGE|INLINE_IMAGE|VIDEO|VIDEO_ITEM|MEDIA_VIDEO|INLINE_VIDEO)(?:\\"|\")|(?:\\"|\")hasPhotoViewer(?:\\"|\")\s*:\s*true/ig;

  const rxEscaped = /\\"(?:url|src|imageUrl|thumbnailUrl|originalUrl|heroImageUrl|poster|posterUrl|previewImageUrl|teaserImageUrl)\\"\s*:\s*\\"(?<u>https?:[^\\"]+)\\"/ig;
  const rxPlain = /"(?:url|src|imageUrl|thumbnailUrl|originalUrl|heroImageUrl|poster|posterUrl|previewImageUrl|teaserImageUrl)"\s*:\s*"(?<u>https?:[^\"]+)"/ig;
  const rxSrcSetEscaped = /\\"(?:srcSet|srcset)\\"\s*:\s*\\"(?<u>https?:[^\\"]+)\\"/ig;
  const rxSrcSetPlain = /"(?:srcSet|srcset)"\s*:\s*"(?<u>https?:[^\"]+)"/ig;

  let marker;
  while ((marker = mediaMarkerRe.exec(chunk)) !== null) {
    const start = Math.max(0, marker.index - 1200);
    const end = Math.min(chunk.length, marker.index + 2400);
    const local = chunk.slice(start, end);

    let m;
    while ((m = rxEscaped.exec(local)) !== null) out.push(decodeEscapedUrl(m.groups?.u || ''));
    while ((m = rxPlain.exec(local)) !== null) out.push(decodeEscapedUrl(m.groups?.u || ''));
    while ((m = rxSrcSetEscaped.exec(local)) !== null) {
      const urls = decodeEscapedUrl(m.groups?.u || '').split(',').map(p => p.trim().split(/\s+/)[0]).filter(Boolean);
      out.push(...urls);
    }
    while ((m = rxSrcSetPlain.exec(local)) !== null) {
      const urls = decodeEscapedUrl(m.groups?.u || '').split(',').map(p => p.trim().split(/\s+/)[0]).filter(Boolean);
      out.push(...urls);
    }
  }
  return out.filter(isLikelyImageStillUrl);
}

function adImageMapFromEmbeddedState(rawHtml, timestamps = []) {
  const raw = String(rawHtml || '');
  if (!raw) return new Map();

  const map = new Map();
  const momentRe = /\\"timestamp\\":\\"(?<ts>[^\\"]+)\\"(?<tail>[\s\S]{0,9000}?)\\"checksum\\":\\"/g;
  let mm;
  while ((mm = momentRe.exec(raw)) !== null) {
    const ts = mm.groups?.ts;
    const tail = mm.groups?.tail || '';
    if (!ts) continue;

    const preferred = pickBestImageUrl(collectImageUrls(tail));
    if (isHttpUrl(preferred)) {
      map.set(ts, preferred);
    }
  }

  // Fallback voor VK/AD varianten waar geen checksum-marker per moment staat.
  timestamps.forEach(ts => {
    if (!ts || map.has(ts)) return;
    const esc = ts.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const finder = new RegExp(`(?:\\\\\"|\")timestamp(?:\\\\\"|\")\\s*:\\s*(?:\\\\\"|\")${esc}(?:\\\\\"|\")`, 'g');
    const candidates = [];
    let hit;
    while ((hit = finder.exec(raw)) !== null) {
      const start = Math.max(0, hit.index - 120);
      const nextTsRe = /(?:\\"|")timestamp(?:\\"|")\s*:\s*(?:\\"|")[^\"]+(?:\\"|")/g;
      nextTsRe.lastIndex = hit.index + 10;
      const next = nextTsRe.exec(raw);
      const naturalEnd = next ? next.index : (hit.index + 9000);
      const end = Math.min(raw.length, naturalEnd);
      const chunk = raw.slice(start, end);
      candidates.push(...collectImageUrls(chunk));
      if (candidates.length > 12) break;
    }
    const preferred = pickBestImageUrl(candidates);
    if (isHttpUrl(preferred)) map.set(ts, preferred);
  });

  return map;
}

/** Posts in de DOM: het grootste blok rond elke tijdsaanduiding dat geen andere tijd bevat, met de meest voorkomende vorm. */
function domLiveblogPosts(doc, anchors = []) {
  const withDatetime = postBlocks(doc, [...doc.querySelectorAll('time[datetime]')]
    .filter(t => Number.isFinite(Date.parse(t.getAttribute('datetime')))),
  (t) => t.getAttribute('datetime'));
  if (withDatetime.length) return withDatetime.map(f => ({ ...f, ...postText(f.el) }));

  // o.a. AD: alleen '03:26' als tekst, soms met '4 november 2026' erbij; de datum leiden we af
  const isClock = (el) => !el.children.length && /^\d{1,2}:\d{2}$/.test((el.textContent || '').trim());
  const clocks = [...doc.body.querySelectorAll('p, span, div, time')].filter(isClock);
  const blocks = postBlocks(doc, clocks, (el) => el.textContent.trim());
  if (!blocks.length) return [];

  const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 40);
  const anchorDate = new Map();
  anchors.forEach(a => {
    const date = localDateOf(parseTime(a.tijd));
    [a.titel, a.update_tekst].forEach(t => { if (norm(t).length >= 20) anchorDate.set(norm(t), date); });
  });

  let date = anchors.length ? localDateOf(Math.max(...anchors.map(a => parseTime(a.tijd)))) : localDateOf(Date.now() / 60000);
  let prevClock = null;
  const out = [];
  blocks.forEach(b => {
    const [hh, mm] = b.time.split(':').map(Number);
    const clock = hh * 60 + mm;
    const text = postText(b.el);
    const dateRe = new RegExp(`^(\\d{1,2})\\s+(${MONTHS.join('|')})\\s+(\\d{4})$`, 'i');
    const explicit = [...b.el.querySelectorAll('p, span, div, time')]
      .filter(x => !x.children.length)
      .map(x => (x.textContent || '').trim().match(dateRe))
      .find(Boolean);
    const anchored = anchorDate.get(norm(text.headline)) || anchorDate.get(norm(text.body));
    if (explicit) {
      date = `${explicit[3]}-${String(MONTHS.indexOf(explicit[2].toLowerCase()) + 1).padStart(2, '0')}-${String(explicit[1]).padStart(2, '0')}`;
    } else if (anchored) {
      date = anchored;
    } else if (prevClock !== null && clock > prevClock) {
      // nieuwste bovenaan: een later kloktijdstip dan de vorige post betekent een dag eerder
      date = addDays(date, -1);
    }
    prevClock = clock;
    const start = dayStartMinutes(date);
    if (start === null) return;
    out.push({ el: b.el, time: new Date((start + clock) * 60000).toISOString(), ...text });
  });
  return out;
}

function postBlocks(doc, markers, timeOf) {
  const markerSet = new Set(markers);
  const countIn = (el) => { let n = 0; for (const mk of markerSet) if (el.contains(mk)) n++; return n; };
  const found = [];
  markers.forEach(t => {
    let cur = t;
    while (cur.parentElement && cur.parentElement !== doc.body && countIn(cur.parentElement) === 1) cur = cur.parentElement;
    if (cur === t) return;
    found.push({ el: cur, time: timeOf(t), sig: `${cur.tagName}.${cur.className}` });
  });
  const counts = new Map();
  found.forEach(f => counts.set(f.sig, (counts.get(f.sig) || 0) + 1));
  const [bestSig, bestCount] = [...counts].sort((a, b) => b[1] - a[1])[0] || [];
  if (!bestSig || bestCount < 3) return [];
  return found.filter(f => f.sig === bestSig);
}

function postText(el) {
  const clone = el.cloneNode(true);
  clone.querySelectorAll('time, button, svg, script, style, noscript, figcaption, [aria-hidden="true"], .sr-only, [class*="author"]')
    .forEach(x => x.remove());
  // losse tijd- en datumregels horen niet bij de tekst
  [...clone.querySelectorAll('p, span, div')]
    .filter(x => !x.children.length && /^(\d{1,2}:\d{2}|\d{1,2}\s+\p{L}+\s+\d{4})$/u.test((x.textContent || '').trim()))
    .forEach(x => x.remove());
  // blokgrenzen als spatie, anders plakt textContent kop en eerste zin aan elkaar
  clone.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li, br, blockquote').forEach(x => x.after(' '));
  const headline = (clone.querySelector('h1, h2, h3, h4')?.textContent || '').replace(/\s+/g, ' ').trim() || leadHeadlineFromHtml(clone.innerHTML);
  let body = (clone.textContent || '').replace(/\s+/g, ' ').trim();
  if (headline && body.startsWith(headline)) body = body.slice(headline.length).trim();
  return { headline, body };
}

/** Standaardkolommen van een geïmporteerd liveblog. */
function liveblogHeaders() {
  return [
    'merk', 'bron', 'tijd', 'titel', 'article_type', 'article_url', 'afbeelding', 'liveblog_titel', 'update_tekst',
    'update_nummer', 'minuten_sinds_start', 'minuten_sinds_vorige'
  ];
}

/** Rijen moeten op tijd gesorteerd zijn; vult postnummer en minuten sinds start/vorige post. */
function numberLiveblogRows(rows) {
  const firstMinute = parseTime(rows[0].tijd);
  rows.forEach((r, i) => {
    const minute = parseTime(r.tijd);
    const prevMinute = i > 0 ? parseTime(rows[i - 1].tijd) : minute;
    r.update_nummer = String(i + 1);
    r.minuten_sinds_start = String(Math.max(0, Math.round(minute - firstMinute)));
    r.minuten_sinds_vorige = String(Math.max(0, Math.round(minute - prevMinute)));
  });
}

function tryParseLiveblogHtml(text) {
  const raw = String(text || '');
  if (!/<html[\s>]/i.test(raw) || !/application\/ld\+json/i.test(raw)) return null;

  const doc = new DOMParser().parseFromString(raw, 'text/html');
  const scripts = [...doc.querySelectorAll('script[type="application/ld+json"]')];
  if (!scripts.length) return null;

  const graphNodes = [];
  scripts.forEach(sc => {
    const jsonText = (sc.textContent || '').trim();
    if (!jsonText) return;
    try {
      const parsed = JSON.parse(jsonText);
      if (Array.isArray(parsed)) {
        parsed.forEach(v => graphNodes.push(v));
      } else if (Array.isArray(parsed?.['@graph'])) {
        parsed['@graph'].forEach(v => graphNodes.push(v));
      } else {
        graphNodes.push(parsed);
      }
    } catch {
      // Some pages include non-JSON-safe ld+json fragments; skip those blocks.
    }
  });

  if (!graphNodes.length) return null;

  const hasType = (node, type) => {
    const t = node?.['@type'];
    if (Array.isArray(t)) return t.includes(type);
    return t === type;
  };

  const idMap = new Map();
  graphNodes.forEach(n => {
    const id = n?.['@id'];
    if (id) idMap.set(id, n);
  });

  const resolveNode = (v) => {
    if (!v) return null;
    if (typeof v === 'string') return idMap.get(v) || null;
    if (typeof v === 'object' && v['@id'] && Object.keys(v).length <= 2) {
      return idMap.get(v['@id']) || null;
    }
    return v;
  };

  const asArray = (v) => Array.isArray(v) ? v : (v ? [v] : []);

  const live = graphNodes.find(n => hasType(n, 'LiveBlogPosting'))
    || graphNodes.find(n => n?.liveBlogUpdate || n?.blogPost || n?.hasPart || n?.itemListElement);
  if (!live) return null;

  const rawCandidates = [
    ...asArray(live.liveBlogUpdate),
    ...asArray(live.blogPost),
    ...asArray(live.hasPart),
    ...asArray(live.itemListElement)
  ];

  let updatesRaw = rawCandidates
    .map(resolveNode)
    .filter(Boolean)
    .map(n => {
      if (n?.item && typeof n.item === 'object') return resolveNode(n.item) || n.item;
      if (n?.mainEntity && typeof n.mainEntity === 'object') return resolveNode(n.mainEntity) || n.mainEntity;
      return n;
    })
    .filter(n => hasType(n, 'BlogPosting') || n?.datePublished || n?.articleBody);

  if (!updatesRaw.length) {
    updatesRaw = graphNodes.filter(n => hasType(n, 'BlogPosting') && (n?.datePublished || n?.articleBody));
  }
  if (!updatesRaw.length) return null;

  const publisherName = normalizeBrandName(live?.publisher?.name || updatesRaw.find(u => u?.publisher?.name)?.publisher?.name || '');
  // Uitgeversnaam uit JSON-LD (bijv. "Mediahuis Netherlands") is vaak een holding, niet het merk zelf;
  // merk uit de pagina (og:site_name/canonical host) is specifieker en krijgt voorrang.
  const docBrand = detectBrandFromHtmlDoc(doc);
  const sourceBrand = (docBrand && docBrand !== 'LIVEBLOG') ? docBrand : (publisherName || docBrand);
  const canonicalUrl = doc?.querySelector('link[rel="canonical"]')?.getAttribute('href')
    || doc?.querySelector('meta[property="og:url"]')?.getAttribute('content')
    || '';
  const updateTimes = updatesRaw
    .map(u => String(u?.datePublished || u?.dateModified || '').trim())
    .filter(Boolean);
  const adImageMap = adImageMapFromEmbeddedState(raw, updateTimes);
  const liveTitleRaw = stripHtmlTags(live?.headline || live?.name || '');
  const liveTitle = clipText(liveTitleRaw || `${sourceBrand} liveblog`, 72);

  // Per update het bijbehorende blok in de pagina zoeken (links, video's en embeds staan vaak alleen daar).
  const normText = (s) => String(s || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  const textBlocks = [...doc.querySelectorAll('p, li, div')]
    .filter(el => !el.querySelector('p, li, div, section, article'))
    .map(el => ({ el, text: normText(el.textContent) }))
    .filter(x => x.text.length > 20);
  const blockFor = (bodyText, headline) => {
    let body = normText(bodyText);
    if (headline && body.startsWith(headline)) body = body.slice(headline.length).trim();
    const key = body.slice(0, 60);
    if (key.length < 20) return null;
    return textBlocks.find(x => x.text.startsWith(key) || key.startsWith(x.text.slice(0, 60)))?.el || null;
  };
  // NU.nl: de vastgezette samenvatting (lijstje) staat boven de kop 'Liveblog' en is zelf geen post
  const liveHeading = doc.querySelector('.heading--liveblog');
  const belowHeading = (el) => !!(liveHeading.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
  const isPinnedSummary = (u) => {
    if (!liveHeading) return false;
    const first = String(u?.articleBody || '').split(/\r?\n/).map(normText).find(Boolean) || '';
    if (first.length < 15) return false;
    const above = textBlocks.some(x => !belowHeading(x.el) && x.text.startsWith(first));
    const below = textBlocks.some(x => belowHeading(x.el) && x.text.includes(first));
    return above && !below;
  };
  const pinned = new Set(updatesRaw.filter(isPinnedSummary));
  const hits = updatesRaw.map(u => blockFor(stripHtmlTags(u?.articleBody || ''), stripHtmlTags(u?.headline || '')));
  const hitSet = new Set(hits.filter(Boolean));
  // zo hoog mogelijk in de boom, zolang er geen tekst van een andere update in het blok komt
  const containerFor = (el) => {
    if (!el) return null;
    if (hitSet.size < 2) return el.parentElement || el;
    let cur = el;
    while (cur.parentElement && cur.parentElement !== doc.body) {
      const par = cur.parentElement;
      let other = false;
      for (const h of hitSet) if (h !== el && par.contains(h)) { other = true; break; }
      if (other) break;
      cur = par;
    }
    return cur;
  };
  const containers = hits.map(containerFor);
  const linksFromContainer = (box) => !box ? [] : [...box.querySelectorAll('a[href]')]
    .map(a => { try { return new URL(a.getAttribute('href'), canonicalUrl || 'https://invalid.local/').href; } catch { return ''; } })
    .filter(h => isArticleLink(h, canonicalUrl));

  const rows = updatesRaw.map((u, idx) => {
    if (pinned.has(u)) return null;
    const box = containers[idx];
    const shared = asArray(u?.sharedContent);
    const media = mediaFromHtml([
      u?.articleBody || '',
      box?.outerHTML || '',
      shared.map(sc => sc?.url || '').join(' ')
    ].join(' '));
    // gedeelde video-pagina's (o.a. Telegraaf) tellen als video, met hun thumbnail als still
    const sharedVideo = shared.find(sc => /\/video\//i.test(String(sc?.url || '')));
    if (sharedVideo) {
      media.video = true;
      media.still = media.still || imageUrlFromSchema(sharedVideo.thumbnailUrl || sharedVideo.image);
    }
    // Alleen beelden die bij de update zelf horen, niet het algemene liveblog-hoofdbeeld.
    const imageUrl = imageUrlFromSchema(u?.image)
      || videoStillFromSchema(u?.video)
      || videoStillFromSchema(u?.associatedMedia)
      || imageUrlFromSchema(shared.map(sc => sc?.thumbnailUrl || sc?.image))
      || firstVideoStillFromHtml(u?.articleBody)
      || firstImageFromHtml(u?.articleBody)
      || videoStillFromPageContext(raw, u?.articleBody)
      || adImageMap.get(String(u?.datePublished || '').trim())
      || adImageMap.get(String(u?.dateModified || '').trim())
      || media.still
      || firstImageFromHtml(box?.outerHTML)
      || '';
    const bodyAll = stripHtmlTags(u?.articleBody || '');
    // zonder aparte kop in de data: een kopje of vetgedrukte eerste regel van de post is de kop
    const lead = stripHtmlTags(u?.headline || '') ? '' : leadHeadlineFromHtml(u?.articleBody);
    const body = lead && bodyAll.startsWith(lead) ? bodyAll.slice(lead.length).trim() : bodyAll;
    const updateHeadline = stripHtmlTags(u?.headline || '') || lead;
    const title = clipText(updateHeadline || summarizeUpdateText(body) || `Liveblog update ${idx + 1}`, 150);
    return {
      merk: sourceBrand,
      bron: sourceBrand,
      tijd: String(u?.datePublished || u?.dateModified || '').trim(),
      titel: title,
      article_type: 'LIVE_BLOG',
      article_url: String(u?.mainEntityOfPage || live?.mainEntityOfPage || canonicalUrl || '').trim(),
      afbeelding: imageUrl,
      liveblog_titel: liveTitle,
      update_tekst: fullText(body),
      update_opmaak: richText(u?.articleBody, canonicalUrl),
      ...linkFields(
        articleLinksFromContent(u?.articleBody, canonicalUrl),
        shared.map(sc => sc?.url).filter(x => isArticleLink(x, canonicalUrl)),
        linksFromContainer(box)
      ),
      woorden: String(wordCount(updateHeadline, body)),
      ...mediaColumns(media)
    };
  }).filter(r => r && parseTime(r.tijd) !== null);

  // JSON-LD bevat alleen de nieuwste updates; via de extensie opengeklapte oudere posts staan alleen in de DOM
  // sommige sites tonen alleen hele minuten, dus op minuut vergelijken
  const minuteOf = (t) => Math.floor(Date.parse(t) / 60000);
  const knownMinutes = new Set(rows.map(r => minuteOf(r.tijd)));
  domLiveblogPosts(doc, rows).forEach(p => {
    const min = minuteOf(p.time);
    if (knownMinutes.has(min)) return;
    knownMinutes.add(min);
    const html = p.el.outerHTML;
    const media = mediaFromHtml(html);
    rows.push({
      merk: sourceBrand,
      bron: sourceBrand,
      tijd: p.time,
      titel: clipText(p.headline || summarizeUpdateText(p.body) || 'Liveblog update', 150),
      article_type: 'LIVE_BLOG',
      article_url: String(live?.mainEntityOfPage || canonicalUrl || '').trim(),
      afbeelding: media.still || firstImageFromHtml(html) || '',
      liveblog_titel: liveTitle,
      update_tekst: fullText(p.body),
      ...linkFields(linksFromContainer(p.el)),
      woorden: String(wordCount(p.headline, p.body)),
      ...mediaColumns(media)
    });
  });

  if (!rows.length) return null;
  // Bronvolgorde is vrijwel altijd nieuwste-eerst; bij identieke tijdstippen is dat de tie-break.
  rows.forEach((r, i) => { r.__srcIdx = i; });
  rows.sort((a, b) => (parseTime(a.tijd) - parseTime(b.tijd)) || (b.__srcIdx - a.__srcIdx));

  numberLiveblogRows(rows);

  return {
    headers: liveblogHeaders(),
    rows
  };
}

/** VRT NWS: alle posts staan als blokken in __NEXT_DATA__ (tekst, video, beeld, embed, 'lees ook'); JSON-LD mist video en links. */
function tryParseVrtLiveblog(text) {
  const raw = String(text || '');
  if (!/"liveBlogPost"/.test(raw)) return null;
  const json = raw.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!json) return null;
  const posts = [];
  const walk = (o) => {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === 'object') {
      if (o.type === 'liveBlogPost') posts.push(o);
      else Object.values(o).forEach(walk);
    }
  };
  walk(JSON.parse(json));
  if (!posts.length) return null;

  const doc = new DOMParser().parseFromString(raw, 'text/html');
  const canonicalUrl = sourceUrlFromHtml(raw);
  const sourceBrand = detectBrandFromUrl(canonicalUrl) || detectBrandFromHtmlDoc(doc) || 'LIVEBLOG';
  const liveTitle = clipText(stripHtmlTags(doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || doc.title || ''), 72) || `${sourceBrand} liveblog`;

  const rows = posts.map(p => {
    const blocks = Array.isArray(p.compositions) ? p.compositions : [];
    const of = (type) => blocks.filter(b => b.type === type);
    const title = stripHtmlTags(of('liveBlogPostTitle')[0]?.title?.text || '');
    const textHtml = of('liveBlogPostText').map(b => b.text?.html || '').join(' ');
    const quotes = of('liveBlogPostQuote').map(b => `${b.title?.text || ''} ${b.subtitle?.text || ''}`).join(' ');
    const body = stripHtmlTags(`${textHtml} ${quotes}`).replace(/\s+/g, ' ').trim();
    const videos = of('liveBlogPostVideo');
    const media = mediaFromHtml(of('liveBlogPostEmbed').map(b => b.html || '').join(' '));
    if (videos.length) {
      media.video = true;
      media.still = media.still || videos[0].action?.image?.url || '';
    }
    const image = of('liveBlogPostImage')[0]?.image?.url || '';
    const teaserLinks = of('liveBlogPostInternalTeaser').flatMap(b => (b.actions || []).map(a => a.uri)).filter(isHttpUrl);
    const stamp = p.metadata?.find(x => x.type === 'time')?.timestamp;
    return {
      merk: sourceBrand,
      bron: sourceBrand,
      tijd: p.seo?.publishedOn || (stamp ? new Date(stamp).toISOString() : ''),
      titel: clipText(title || summarizeUpdateText(body) || 'Liveblog update', 150),
      article_type: 'LIVE_BLOG',
      article_url: canonicalUrl,
      afbeelding: image || media.still,
      liveblog_titel: liveTitle,
      update_tekst: fullText(body),
      update_opmaak: richText(`${textHtml}<p>${esc(quotes)}</p>`, canonicalUrl),
      ...linkFields(articleLinksFromContent(textHtml, canonicalUrl), teaserLinks.filter(u => isArticleLink(u, canonicalUrl))),
      woorden: String(wordCount(title, body)),
      ...mediaColumns(media)
    };
  }).filter(r => parseTime(r.tijd) !== null);
  if (!rows.length) return null;

  rows.forEach((r, i) => { r.__srcIdx = i; });
  rows.sort((a, b) => (parseTime(a.tijd) - parseTime(b.tijd)) || (b.__srcIdx - a.__srcIdx));
  numberLiveblogRows(rows);
  return {
    headers: liveblogHeaders(),
    rows,
    // volledige bron: bij verversen geen oude waarden (zoals een eerder gevonden auteursfoto) bewaren
    authoritative: true
  };
}

function tryParseLiveblogPlainText(text) {
  const normalizeLine = (l) => String(l ?? '')
    .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, ' ')
    .replace(/\u2013|\u2014/g, '-')
    .trim()
    .replace(/^#{1,6}\s*/, '');

  const raw = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!raw.trim()) return null;
  if (/<html[\s>]/i.test(raw)) return null;

  const lines = raw.split('\n').map(normalizeLine);
  const monthMap = {
    januari: 1, februari: 2, maart: 3, april: 4, mei: 5, juni: 6,
    juli: 7, augustus: 8, september: 9, oktober: 10, november: 11, december: 12
  };

  const parseDateLine = (line) => {
    const m = String(line || '').toLowerCase().match(/^(\d{1,2})\s+([a-z\u00e0-\u00ff]+)\s+(\d{4})$/i);
    if (!m) return null;
    const d = +m[1], mo = monthMap[m[2]], y = +m[3];
    if (!d || !mo || !y) return null;
    return `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  // ook kopjes als 'Ma om 17.24 u', 'Gisteren om 09:12' of '17 nov om 17.24 uur' (o.a. NU.nl)
  const timeRe = /^(?:(?<day>ma|di|wo|do|vr|za|zo|maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|vandaag|gisteren|eergisteren)\.?\s+)?(?:(?<dd>\d{1,2})\s+(?<mon>[a-z]{3,})\.?(?:\s+(?<yy>\d{4}))?\s+)?(?:om\s+)?(?<hh>[01]?\d|2[0-3])[:.](?<mm>[0-5]\d)(?:\s*(?:u|uur))?$/i;
  const todayParts = (() => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: NEWS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
        .format(new Date()).split('-').map(Number);
    } catch {
      const d = new Date();
      return [d.getFullYear(), d.getMonth() + 1, d.getDate()];
    }
  })();
  const todayUtc = Date.UTC(todayParts[0], todayParts[1] - 1, todayParts[2]);
  const dayIdx = { zo: 0, ma: 1, di: 2, wo: 3, do: 4, vr: 5, za: 6 };
  const dateFromHeader = (g) => {
    if (g?.dd && g?.mon) {
      const mk = Object.keys(monthMap).find(k => k.startsWith(g.mon.toLowerCase().slice(0, 3)));
      if (mk) return `${g.yy || todayParts[0]}-${String(monthMap[mk]).padStart(2, '0')}-${String(+g.dd).padStart(2, '0')}`;
    }
    const day = String(g?.day || '').toLowerCase();
    if (!day) return '';
    let back = 0;
    if (day === 'gisteren') back = 1;
    else if (day === 'eergisteren') back = 2;
    else if (day !== 'vandaag') back = (new Date(todayUtc).getUTCDay() - dayIdx[day.slice(0, 2)] + 7) % 7;
    return new Date(todayUtc - back * 86400000).toISOString().slice(0, 10);
  };
  const mdLinkToText = (l) => l.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '$1');
  const imageMdRe = /^!\[[^\]]*\]\((?<u>https?:[^)\s]+)\)/i;
  const urlRe = /(https?:\/\/[^\s)]+)/ig;

  const allUrls = [...raw.matchAll(urlRe)].map(m => m[1]).filter(isHttpUrl);
  const mainUrl = allUrls.find(u => /rtlnieuws\.nl|rtl\.nl|ad\.nl|volkskrant\.nl|nu\.nl|trouw\.nl|parool\.nl/i.test(u)) || allUrls[0] || '';
  const sourceBrand = detectBrandFromUrl(mainUrl) || normalizeBrandName(raw.slice(0, 500)) || 'LIVEBLOG';
  const liveTitle = clipText(lines.find(l => /live|update|nieuws/i.test(l)) || `${sourceBrand} liveblog`, 72);
  // alleen een URL vóór de eerste update geldt als adres van het liveblog zelf; links in updates zijn andere artikelen
  const firstHeader = lines.findIndex(l => timeRe.test(l));
  const liveUrl = ((firstHeader > 0 ? lines.slice(0, firstHeader).join(' ') : '').match(/https?:\/\/[^\s)\]]+/g) || []).find(isHttpUrl) || '';

  let activeDate = '';
  const rows = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const tm = line.match(timeRe);
    if (!tm) continue;
    const headerDate = dateFromHeader(tm.groups);
    if (headerDate) activeDate = headerDate;

    let j = i + 1;
    while (j < lines.length && !lines[j]) j++;

    if (j < lines.length) {
      const parsedDate = parseDateLine(lines[j]);
      if (parsedDate) {
        activeDate = parsedDate;
        j++;
        while (j < lines.length && !lines[j]) j++;
      }
    }

    const bodyLines = [];
    while (j < lines.length && !timeRe.test(lines[j])) {
      bodyLines.push(lines[j]);
      j++;
    }

    const imgLine = bodyLines.find(l => imageMdRe.test(l));
    const imgMatch = imgLine ? imgLine.match(imageMdRe) : null;
    const imageUrl = isHttpUrl(imgMatch?.groups?.u) ? imgMatch.groups.u : '';

    const cleanBodyLines = bodyLines
      .filter(l => l && !imageMdRe.test(l))
      .map(l => mdLinkToText(l.replace(/^\*\*(.+)\*\*$/, '$1')).trim())
      .filter(Boolean);

    const boldTitle = bodyLines.map(l => l.match(/^\*\*(.+)\*\*$/)).find(Boolean)?.[1] || '';
    const title = clipText(boldTitle || cleanBodyLines[0] || `Liveblog update ${rows.length + 1}`, 150);
    const updateText = fullText(cleanBodyLines.join(' '));

    const hh = String(tm.groups?.hh || '').padStart(2, '0');
    const mm = String(tm.groups?.mm || '').padStart(2, '0');
    const today = new Date();
    const fallbackDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const d = activeDate || fallbackDate;
    const ts = `${d} ${hh}:${mm}`;

    rows.push({
      merk: sourceBrand,
      bron: sourceBrand,
      tijd: ts,
      titel: title,
      article_type: 'LIVE_BLOG',
      article_url: liveUrl || '',
      afbeelding: imageUrl,
      liveblog_titel: liveTitle,
      update_tekst: updateText,
      ...linkFields(articleLinksFromContent(bodyLines.filter(l => !imageMdRe.test(l)).join(' '), liveUrl)),
      ...mediaColumns(mediaFromHtml(bodyLines.join(' ')))
    });

    i = j - 1;
  }

  // Lossere tweede poging: tijd en tekst op dezelfde regel (vaak het resultaat van copy-paste vanaf een live pagina).
  if (!rows.length) {
    const inlineTimeRe = /^(?<hh>[01]?\d|2[0-3])[:.](?<mm>[0-5]\d)\b\s*[-–:]?\s*(?<rest>.*)$/;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const tm = line.match(inlineTimeRe);
      if (!tm) continue;

      let j = i + 1;
      const bodyLines = tm.groups?.rest ? [tm.groups.rest] : [];
      while (j < lines.length && !inlineTimeRe.test(lines[j]) && !timeRe.test(lines[j])) {
        if (lines[j]) bodyLines.push(lines[j]);
        j++;
      }

      const imgLine = bodyLines.find(l => imageMdRe.test(l));
      const imgMatch = imgLine ? imgLine.match(imageMdRe) : null;
      const imageUrl = isHttpUrl(imgMatch?.groups?.u) ? imgMatch.groups.u : '';

      const cleanBodyLines = bodyLines
        .filter(l => l && !imageMdRe.test(l))
        .map(l => mdLinkToText(l.replace(/^\*\*(.+)\*\*$/, '$1')).trim())
        .filter(Boolean);

      const boldTitle = bodyLines.map(l => l.match(/^\*\*(.+)\*\*$/)).find(Boolean)?.[1] || '';
      const title = clipText(boldTitle || cleanBodyLines[0] || `Liveblog update ${rows.length + 1}`, 150);
      const updateText = fullText(cleanBodyLines.join(' '));

      const hh = String(tm.groups?.hh || '').padStart(2, '0');
      const mm = String(tm.groups?.mm || '').padStart(2, '0');
      const today = new Date();
      const fallbackDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const d = activeDate || fallbackDate;
      const ts = `${d} ${hh}:${mm}`;

      rows.push({
        merk: sourceBrand,
        bron: sourceBrand,
        tijd: ts,
        titel: title,
        article_type: 'LIVE_BLOG',
        article_url: liveUrl || '',
        afbeelding: imageUrl,
        liveblog_titel: liveTitle,
        update_tekst: updateText,
        ...linkFields(articleLinksFromContent(bodyLines.filter(l => !imageMdRe.test(l)).join(' '), liveUrl)),
        ...mediaColumns(mediaFromHtml(bodyLines.join(' ')))
      });

      i = j - 1;
    }
  }

  if (rows.length < 1) return null;
  // Bronvolgorde is vrijwel altijd nieuwste-eerst; bij identieke tijdstippen is dat de tie-break.
  rows.forEach((r, i) => { r.__srcIdx = i; });
  rows.sort((a, b) => (parseTime(a.tijd) - parseTime(b.tijd)) || (b.__srcIdx - a.__srcIdx));
  numberLiveblogRows(rows);

  return {
    headers: liveblogHeaders(),
    rows
  };
}

// Laatste redmiddel: geen tabel, geen herkenbaar tijdpatroon per regel — toch 1 tegel tonen i.p.v. niets.
function tryParseLiveblogLastResort(text) {
  const raw = String(text || '').trim();
  if (!raw || raw.length < 3) return null;
  if (/<html[\s>]/i.test(raw)) return null;

  const urlRe = /(https?:\/\/[^\s)]+)/ig;
  const imgExtRe = /\.(jpg|jpeg|png|webp|avif|gif)(\?|$)/i;
  const allUrls = [...raw.matchAll(urlRe)].map(m => m[1]).filter(isHttpUrl);
  const imageUrl = allUrls.find(u => imgExtRe.test(u) || isLikelyImageStillUrl(u)) || '';
  const mainUrl = allUrls.find(u => u !== imageUrl) || allUrls[0] || '';
  const sourceBrand = detectBrandFromUrl(mainUrl) || 'LIVEBLOG';

  const plainLines = raw.split(/\n/).map(l => l.replace(/^\*\*(.+)\*\*$/, '$1').trim())
    .filter(l => l && !urlRe.test(l) && !/^!\[/.test(l));
  const title = clipText(plainLines[0] || raw.slice(0, 150), 150);
  const bodyText = clipText(plainLines.join(' '), 450);

  const now = new Date();
  const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const row = {
    merk: sourceBrand,
    bron: sourceBrand,
    tijd: ts,
    titel: title || 'Liveblog update 1',
    article_type: 'LIVE_BLOG',
    article_url: mainUrl,
    afbeelding: imageUrl,
    liveblog_titel: `${sourceBrand} liveblog`,
    update_tekst: bodyText,
    update_nummer: '1',
    minuten_sinds_start: '0',
    minuten_sinds_vorige: '0'
  };

  return {
    headers: liveblogHeaders(),
    rows: [row]
  };
}

// Timepath-widget (o.a. RTL Nieuws): de echte updates staan niet in de statische HTML,
// maar worden door de widget zelf opgehaald bij embed.timepath.co. Dat is dezelfde
// publieke JSON-API die elke bezoeker al laadt; wij roepen 'm rechtstreeks aan.
function detectTimepathEmbed(rawHtml) {
  const raw = String(rawHtml || '');
  const idMatch = raw.match(/data-timepath-liveblog-id=["']([^"']+)["']/i);
  if (!idMatch) return null;
  const apiBaseMatch = raw.match(/data-timepath-api-base=["']([^"']+)["']/i);
  const eventsMatch = raw.match(/data-timepath-events-to-show=["'](\d+)["']/i);
  return {
    liveblogId: idMatch[1],
    apiBase: (apiBaseMatch?.[1] || 'https://embed.timepath.co').replace(/\/$/, ''),
    eventsToShow: eventsMatch ? Math.max(1, parseInt(eventsMatch[1], 10)) : 25
  };
}

function timepathEventToRow(ev, sourceBrand, liveTitle, canonicalUrl) {
  const created = ev?.created?.seconds ? new Date(ev.created.seconds * 1000) : null;
  const tijd = created ? created.toISOString() : '';
  const title = stripHtmlTags(ev?.title || '') || clipText(stripHtmlTags(ev?.body || ''), 150) || 'Liveblog update';
  const body = fullText(stripHtmlTags(ev?.body || ''));
  // Afbeeldingen zitten niet in een apart veld, maar als <img> in de body-HTML van het event.
  const imageUrl = firstImageFromHtml(ev?.body || '');
  const media = mediaFromHtml(`${ev?.body || ''} ${JSON.stringify(ev?.embedUrls || [])}`);
  return {
    merk: sourceBrand,
    bron: sourceBrand,
    tijd,
    titel: clipText(title, 150),
    article_type: 'LIVE_BLOG',
    article_url: ev?.id ? `${canonicalUrl}#liveblog-event-${ev.id}` : canonicalUrl,
    afbeelding: isHttpUrl(imageUrl) ? imageUrl : media.still,
    liveblog_titel: liveTitle,
    update_tekst: body,
    update_opmaak: richText(ev?.body, canonicalUrl),
    ...linkFields(articleLinksFromContent(ev?.body, canonicalUrl)),
    woorden: String(wordCount(stripHtmlTags(ev?.title || ''), stripHtmlTags(ev?.body || ''))),
    ...mediaColumns(media)
  };
}

async function fetchTimepathLiveblogRows(embed, doc) {
  const canonicalUrl = doc?.querySelector('link[rel="canonical"]')?.getAttribute('href')
    || doc?.querySelector('meta[property="og:url"]')?.getAttribute('content')
    || '';
  const sourceBrand = detectBrandFromUrl(canonicalUrl) || detectBrandFromHtmlDoc(doc) || 'LIVEBLOG';
  const liveTitle = clipText(
    stripHtmlTags(doc?.querySelector('meta[property="og:title"]')?.getAttribute('content') || doc?.title || ''),
    72
  ) || `${sourceBrand} liveblog`;

  let offset = 0;
  const pageSize = embed.eventsToShow || 25;
  let allEvents = [];
  let totalEvents = Infinity;
  let safety = 0;

  while (allEvents.length < totalEvents && safety < 40) {
    safety++;
    const url = `${embed.apiBase}/api/liveblog/embed?liveblogId=${encodeURIComponent(embed.liveblogId)}&eventsToShow=${pageSize}&offset=${offset}`;
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error(`Timepath API gaf status ${res.status}`);
    const data = await res.json();
    const events = Array.isArray(data?.liveblogevents) ? data.liveblogevents : [];
    if (!events.length) break;
    allEvents = allEvents.concat(events);
    totalEvents = Number.isFinite(data?.totalEvents) ? data.totalEvents : allEvents.length;
    offset = allEvents.length;
    if (!data?.hasMore) break;
  }

  if (!allEvents.length) return null;

  const rows = allEvents
    .map(ev => timepathEventToRow(ev, sourceBrand, liveTitle, canonicalUrl))
    .filter(r => parseTime(r.tijd) !== null);
  if (!rows.length) return null;

  // Timepath levert events nieuwste-eerst; bij identieke tijdstippen is dat de tie-break.
  rows.forEach((r, i) => { r.__srcIdx = i; });
  rows.sort((a, b) => (parseTime(a.tijd) - parseTime(b.tijd)) || (b.__srcIdx - a.__srcIdx));
  numberLiveblogRows(rows);

  return {
    headers: liveblogHeaders(),
    rows
  };
}

function applyLiveblogResult(liveblog, silent, sourceUrl = '') {
  fixPlaceholderMedia(liveblog.rows);
  const headers = withExtraHeaders(liveblog.headers);
  // dezelfde liveblog opnieuw toevoegen (bijv. na openklappen) vult de bestaande dataset aan
  // dezelfde liveblog met een andere URL-variant (bv. ?slug_rd=1) is geen nieuwe dataset
  const existing = sourceUrl && (state.datasets || []).find(d => d.sourceUrl && normalizeArticleUrl(d.sourceUrl) === normalizeArticleUrl(sourceUrl));
  if (existing && liveblog.rows.length) {
    const before = existing.rowCount;
    const n = replaceDatasetRows(existing.id, liveblog.rows, headers, !liveblog.authoritative);
    if (liveblog.tickaroo) existing.tickaroo = liveblog.tickaroo;
    existing.active = true;
    autoMap();
    renderAll();
    enrichLinkPremium();
    if (!silent) toast(`${existing.label}: ${n} updates${n > before ? ` (+${n - before})` : ''}.`);
    return true;
  }
  const n = appendDataset(liveblog.rows, headers, { label: liveblog.rows[0]?.liveblog_titel || 'Liveblog', kind: 'liveblog', sourceUrl, tickaroo: liveblog.tickaroo });
  if (!n) {
    if (!silent) toast('Liveblog herkend, maar bevatte geen bruikbare updates.');
    return false;
  }
  state.removed = [];
  if (+state.settings.titleLines < 2) state.settings.titleLines = 3;

  state.mapping.time = 'tijd';
  state.mapping.title = 'titel';
  state.mapping.brand = 'merk';
  state.mapping.articleType = 'article_type';
  state.mapping.articleUrl = 'article_url';
  state.mapping.image = 'afbeelding';
  state.mapping.body = 'update_tekst';
  state.mapping.link = 'artikel_link';
  state.mapping.linkPremium = 'link_premium';
  state.mapping.video = 'video';
  state.mapping.social = 'social';
  state.mapping.dataviz = 'dataviz';

  state.metrics = state.metrics.filter(mt => mt.column && !['liveblog_titel', 'update_tekst'].includes(mt.column));

  autoMap();
  renderAll();
  if (!silent) toast(`${n} liveblog-updates toegevoegd (${getActiveRows().length} actief).`);
  enrichLinkPremium();
  return true;
}

function tryParseLiveblogEmbeddedJsonHtml(text) {
  const raw = String(text || '');
  if (!/<html[\s>]/i.test(raw)) return null;

  const doc = new DOMParser().parseFromString(raw, 'text/html');
  const scripts = [...doc.querySelectorAll('script')];
  if (!scripts.length) return null;

  const candidateJson = [];
  scripts.forEach(sc => {
    const t = (sc.getAttribute('type') || '').toLowerCase();
    const id = (sc.getAttribute('id') || '').toLowerCase();
    const body = (sc.textContent || '').trim();
    if (!body) return;
    if (t === 'application/json' || id === '__next_data__' || body.startsWith('{') || body.startsWith('[')) {
      candidateJson.push(body);
    }
  });
  if (!candidateJson.length) return null;

  const asArray = (v) => Array.isArray(v) ? v : (v ? [v] : []);
  const toIsoFromEpoch = (n) => {
    if (!Number.isFinite(n)) return '';
    if (n > 1e12) return new Date(n).toISOString();
    if (n > 1e9) return new Date(n * 1000).toISOString();
    return '';
  };

  const timeFromObj = (obj) => {
    const keys = ['datePublished', 'dateModified', 'publishedAt', 'updatedAt', 'publicationDate', 'createdAt', 'timestamp', 'time', 'datetime'];
    for (const k of keys) {
      if (!(k in obj)) continue;
      const v = obj[k];
      if (typeof v === 'number') {
        const iso = toIsoFromEpoch(v);
        if (iso) return iso;
      }
      const s = String(v || '').trim();
      if (!s) continue;
      if (/^\d{10,13}$/.test(s)) {
        const iso = toIsoFromEpoch(Number(s));
        if (iso) return iso;
      }
      if (parseTime(s) !== null) return s;
    }
    return '';
  };

  const titleFromObj = (obj) => {
    const keys = ['headline', 'title', 'heading'];
    for (const k of keys) {
      const s = stripHtmlTags(obj[k]);
      if (s) return s;
    }
    return '';
  };

  const bodyFromObj = (obj) => {
    const keys = ['articleBody', 'body', 'text', 'description', 'content', 'message'];
    for (const k of keys) {
      const s = stripHtmlTags(obj[k]);
      if (s && s.length > 20) return s;
    }
    return '';
  };

  const urlFromObj = (obj, fallback) => {
    const cands = [obj.mainEntityOfPage, obj.url, obj.articleUrl, fallback];
    return cands.find(isHttpUrl) || '';
  };

  const rows = [];
  const maxNodes = 25000;
  const canonicalUrl = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
  const sourceBrand = detectBrandFromHtmlDoc(doc) || detectBrandFromUrl(canonicalUrl) || 'LIVEBLOG';
  const liveTitle = clipText(
    stripHtmlTags(doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || ''),
    72
  ) || `${sourceBrand} liveblog`;

  candidateJson.forEach(txt => {
    let parsed;
    try {
      parsed = JSON.parse(txt);
    } catch {
      return;
    }

    const stack = asArray(parsed);
    let seen = 0;
    while (stack.length && seen < maxNodes) {
      const cur = stack.pop();
      seen++;
      if (!cur || typeof cur !== 'object') continue;

      if (Array.isArray(cur)) {
        for (let i = cur.length - 1; i >= 0; i--) stack.push(cur[i]);
        continue;
      }

      const t = timeFromObj(cur);
      if (t) {
        const body = bodyFromObj(cur);
        const title = clipText(titleFromObj(cur) || summarizeUpdateText(body) || '', 150);
        const imageUrl = imageUrlFromSchema(cur.image)
          || imageUrlFromSchema(cur.thumbnail)
          || videoStillFromSchema(cur.video)
          || videoStillFromSchema(cur.media)
          || firstImageFromHtml(cur.articleBody || cur.body || '')
          || firstVideoStillFromHtml(cur.articleBody || cur.body || '')
          || '';

        if (parseTime(t) !== null && (title || body)) {
          rows.push({
            merk: sourceBrand,
            bron: sourceBrand,
            tijd: String(t).trim(),
            titel: title || `Liveblog update ${rows.length + 1}`,
            article_type: 'LIVE_BLOG',
            article_url: urlFromObj(cur, canonicalUrl),
            afbeelding: imageUrl,
            liveblog_titel: liveTitle,
            update_tekst: fullText(body),
            ...linkFields(articleLinksFromContent(cur.articleBody || cur.body || '', canonicalUrl)),
            ...mediaColumns(mediaFromHtml(cur.articleBody || cur.body || ''))
          });
        }
      }

      Object.values(cur).forEach(v => {
        if (v && typeof v === 'object') stack.push(v);
      });
    }
  });

  if (!rows.length) return null;

  // Bronvolgorde is vrijwel altijd nieuwste-eerst; bij identieke tijdstippen is dat de tie-break.
  rows.forEach((r, i) => { r.__srcIdx = i; });
  const dedup = new Map();
  rows.forEach(r => {
    const key = [r.tijd, r.titel, r.update_tekst].join('|');
    if (!dedup.has(key)) dedup.set(key, r);
  });
  const out = [...dedup.values()]
    .filter(r => parseTime(r.tijd) !== null)
    .sort((a, b) => (parseTime(a.tijd) - parseTime(b.tijd)) || (b.__srcIdx - a.__srcIdx));

  if (out.length < 1) return null;
  numberLiveblogRows(out);

  return {
    headers: liveblogHeaders(),
    rows: out
  };
}

function makeUniqueDatasetLabel(base) {
  const clean = String(base || 'Dataset').replace(/\s+/g, ' ').trim() || 'Dataset';
  const used = new Set((state.datasets || []).map(d => d.label));
  if (!used.has(clean)) return clean;
  let i = 2;
  while (used.has(`${clean} ${i}`)) i++;
  return `${clean} ${i}`;
}

function activeDatasetIds() {
  if (!state.datasets?.length) return null;
  const active = state.datasets.filter(d => d.active).map(d => d.id);
  if (!active.length) return null;
  return new Set(active);
}

function getActiveRows() {
  const active = activeDatasetIds();
  if (!active) return state.rows;
  return state.rows.filter(r => active.has(r.__datasetId));
}

function appendDataset(rowsInput, headersInput, opts = {}) {
  const rows = Array.isArray(rowsInput) ? rowsInput : [];
  const headers = Array.isArray(headersInput) ? headersInput : [];
  if (!rows.length || !headers.length) return 0;

  const datasetId = crypto.randomUUID();
  const label = makeUniqueDatasetLabel(opts.label || `Dataset ${state.datasets.length + 1}`);

  const mergedHeaders = [...state.headers];
  headers.forEach(h => { if (!mergedHeaders.includes(h)) mergedHeaders.push(h); });

  const backfilledExisting = state.rows.map(r => {
    const o = { ...r };
    mergedHeaders.forEach(h => { if (!(h in o)) o[h] = ''; });
    return o;
  });

  const appended = rows.map(r => {
    const o = { __datasetId: datasetId };
    mergedHeaders.forEach(h => { o[h] = String(r[h] ?? '').trim(); });
    return o;
  });

  state.headers = mergedHeaders;
  state.rows = [...backfilledExisting, ...appended].map((r, idx) => ({ ...r, __id: idx }));
  state.datasets.push({
    id: datasetId,
    label,
    kind: opts.kind || 'table',
    rowCount: appended.length,
    active: true,
    sourceUrl: isHttpUrl(opts.sourceUrl) ? opts.sourceUrl : '',
    ...(opts.tickaroo ? { tickaroo: opts.tickaroo } : {})
  });
  return appended.length;
}

/** Twee datasets van dezelfde liveblog (alleen de URL verschilt): de laatst ververste blijft. */
function mergeDuplicateDatasets() {
  const groups = new Map();
  (state.datasets || []).filter(d => d.sourceUrl).forEach(d => {
    const k = normalizeArticleUrl(d.sourceUrl);
    groups.set(k, [...(groups.get(k) || []), d]);
  });
  const drop = new Set();
  groups.forEach(list => {
    if (list.length < 2) return;
    const keep = [...list].sort((a, b) => (b.refreshedAt || 0) - (a.refreshedAt || 0))[0];
    list.filter(d => d !== keep).forEach(d => drop.add(d.id));
    keep.active = list.some(d => d.active);
  });
  if (!drop.size) return;
  state.datasets = state.datasets.filter(d => !drop.has(d.id));
  state.rows = state.rows.filter(r => !drop.has(r.__datasetId)).map((r, idx) => ({ ...r, __id: idx }));
  state.removed = [];
}

/** Dubbele posts binnen een dataset (zelfde minuut en kop) samenvoegen; de rij met de meeste gegevens blijft. */
function dedupeRows() {
  const filled = (r) => Object.values(r).filter(v => v !== '' && v !== null && v !== undefined).length;
  const best = new Map();
  state.rows.forEach(r => {
    const t = parseTime(r.tijd);
    if (t === null || !r.titel) { best.set(Symbol(), r); return; }
    const key = `${r.__datasetId}|${r.merk || ''}|${Math.round(t)}|${String(r.titel).trim()}`;
    const prev = best.get(key);
    if (!prev || filled(r) > filled(prev)) best.set(key, r);
  });
  if (best.size === state.rows.length) return;
  state.rows = [...best.values()].map((r, idx) => ({ ...r, __id: idx }));
  state.removed = [];
  state.datasets.forEach(d => { d.rowCount = state.rows.filter(r => r.__datasetId === d.id).length; });
}

/** Vervangt de rijen van één dataset door een verse versie (verversen), met behoud van de overige datasets. */
function replaceDatasetRows(datasetId, rowsInput, headersInput, keepOld = true) {
  const headers = [...state.headers];
  headersInput.forEach(h => { if (!headers.includes(h)) headers.push(h); });
  const kept = state.rows.filter(r => r.__datasetId !== datasetId).map(r => {
    const o = { ...r };
    headers.forEach(h => { if (!(h in o)) o[h] = ''; });
    return o;
  });
  // verversen haalt de serverversie op; rijkere data uit de geladen pagina (video, embeds, beeld) niet weggooien
  // tijden komen soms met en soms zonder milliseconden binnen; op minuut en kop vergelijken
  const keyOf = (r) => `${Math.round(parseTime(r.tijd) ?? 0)}|${String(r.titel || '').trim()}`;
  const previous = new Map(state.rows.filter(r => r.__datasetId === datasetId).map(r => [keyOf(r), r]));
  const KEEP = ['afbeelding', 'artikel_link', 'artikel_links', 'link_premium', 'video', 'video_still', 'social', 'dataviz', 'woorden', 'update_opmaak'];
  const fresh = rowsInput.map(r => {
    const o = { __datasetId: datasetId };
    headers.forEach(h => { o[h] = String(r[h] ?? '').trim(); });
    const old = previous.get(keyOf(o));
    if (old && keepOld) KEEP.forEach(h => { if (!o[h] && old[h]) o[h] = old[h]; });
    return o;
  });
  // sites leveren alleen de nieuwste ~50 updates; oudere updates die al binnen waren niet kwijtraken
  // (een volledige bron levert alles, dan vervangt die de oude versie helemaal)
  const freshKeys = new Set(fresh.map(keyOf));
  const older = !keepOld ? [] : [...previous.values()]
    .filter(r => !freshKeys.has(keyOf(r)))
    .map(r => {
      const o = { ...r };
      headers.forEach(h => { if (!(h in o)) o[h] = ''; });
      return o;
    });
  const merged = [...fresh, ...older];
  state.headers = headers;
  state.rows = [...kept, ...merged].map((r, idx) => ({ ...r, __id: idx }));
  // __id's zijn opnieuw genummerd, dus eerder verwijderde tegels zijn niet meer te herleiden
  state.removed = [];
  const d = state.datasets.find(x => x.id === datasetId);
  if (d) { d.rowCount = merged.length; d.refreshedAt = Date.now(); }
  return merged.length;
}

/* ---------- bereikdata: weergaven en gebruikers per titel per uur, gekoppeld aan de liveblogtitels ---------- */
const REACH_MEASURES = { __views: 'Weergaven', __users: 'Gebruikers', __vpu: 'Weergaven per gebruiker', __vpp: 'Weergaven per update' };

/** Herkent een tabel met alleen tijd, titel en getallen (weergaven/gebruikers); geeft genormaliseerde rijen of null. */
function reachFromTable(headers, rows) {
  const pick = (re) => headers.find(h => re.test(h) && !/per/i.test(h));
  const time = pick(/hour|uur|kwartier|tijd|time|datum|date/i);
  const title = pick(/brand|merk|titel|title|site/i);
  const views = pick(/weergave|pageview|views/i);
  const users = pick(/gebruiker|users|bezoeker/i);
  if (!time || !title || (!views && !users)) return null;
  const sample = rows.slice(0, 50);
  const numeric = headers.filter(h => h !== time && h !== title)
    .every(h => sample.every(r => r[h] === '' || parseNumber(r[h]) !== null));
  // weinig verschillende titels; anders is het een artikeltabel met een kop per rij
  const titles = new Set(rows.map(r => r[title]));
  if (!numeric || titles.size > Math.max(2, Math.min(50, rows.length / 2))) return null;
  // alleen een uurnummer (0\u201323): koppelen aan de gekozen dag, anders de dag met de meeste posts
  const hourOnly = rows.every(r => /^\s*([01]?\d|2[0-3])\s*$/.test(r[time]));
  const day = hourOnly ? (state.settings.periodFrom
    || availableDays().sort((a, b) => b.n - a.n)[0]?.date || localDateOf(Date.now() / 60000)) : '';
  const out = rows.map(r => ({
    title: r[title],
    t: hourOnly ? parseNaiveDateTimeInTz(`${day} ${String(+r[time]).padStart(2, '0')}:00`) : parseTime(r[time]),
    views: views ? parseNumber(r[views]) : null,
    users: users ? parseNumber(r[users]) : null
  })).filter(r => r.title && isAbsoluteMinutes(r.t));
  return out.length ? out : null;
}

/** Titelcode uit de bereikdata (bv. DM) gekoppeld aan de naam in de liveblogs (De Morgen). */
function reachTitle(code) {
  const names = Object.keys(state.brands);
  if (names.includes(code)) return code;
  const key = canonicalBrandKey(code);
  return (key && names.find(n => canonicalBrandKey(n) === key)) || code;
}

/** Totaalcijfers per liveblog: alleen een titel en getallen, zonder tijd (bijv. weergaven en gebruikers over de hele liveblog). */
function totalsFromTable(headers, rows) {
  const title = headers.find(h => /brand|merk|titel|title|site/i.test(h) && !/per/i.test(h));
  if (!title || headers.some(h => /^(hour|uur|kwartier|tijd|tijdstip|time|timestamp|datum|date)\b/i.test(h.trim()))) return null;
  const cols = headers.filter(h => h !== title);
  const sample = rows.slice(0, 50);
  if (!cols.length || !cols.every(h => sample.every(r => r[h] === '' || parseNumber(r[h]) !== null))) return null;
  const named = rows.filter(r => r[title]);
  if (!named.length || named.length > 50 || new Set(named.map(r => r[title])).size !== named.length) return null;
  return { cols, rows: named.map(r => ({ title: r[title], values: Object.fromEntries(cols.map(h => [h, parseNumber(r[h])])) })) };
}

const reachTotalKind = (h) => /weergave.*per.*gebruiker|views.*per.*user/i.test(h) ? 'vpu' : /per/i.test(h) ? null : /weergave|pageview|views/i.test(h) ? 'views' : /gebruiker|users|bezoeker/i.test(h) ? 'users' : null;

/** Eigen kolommen uit totaalcijfers (alles behalve weergaven en gebruikers), met een veilige sleutel per kolom. */
function reachTotalCols() {
  const seen = new Map();
  (state.datasets || []).filter(d => d.kind === 'reach' && d.active && d.totals).forEach(d => d.totals.cols.forEach(h => {
    if (!reachTotalKind(h) && !seen.has(h)) seen.set(h, { header: h, key: `ext_${h.replace(/\W+/g, '_')}` });
  }));
  return [...seen.values()];
}

/** Totaalcijfers per titel, gekoppeld aan de liveblogtitels. */
function reachTotals() {
  const out = new Map();
  (state.datasets || []).filter(d => d.kind === 'reach' && d.active && d.totals).forEach(d => d.totals.rows.forEach(r => {
    const title = reachTitle(r.title);
    if (!reachTitleVisible(title)) return;
    const cur = out.get(title) || { views: null, users: null, other: {} };
    Object.entries(r.values).forEach(([h, v]) => {
      const kind = reachTotalKind(h);
      if (kind === 'vpu') return;
      if (kind) cur[kind] = v; else cur.other[h] = v;
    });
    out.set(title, cur);
  }));
  return out;
}

// titels met een liveblog/tabel volgen de schakelaar van die dataset; titels zonder eigen dataset blijven zichtbaar
function reachTitleVisible(title) {
  const col = state.mapping.brand;
  const all = new Set(col ? state.rows.map(r => r[col]).filter(Boolean) : []);
  const active = new Set(col ? getActiveRows().map(r => r[col]).filter(Boolean) : []);
  return !all.has(title) || active.has(title);
}

function reachRows() {
  return (state.datasets || []).filter(d => d.kind === 'reach' && d.active).flatMap(d => d.reach || [])
    .map(r => ({ ...r, title: reachTitle(r.title) }))
    .filter(r => reachTitleVisible(r.title));
}

/* ---------- DPG-liveblogs: alle posts via de eigen liveblog-API van de site (via de extensie, met de cookies van de gebruiker) ---------- */
// regio (AD, BD, ED, ...): /api/liveblog?liveId=...&offset=...
// landelijk (VK, Trouw, Parool, De Morgen, HLN): /api/_next-api/v1/liveblog/moments/?liveBlogId=...&dateTime=...&older=true
function detectDpgLiveblog(rawHtml, pageUrl = '') {
  const raw = String(rawHtml || '');
  const canonical = sourceUrlFromHtml(raw) || pageUrl;
  if (!/^https:\/\//.test(canonical)) return null;
  const origin = new URL(canonical).origin;
  const regio = raw.match(/\\?"liveId\\?"\s*:\s*\\?"([0-9a-f]{24})/i)?.[1];
  if (regio) return { kind: 'regio', id: regio, origin, canonical };
  const landelijk = raw.match(/\\?"liveBlogId\\?"\s*:\s*\\?"([0-9a-f]{24})/i)?.[1];
  if (landelijk) return { kind: 'moments', id: landelijk, origin, canonical };
  return null;
}

// beide API's teruggebracht tot { tijd, title, paragraphs, extraHtml, image, video }
// artikelteasers en andere blokken: eerste artikellink plus het premiumlabel dat erbij staat (null = onbekend)
function teaserFromBlocks(blocks, ownUrl) {
  for (const block of blocks) {
    const json = JSON.stringify(block);
    const link = [...json.matchAll(/https?:\/\/[^"\s\\]+/g)].map(m => m[0])
      .filter(u => { try { return !/(^|\.)(images?|img|static|cdn|assets?)[.-]/i.test(new URL(u).hostname); } catch { return false; } })
      .find(u => isArticleLink(u, ownUrl));
    if (!link) continue;
    const premium = /"(?:isPremium|premium|isPlus|paid)"\s*:\s*true|"contentAccessCategory"\s*:\s*"(?!FREE)[A-Z]+"/i.test(json) ? true
      : /"(?:isPremium|premium)"\s*:\s*false|"contentAccessCategory"\s*:\s*"FREE"/i.test(json) ? false : null;
    return { link, premium };
  }
  return null;
}

async function fetchDpgRegioItems(info) {
  const items = [];
  for (let offset = 0, page = 0; page < 100; page++) {
    const data = JSON.parse(await requestPage(`${info.origin}/api/liveblog?highlightsOnly=false&limit=20&liveId=${info.id}&offset=${offset}`));
    const batch = Array.isArray(data?.moments) ? data.moments : [];
    batch.filter(mo => !mo.hidden).forEach(mo => {
      const comps = Array.isArray(mo.components) ? mo.components : [];
      items.push({
        tijd: mo.timestamp,
        title: mo.title,
        paragraphs: comps.filter(c => c.type === 'PARAGRAPH').map(c => c.properties?.content || ''),
        extraHtml: comps.filter(c => c.type !== 'PARAGRAPH' && c.type !== 'IMAGE')
          .map(c => c.type === 'FREE_HTML' ? (c.properties?.content || '') : JSON.stringify(c)).join(' '),
        freeHtml: comps.filter(c => c.type === 'FREE_HTML').map(c => c.properties?.content || '').join(' '),
        image: comps.find(c => c.type === 'IMAGE' && isHttpUrl(c.properties?.url))?.properties.url || '',
        video: comps.some(c => c.type === 'VIDEO'),
        pngImage: comps.some(c => c.type === 'IMAGE' && /png/i.test(c.properties?.mimeType || '')),
        teaser: teaserFromBlocks(comps.filter(c => !['PARAGRAPH', 'IMAGE', 'VIDEO', 'FREE_HTML'].includes(c.type)), info.canonical),
        types: comps.map(c => c.type)
      });
    });
    offset += batch.length;
    if (!data?.hasMore || !batch.length) break;
  }
  return items;
}

/** Beeld-URL uit een DPG-beeldblok: volledige URL, of zonder https: / relatief (komt per titel anders binnen). */
function dpgImageUrl(block, origin) {
  if (!block) return '';
  const json = JSON.stringify(block);
  const abs = json.match(/https:\/\/[^"\s\\]+/)?.[0];
  if (abs) return abs;
  const rel = json.match(/"(?:url|src|source|imageUrl|path|href)"\s*:\s*"((?:\/\/|\/)[^"\s\\]+)"/i)?.[1];
  if (rel) {
    try { return new URL(rel, origin).href; } catch { /* verder met id */ }
  }
  // alleen een beeld-id (o.a. De Morgen): DPG-beelden staan op image.<site>/<id>/width/<breedte>/<naam>; de naam is verplicht maar vrij
  const id = json.match(/"[^"]*[iI]d"\s*:\s*"?(\d{7,})/)?.[1];
  const site = hostFromUrl(origin).split('.').slice(-2).join('.');
  return id && site ? `https://image.${site}/${id}/width/1280/foto` : '';
}

async function fetchDpgMomentItems(info) {
  const items = [];
  const seen = new Set();
  let dateTime = '';
  for (let page = 0; page < 100; page++) {
    const url = `${info.origin}/api/_next-api/v1/liveblog/moments/?liveBlogId=${info.id}&pageSize=50`
      + (dateTime ? `&dateTime=${encodeURIComponent(dateTime)}&older=true` : '');
    const data = JSON.parse(await requestPage(url));
    const batch = (Array.isArray(data?.moments) ? data.moments : []).filter(mo => mo?.id && !seen.has(mo.id));
    batch.forEach(mo => {
      seen.add(mo.id);
      const blocks = Array.isArray(mo.content) ? mo.content : [];
      const imageBlock = blocks.find(b => b.blockType === 'IMAGE');
      items.push({
        tijd: mo.dateTime,
        title: mo.title,
        paragraphs: blocks.filter(b => b.blockType === 'PARAGRAPH' && typeof b.content === 'string').map(b => b.content),
        // embeds e.d. hebben geen vaste vorm; de URL's erin volstaan voor link- en mediaherkenning
        extraHtml: blocks.filter(b => b.blockType !== 'PARAGRAPH').map(b => JSON.stringify(b)).join(' '),
        image: dpgImageUrl(imageBlock, info.origin),
        video: blocks.some(b => /VIDEO/i.test(b.blockType || '')),
        pngImage: blocks.some(b => b.blockType === 'IMAGE' && /"mimeType"\s*:\s*"image\/png"/i.test(JSON.stringify(b))),
        teaser: teaserFromBlocks(blocks.filter(b => !['PARAGRAPH', 'IMAGE'].includes(b.blockType)), info.canonical),
        types: blocks.map(b => b.blockType)
      });
    });
    if (!data?.hasMoreMoments || !batch.length) break;
    dateTime = batch[batch.length - 1].dateTime;
  }
  return items;
}

async function fetchDpgLiveblogRows(info, doc) {
  const items = info.kind === 'regio' ? await fetchDpgRegioItems(info) : await fetchDpgMomentItems(info);
  if (!items.length) return null;

  const sourceBrand = detectBrandFromUrl(info.canonical) || detectBrandFromHtmlDoc(doc) || 'LIVEBLOG';
  const liveTitle = clipText(stripHtmlTags(doc?.querySelector('meta[property="og:title"]')?.getAttribute('content') || doc?.title || ''), 72)
    || `${sourceBrand} liveblog`;
  const rows = items.map(it => {
    const html = [...it.paragraphs, it.extraHtml].join(' ');
    const body = stripHtmlTags(it.paragraphs.join(' '));
    const title = stripHtmlTags(it.title || '');
    const media = mediaFromHtml(html);
    if (it.video) media.video = true;
    // eigen widget van de site (bv. AD-kaart, HLN-tool op valley.hln.be) in een FREE_HTML-blok: interactieve graphic; linkblokken uitgezonderd
    const siteOf = siteKey;
    const ownSite = siteOf(hostFromUrl(info.canonical));
    const ownWidget = embedUrls(it.extraHtml).some(u => {
      // De Morgen /specials/embeds/ (visual generator) maakt ook citaat- en linkblokken: niet zonder meer als grafiek tellen
      try { const x = new URL(u, 'https://x'); return siteOf(x.hostname) === ownSite && !/linkblok|\.css$|\/specials\/embeds\//i.test(x.pathname); } catch { return false; }
    });
    if (ownWidget && !media.video && !media.social.length) media.dataviz = true;
    // persfoto's zijn JPEG; een PNG is een grafiek of graphic (bv. ANP-grafiek als afbeelding)
    if (it.pngImage && !media.video && !media.social.length) media.dataviz = true;
    // links in linkblokken (FREE_HTML) tellen ook mee
    const textLinks = articleLinksFromContent(`${it.paragraphs.join(' ')} ${it.freeHtml || ''}`, info.canonical);
    // de teaser in de post zegt zelf of het artikel premium is
    const premium = it.teaser?.link ? it.teaser.premium : null;
    if (premium !== null) rememberLinkPremium(it.teaser.link, premium);
    return {
      merk: sourceBrand,
      bron: sourceBrand,
      tijd: String(it.tijd || ''),
      titel: clipText(title || summarizeUpdateText(body) || 'Liveblog update', 150),
      article_type: 'LIVE_BLOG',
      article_url: info.canonical,
      afbeelding: it.image || media.still,
      liveblog_titel: liveTitle,
      update_tekst: fullText(body),
      update_opmaak: richText(it.paragraphs.map(p => `<p>${p}</p>`).join(''), info.canonical),
      ...linkFields(textLinks, it.teaser?.link ? [it.teaser.link] : []),
      link_premium: premium ? 'ja' : '',
      // soorten blokken en hosts van embeds, om onbekende widgets (bv. grafieken) te kunnen herkennen
      blokken: [...new Set((it.types || []).filter(Boolean))].join(', '),
      embed_bronnen: embedHosts(it.extraHtml),
      woorden: String(wordCount(title, body)),
      ...mediaColumns(media)
    };
  }).filter(r => parseTime(r.tijd) !== null);
  if (!rows.length) return null;

  rows.forEach((r, i) => { r.__srcIdx = i; });
  rows.sort((a, b) => (parseTime(a.tijd) - parseTime(b.tijd)) || (b.__srcIdx - a.__srcIdx));
  numberLiveblogRows(rows);
  return {
    headers: liveblogHeaders(),
    rows
  };
}

/* ---------- Tickaroo (o.a. De Telegraaf): de pagina bevat maar ~15 events, de publieke embed-API levert ze allemaal ---------- */
function detectTickarooEmbed(rawHtml) {
  const raw = String(rawHtml || '');
  const clientId = raw.match(/tickarooClientId\\?"\s*:\s*\\?"([0-9a-f]{24})/i)?.[1]
    || raw.match(/<tickaroo-liveblog[^>]*\bclientid=["']([0-9a-f]{24})/i)?.[1];
  const liveblogId = raw.match(/\\?"name\\?"\s*:\s*\\?"liveBlogId\\?"\s*,\s*\\?"value\\?"\s*:\s*\\?"([0-9a-f]{24})/i)?.[1]
    || raw.match(/<tickaroo-liveblog[^>]*\bliveblogid=["']([0-9a-f]{24})/i)?.[1];
  return clientId && liveblogId ? { clientId, liveblogId } : null;
}

/** Sportevents (doelpunt, wissel, rust) hebben geen tekstblok: team, minuut en spelers staan in sport_event.
 *  Daar maken we een kop van, zoals 'Vervanging Nederland 64': Justin Kluivert voor Quinten Timber'. */
function tickarooSportLine(se) {
  if (!se?.event_type) return '';
  const type = String(se.event_type).split('.').pop();
  const name = (p) => p?.player?.name || p?.player?.short_name || '';
  const by = (t) => (se.players || []).filter(p => p.event_player_type === t).map(name).filter(Boolean);
  const phase = se.phase?.name || '';
  const label = se.title || (/^(start|resume-halves)$/.test(type) && phase ? `Begin ${phase}` : phase) || type;
  const where = [se.team?.name, se.time_of_play].filter(Boolean).join(' ');
  let detail = '';
  if (by('in').length || by('out').length) detail = `${by('in').join(', ')} voor ${by('out').join(', ')}`;
  else if (by('scorer').length) detail = `${by('scorer').join(', ')}${by('assist').length ? ` (assist ${by('assist').join(', ')})` : ''}`;
  else detail = (se.players || []).map(p => name(p)).filter(Boolean).join(', ');
  return `${[label, where].filter(Boolean).join(' ')}${detail ? `: ${detail}` : ''}`.replace(/\s+/g, ' ').trim();
}

// Tickaroo geeft de API alleen vrij voor de sitedomeinen en localhost (anders 403); op Vercel levert de extensie de data aan.
// De meegegeven data geldt alleen voor de import van dat moment; verversen haalt altijd opnieuw op.
let tickarooSeed = null;
async function tickarooApiData(info) {
  const seed = tickarooSeed;
  tickarooSeed = null;
  if (seed?.liveblogId === info.liveblogId) {
    try { return JSON.parse(seed.text); } catch { /* val terug op ophalen */ }
  }
  const url = `https://cdn.tickaroo.com/api/embed/v4/js/liveblog.json?client_id=${info.clientId}&liveblogId=${info.liveblogId}&limit=1000`;
  if (extensionBridge) {
    try { return JSON.parse(await requestPage(url)); } catch (err) { console.warn('Tickaroo via extensie mislukt:', err); }
  }
  const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!res.ok) throw new Error(`Tickaroo gaf status ${res.status}`);
  return res.json();
}

async function fetchTickarooLiveblogRows(info, doc) {
  const data = await tickarooApiData(info);
  const events = Array.isArray(data?.gameShowResponse?.events) ? data.gameShowResponse.events : [];
  if (!events.length) return null;

  const canonicalUrl = doc?.querySelector('link[rel="canonical"]')?.getAttribute('href')
    || doc?.querySelector('meta[property="og:url"]')?.getAttribute('content') || '';
  const sourceBrand = detectBrandFromUrl(canonicalUrl) || detectBrandFromHtmlDoc(doc) || 'LIVEBLOG';
  const liveTitle = clipText(stripHtmlTags(doc?.querySelector('meta[property="og:title"]')?.getAttribute('content') || doc?.title || ''), 72)
    || `${sourceBrand} liveblog`;
  const parseJson = (s) => { try { return JSON.parse(s); } catch { return null; } };

  const rows = events.map(ev => {
    const blocks = Array.isArray(ev.contents) ? ev.contents : [];
    const richHtml = blocks.filter(b => /RichText/.test(b._type)).map(b => b.text || '').join(' ');
    const embeds = blocks.filter(b => /WebEmbed/.test(b._type)).map(b => parseJson(b.oembed_json)).filter(Boolean);
    const embedUrls = embeds.map(o => o._original || o.url || '').filter(isHttpUrl);
    const media = mediaFromHtml([richHtml, ...embeds.map(o => `${o.html || ''} ${o._original || ''}`)].join(' '));
    // gedeelde video-pagina's van de eigen site tellen als video, met hun thumbnail als still
    const videoEmbed = embeds.find(o => /\/video\//i.test(o._original || ''));
    if (videoEmbed) {
      media.video = true;
      media.still = media.still || videoEmbed.thumbnail_url || '';
    }
    const tmp = document.createElement('div');
    tmp.innerHTML = richHtml;
    const headline = (tmp.querySelector('h1, h2, h3, h4')?.textContent || '').replace(/\s+/g, ' ').trim()
      || tickarooSportLine(ev.sport_event);
    let body = (tmp.textContent || '').replace(/\s+/g, ' ').trim();
    if (headline && body.startsWith(headline)) body = body.slice(headline.length).trim();
    // beeld zit in 'media' of in een beeldblok; URL's van Tickaroo hebben vaak geen extensie
    const imageSource = JSON.stringify([...(ev.media || []), ...blocks.filter(b => /Image|Media/.test(b._type))]);
    const image = imageSource.match(/"(?:url|src|image_url|original_url|original)"\s*:\s*"(https:[^"]+)"/i)?.[1]
      || firstImageFromHtml(richHtml) || '';
    return {
      merk: sourceBrand,
      bron: sourceBrand,
      tijd: ev.created_at ? new Date(ev.created_at * 1000).toISOString() : '',
      titel: clipText(headline || summarizeUpdateText(body) || 'Liveblog update', 150),
      article_type: 'LIVE_BLOG',
      article_url: canonicalUrl,
      afbeelding: image || media.still,
      liveblog_titel: liveTitle,
      update_tekst: fullText(body),
      update_opmaak: richText(richHtml, canonicalUrl),
      ...linkFields(articleLinksFromContent(richHtml, canonicalUrl), embedUrls.filter(u => isArticleLink(u, canonicalUrl))),
      woorden: String(wordCount(headline, body)),
      ...mediaColumns(media)
    };
  }).filter(r => parseTime(r.tijd) !== null);
  if (!rows.length) return null;

  rows.forEach((r, i) => { r.__srcIdx = i; });
  rows.sort((a, b) => (parseTime(a.tijd) - parseTime(b.tijd)) || (b.__srcIdx - a.__srcIdx));
  numberLiveblogRows(rows);
  return {
    headers: liveblogHeaders(),
    rows,
    tickaroo: { clientId: info.clientId, liveblogId: info.liveblogId, canonicalUrl, title: liveTitle }
  };
}

/** Herkent een liveblog in tekst/HTML; geeft { headers, rows } of null (Timepath gaat async via de API). */
async function parseLiveblogAny(text, pageUrl = '') {
  return dropGenericHeadlines(await parseLiveblogRaw(text, pageUrl));
}

/** Sommige sites (o.a. De Telegraaf) zetten de liveblogtitel als kop op elke tekstpost; dat is geen kop.
 *  Die posts krijgen de eerste zin als kop en tellen alleen hun eigen woorden. */
function dropGenericHeadlines(result) {
  if (!result?.rows) return result;
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const generic = (r) => !!r.titel && !!r.liveblog_titel
    && (norm(r.titel) === norm(r.liveblog_titel) || norm(clipText(r.titel, 72)) === norm(r.liveblog_titel));
  if (result.rows.filter(generic).length < 2) return result;
  result.rows.forEach(r => {
    if (!generic(r)) return;
    const body = fullText(r.update_tekst);
    r.titel = clipText(summarizeUpdateText(body) || 'Liveblog update', 150);
    r.woorden = String(wordCount(body));
  });
  return result;
}

async function parseLiveblogRaw(text, pageUrl = '') {
  const safe = (fn) => { try { return fn(text); } catch { return null; } };
  const embed = safe(detectTimepathEmbed);
  if (embed) return fetchTimepathLiveblogRows(embed, new DOMParser().parseFromString(text, 'text/html'));
  const tickaroo = safe(detectTickarooEmbed);
  if (tickaroo) {
    try {
      const result = await fetchTickarooLiveblogRows(tickaroo, new DOMParser().parseFromString(text, 'text/html'));
      if (result) return result;
    } catch (err) {
      console.warn('Tickaroo niet bruikbaar, val terug op de pagina:', err);
      toast('De volledige liveblog kon niet worden opgehaald; alleen de zichtbare posts zijn ingelezen.');
    }
  }
  const dpg = extensionBridge ? safe((t) => detectDpgLiveblog(t, pageUrl)) : null;
  if (dpg) {
    try {
      const result = await fetchDpgLiveblogRows(dpg, new DOMParser().parseFromString(text, 'text/html'));
      if (result) return result;
    } catch (err) {
      console.warn('Liveblog-API niet bruikbaar, val terug op de pagina:', err);
    }
  }
  return safe(tryParseVrtLiveblog) || safe(tryParseLiveblogHtml) || safe(tryParseLiveblogEmbeddedJsonHtml) || safe(tryParseLiveblogPlainText);
}

function sourceUrlFromHtml(text) {
  const m = String(text).match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
    || String(text).match(/<meta[^>]+property=["']og:url["'][^>]*content=["']([^"']+)["']/i);
  return m && isHttpUrl(m[1]) ? m[1] : '';
}

/* ---------- verversen via de Chrome-extensie (extension/bridge.js) ---------- */
let extensionBridge = document.documentElement.dataset.reconstructExtension === '1';
const pageRequests = new Map();
window.addEventListener('message', (ev) => {
  if (ev.source !== window || ev.data?.source !== 'reconstruct-ext') return;
  if (ev.data.type === 'ready' && !extensionBridge) {
    extensionBridge = true;
    renderAll();
  }
  if (ev.data.type === 'fetch-result') {
    const pending = pageRequests.get(ev.data.id);
    if (pending) { pageRequests.delete(ev.data.id); pending(ev.data); }
  }
});

function requestPage(url) {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timer = setTimeout(() => { pageRequests.delete(id); reject(new Error('geen antwoord van de extensie')); }, 30000);
    pageRequests.set(id, (res) => {
      clearTimeout(timer);
      if (!res.ok) reject(Object.assign(new Error(res.error || `status ${res.status || '?'}`), { noAccess: !!res.noAccess }));
      else if (/myprivacy|consent|privacygate/i.test(res.finalUrl || '')) reject(new Error('cookietoestemming nodig: open de pagina één keer in Chrome en accepteer'));
      else resolve(res.html);
    });
    window.postMessage({ source: 'reconstruct-app', type: 'fetch-page', id, url }, '*');
  });
}

const refreshing = new Set();
async function refreshDataset(d, silent = false) {
  if (!d?.sourceUrl || !extensionBridge || refreshing.has(d.id)) return;
  refreshing.add(d.id);
  renderDatasetTabs();
  try {
    // Tickaroo-liveblogs verversen via hun API; de paginafetch van de site zelf wordt soms geweigerd
    let result;
    if (d.tickaroo) {
      const t = d.tickaroo;
      const doc = new DOMParser().parseFromString(
        `<link rel="canonical" href="${escAttr(t.canonicalUrl || d.sourceUrl)}"><meta property="og:title" content="${escAttr(t.title || '')}">`, 'text/html');
      result = await fetchTickarooLiveblogRows(t, doc);
    } else {
      result = await parseLiveblogAny(await requestPage(d.sourceUrl), d.sourceUrl);
    }
    if (!result?.rows?.length) throw new Error('geen liveblog-updates gevonden in de pagina');
    const before = d.rowCount;
    const headers = withExtraHeaders(result.headers);
    const n = replaceDatasetRows(d.id, fixPlaceholderMedia(result.rows), headers, !result.authoritative);
    autoMap();
    renderAll();
    enrichLinkPremium();
    if (!silent || n !== before) toast(`${d.label}: ${n} updates${n > before ? ` (+${n - before} nieuw)` : ''}.`);
  } catch (err) {
    console.error('Verversen mislukt:', err);
    if (!silent) toast(`Verversen mislukt: ${err.message || err}`);
  } finally {
    refreshing.delete(d.id);
    renderDatasetTabs();
  }
}

function refreshAll(silent = false) {
  (state.datasets || []).filter(d => d.active && d.sourceUrl).forEach(d => refreshDataset(d, silent));
}

setInterval(() => { if (state.settings.autoRefresh && extensionBridge) refreshAll(true); }, 120000);

function renderDatasetTabs() {
  const host = $('#datasetTabs');
  if (!host) return;
  const ds = state.datasets || [];
  host.hidden = !ds.length;
  if (!ds.length) {
    host.innerHTML = '';
    return;
  }

  host.innerHTML = '';
  ds.forEach(d => {
    const row = document.createElement('div');
    row.className = `dataset-row ${d.active ? 'on' : 'off'}`;
    const brandCol = state.mapping.brand;
    const dsTitle = brandCol ? state.rows.find(r => r.__datasetId === d.id && r[brandCol])?.[brandCol] : '';
    const kindIcon = d.kind === 'liveblog' ? 'dynamic_feed' : d.kind === 'reach' ? 'monitoring' : 'table';
    const kindMeta = d.kind === 'liveblog' ? `Liveblog \u00b7 ${d.rowCount} posts`
      : d.kind === 'reach' ? (d.totals ? `Totaalcijfers per titel \u00b7 ${d.rowCount} rijen` : `Bereik per uur \u00b7 ${d.rowCount} rijen`) : `Tabel \u00b7 ${d.rowCount} rijen`;
    row.innerHTML = `
      ${titleIconHtml(dsTitle, 'dataset-icon') || `<span class="ms dataset-kind">${kindIcon}</span>`}
      <div class="dataset-main">
        <span class="name" title="${escAttr(d.label)}">${esc(d.label)}</span>
        <span class="meta">${esc(kindMeta)}</span>
      </div>
      ${d.sourceUrl && extensionBridge ? `<button class="icon-btn refresh${refreshing.has(d.id) ? ' busy' : ''}" title="Verversen vanaf de bron" aria-label="Verversen"><span class="ms">refresh</span></button>` : ''}
      <button class="icon-btn" data-act="remove" title="Verwijderen" aria-label="Verwijderen"><span class="ms">delete</span></button>
      <label class="switch" title="${d.active ? 'Uitzetten' : 'Aanzetten'}"><input type="checkbox" ${d.active ? 'checked' : ''}><span></span></label>`;

    $('.refresh', row)?.addEventListener('click', () => refreshDataset(d));

    $('.switch input', row).addEventListener('change', () => {
      d.active = !d.active;
      renderAll();
    });

    $('[data-act=remove]', row).addEventListener('click', () => {
      state.rows = state.rows.filter(r => r.__datasetId !== d.id).map((r, idx) => ({ ...r, __id: idx }));
      state.datasets = state.datasets.filter(x => x.id !== d.id);
      state.removed = [];
      if (!state.datasets.some(x => x.active) && state.datasets.length) state.datasets[0].active = true;
      if (!state.rows.length) {
        state.headers = [];
        state.metrics = [];
        state.mapping = defaultState().mapping;
      }
      renderAll();
    });

    host.appendChild(row);
  });
}

function loadData(text, silent, opts = {}) {
  text = (text || '').trim();
  if (!text) return;
  const sourceUrl = opts.sourceUrl || sourceUrlFromHtml(text);

  const safeParse = (fn) => {
    try {
      return fn(text);
    } catch (err) {
      console.warn(`Parser ${fn.name || '(anoniem)'} faalde:`, err);
      return null;
    }
  };

  // Timepath-widgets (o.a. RTL) laden hun echte updates pas na JS-hydratie; die data
  // halen we rechtstreeks op bij dezelfde publieke API die de widget zelf gebruikt.
  const timepathEmbed = safeParse(detectTimepathEmbed);
  if (timepathEmbed) {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    if (!silent) toast('Live-updates ophalen via Timepath…');
    fetchTimepathLiveblogRows(timepathEmbed, doc)
      .then(result => {
        if (!result) {
          if (!silent) toast('Timepath gaf geen updates terug.');
          return;
        }
        state.raw = text;
        applyLiveblogResult(result, silent, sourceUrl);
      })
      .catch(err => {
        console.error('Timepath fetch mislukt:', err);
        if (!silent) toast(`Timepath ophalen mislukt: ${err?.message || err}`);
      });
    return;
  }

  if ((extensionBridge && safeParse((t) => detectDpgLiveblog(t, sourceUrl))) || safeParse(detectTickarooEmbed)) {
    if (!silent) toast('Alle posts ophalen…');
    parseLiveblogAny(text, sourceUrl)
      .then(result => {
        if (!result) {
          if (!silent) toast('Geen liveblog-updates gevonden.');
          return;
        }
        state.raw = text;
        applyLiveblogResult(result, silent, sourceUrl);
      })
      .catch(err => {
        console.error('Liveblog ophalen mislukt:', err);
        if (!silent) toast(`Liveblog ophalen mislukt: ${err?.message || err}`);
      });
    return;
  }

  const liveblog = safeParse(tryParseVrtLiveblog)
    || safeParse(tryParseLiveblogHtml)
    || safeParse(tryParseLiveblogEmbeddedJsonHtml)
    || safeParse(tryParseLiveblogPlainText);
  if (liveblog) {
    state.raw = text;
    applyLiveblogResult(liveblog, silent, sourceUrl);
    return;
  }

  let table = [];
  // een webpagina zonder herkenbare liveblog is geen tabel; anders ontstaat een dataset vol HTML-kolommen
  if (/^\s*(<!doctype html|<html[\s>])/i.test(text)) {
    if (!silent) {
      toast(/myprivacy|privacygate|consent/i.test(sourceUrl + text.slice(0, 3000))
        ? 'Dit is de cookiemelding van de site. Accepteer die eerst en voeg de liveblog daarna opnieuw toe.'
        : 'Geen liveblog herkend op deze pagina.');
    }
    return;
  }
  try {
    table = parseCSV(text, detectDelimiter(text));
  } catch {
    table = [];
  }
  if (table.length < 2) {
    const lastResort = safeParse(tryParseLiveblogLastResort);
    if (lastResort) {
      state.raw = text;
      if (applyLiveblogResult(lastResort, true)) {
        if (!silent) toast('Geen tabel of tijdstempels herkend — als losse update toegevoegd.');
        return;
      }
    }
    if (!silent) toast('Er is een kopregel én minstens één datarij nodig, of een tijdstip (bijv. 21:25) in de tekst.');
    return;
  }

  const headers = table[0].map((h, i) => (h.trim() || `Kolom ${i + 1}`));
  const rows = table.slice(1).map((cells) => {
    const o = {};
    headers.forEach((h, i) => { o[h] = (cells[i] ?? '').trim(); });
    return o;
  });
  const reach = reachFromTable(headers, rows);
  if (reach) {
    state.datasets.push({ id: crypto.randomUUID(), label: makeUniqueDatasetLabel(`Bereik ${localDateOf(reach[0].t)}`), kind: 'reach', rowCount: reach.length, active: true, reach });
    renderAll();
    if (!silent) toast(`Bereikdata toegevoegd: ${new Set(reach.map(r => r.title)).size} titels. Te zien in de grafiek per uur en de vergelijking.`);
    return;
  }
  const totals = reach ? null : totalsFromTable(headers, rows);
  if (totals) {
    state.datasets.push({ id: crypto.randomUUID(), label: makeUniqueDatasetLabel('Totaalcijfers'), kind: 'reach', rowCount: totals.rows.length, active: true, totals });
    renderAll();
    if (!silent) toast(`Totaalcijfers toegevoegd: ${totals.rows.length} titels. Te zien in de vergelijking en het spreidingsdiagram.`);
    return;
  }
  state.raw = text;
  const n = appendDataset(rows, headers, { label: 'Data', kind: 'table' });
  if (!n) {
    if (!silent) toast('Data kon niet worden toegevoegd.');
    return;
  }
  state.removed = [];
  autoMap();
  renderAll();
  if (!silent) toast(`${n} rijen toegevoegd (${getActiveRows().length} actief).`);
}

function autoMap() {
  const find = (...pats) => state.headers.find(h => pats.some(p => h.toLowerCase().includes(p))) || null;
  const m = state.mapping;
  if (!state.headers.includes(m.time)) m.time = find('tijd', 'time', 'uur', 'verstuur', 'sent', 'timestamp', 'datum');
  if (!state.headers.includes(m.title)) m.title = find('titel', 'title', 'kop', 'headline', 'bericht', 'message', 'push');
  if (!state.headers.includes(m.body)) m.body = find('update_tekst', 'inhoud', 'tekst', 'content', 'body', 'description', 'samenvatting');
  if (!state.headers.includes(m.link)) m.link = find('artikel_link', 'link_in_tekst');
  if (!state.headers.includes(m.brand)) m.brand = find('merk', 'brand', 'bron', 'source', 'label', 'site');
  const exact = (...names) => state.headers.find(h => names.includes(h.toLowerCase())) || null;
  if (!state.headers.includes(m.video)) m.video = exact('video', 'heeft_video', 'met video');
  if (!state.headers.includes(m.social)) m.social = exact('social', 'social_embed', 'embed');
  if (!state.headers.includes(m.dataviz)) m.dataviz = exact('dataviz', 'datavisualisatie', 'grafiek');
  if (!state.headers.includes(m.linkPremium)) m.linkPremium = exact('link_premium', 'premium_link', 'link naar premium');
  if (!state.headers.includes(m.premium)) m.premium = find('premium', 'paywall', 'plus', 'betaald');
  if (!state.headers.includes(m.articleUrl)) {
    m.articleUrl = find('article_url', 'article url', 'artikel_url', 'artikel url', 'url', 'link', 'permalink', 'href');
  }
  if (!state.headers.includes(m.articleType)) {
    m.articleType = find('article_type', 'article type', 'articletype', 'artikel_type', 'artikel type', 'content type', 'type');
  }
  if (!state.headers.includes(m.image)) {
    m.image = find('afbeelding', 'image', 'foto', 'thumbnail', 'thumb', 'img')
      || state.headers.find(h => state.rows.some(r => isHttpUrl(r[h]))) || null;
  }

  state.metrics = state.metrics.filter(mt => !mt.column || state.headers.includes(mt.column));
  rebuildBrands();
  autoRange();
}

function newMetric(column) {
  const name = (column || '').toLowerCase();
  let icon = 'bar-chart-3';
  if (/open/.test(name)) icon = 'mail-open';
  else if (/ctr|click|klik/.test(name)) icon = 'mouse-pointer-click';
  else if (/view|weergave|pageview|pv/.test(name)) icon = 'eye';
  else if (/user|bezoeker|gebruiker/.test(name)) icon = 'users';
  else if (/tijd|time|duur/.test(name)) icon = 'clock';
  else if (/omzet|revenue|euro/.test(name)) icon = 'euro';
  else if (/abo|subs/.test(name)) icon = 'credit-card';
  return { id: crypto.randomUUID(), column: column || null, label: column || '', icon, format: guessFormat(column, name) };
}

function guessFormat(column, name) {
  if (/ctr|percent|rate|aandeel|share/.test(name || '')) return 'percent';
  if (!column) return 'raw';
  const samples = state.rows.slice(0, 20).map(r => String(r[column] ?? '')).filter(Boolean);
  if (!samples.length) return 'raw';
  if (samples.some(v => v.includes('%'))) return 'percent';
  if (samples.every(v => parseNumber(v) !== null)) return 'number';
  return 'raw';
}

/* ============================================================
   Getallen, tijd, kleur, URL
   ============================================================ */
function parseNumber(v) {
  if (v === null || v === undefined) return null;
  let s = String(v).trim().replace(/[%\s\u00A0]/g, '');
  if (!s || !/\d/.test(s)) return null;
  s = s.replace(/[^0-9.,\-]/g, '');
  const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lastComma > -1) {
    const parts = s.split(',');
    const dec = s.length - lastComma - 1;
    // 1,298,332: meerdere komma's met steeds drie cijfers erna zijn altijd duizendtallen
    const thousands = parts.length > 2 ? parts.slice(1).every(p => p.length === 3) : (dec === 3 && s[0] !== '0');
    s = thousands ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (lastDot > -1) {
    const dec = s.length - lastDot - 1;
    if (dec === 3 && s.split('.').length >= 2) s = s.replace(/\./g, '');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function formatValue(raw, format, opts = {}) {
  if (format === 'raw') return raw ?? '';
  const n = parseNumber(raw);
  if (n === null) return raw ?? '';
  if (format === 'number') {
    if (opts.roundWhole) return Math.round(n).toLocaleString('nl-NL');
    return n.toLocaleString('nl-NL', { maximumFractionDigits: 2 });
  }
  if (format === 'percent') return n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  if (format === 'compact') return formatCompact3(n, !!opts.roundWhole);
  return String(raw);
}

// drie significante cijfers: 2,31M · 168k · 12,3k · 672 · 1,21
const sig3 = (v) => formatCompact3(v, Number.isInteger(v) || Math.abs(v) >= 100);

function formatCompact3(n, roundWhole) {
  const abs = Math.abs(n);
  const units = [
    { value: 1e9, suffix: 'B' },
    { value: 1e6, suffix: 'M' },
    { value: 1e3, suffix: 'k' }
  ];

  const unit = units.find(u => abs >= u.value);
  if (!unit) {
    if (abs === 0) return '0';
    if (roundWhole) return Math.round(n).toLocaleString('nl-NL');
    const digits = Math.max(0, 2 - Math.floor(Math.log10(abs)));
    return n.toLocaleString('nl-NL', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  const scaled = n / unit.value;
  const absScaled = Math.abs(scaled);
  const digits = absScaled >= 100 ? 0 : absScaled >= 10 ? 1 : 2;
  const txt = scaled.toLocaleString('nl-NL', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
  return `${txt}${unit.suffix}`;
}

function parseTime(v) {
  if (!v) return null;
  const raw = String(v).trim();

  // Volledige datum+tijd krijgt absolute minuten sinds epoch, zodat lange perioden mogelijk zijn.
  if (/\d{4}-\d{1,2}-\d{1,2}|\b\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4}\b/.test(raw)) {
    if (/[zZ]|[+-]\d{2}:?\d{2}/.test(raw)) {
      const dAbs = new Date(raw);
      if (!Number.isNaN(dAbs.getTime())) return dAbs.getTime() / 60000;
    }
    const tzParsed = parseNaiveDateTimeInTz(raw, NEWS_TZ);
    if (tzParsed !== null) return tzParsed;
    const dAbs = new Date(raw);
    if (!Number.isNaN(dAbs.getTime())) return dAbs.getTime() / 60000;
  }

  // datumdeel eerst weghalen, anders wordt 11-11-2026 als tijd gelezen
  const s = raw
    .replace(/\d{4}-\d{1,2}-\d{1,2}/, ' ')
    .replace(/\b\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4}\b/, ' ');
  const m = s.match(/(\d{1,2})[:.hu](\d{2})(?::(\d{2}))?/);
  if (m) return (+m[1]) * 60 + (+m[2]) + (m[3] ? +m[3] / 60 : 0);
  const d = new Date(raw);
  if (!isNaN(d)) return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
  return null;
}
const minutesToLabel = (min) => {
  const t = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.round(t % 60)).padStart(2, '0')}`;
};

const isAbsoluteMinutes = (min) => Number.isFinite(min) && Math.abs(min) > 30000;

function timeLabel(min) {
  if (isAbsoluteMinutes(min)) {
    const d = new Date(min * 60000);
    try {
      return new Intl.DateTimeFormat('nl-NL', {
        timeZone: NEWS_TZ,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
      }).format(d);
    } catch {
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
  }
  return minutesToLabel(min);
}

function monthDayLabel(min) {
  if (!isAbsoluteMinutes(min)) return minutesToLabel(min);
  const d = new Date(min * 60000);
  try {
    return new Intl.DateTimeFormat('nl-NL', {
      timeZone: NEWS_TZ,
      month: '2-digit',
      day: '2-digit'
    }).format(d).replace(/[-.]/g, '/');
  } catch {
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  }
}

function timeInputLabel(min) {
  if (!isAbsoluteMinutes(min)) return minutesToLabel(min);
  const d = new Date(min * 60000);
  try {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: NEWS_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).format(d).replace('T', ' ');
  } catch {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}

function isCountMetric(column, label) {
  const text = `${String(column || '')} ${String(label || '')}`.toLowerCase();
  if (!text.trim()) return false;

  if (/(ctr|percent|percentage|rate|ratio|share|aandeel|tijd|time|duur|avg|gemidd|mean|mediaan|median|euro|omzet|revenue|prijs|cost|waarde)/.test(text)) {
    return false;
  }
  return /(count|aantal|open|click|klik|view|weergave|pageview|pv|user|gebruiker|bezoeker|artikel|article|session|sessie|abonn|subscriber|push|notification|notif|reactie|comment|like|share|play|impression|vertoning|volume)/.test(text);
}

/** Verschil in minuten t.o.v. het eerste bericht. */
function relLabel(diff, withUnit) {
  const m = Math.round(diff);
  if (m === 0) return withUnit ? '0 min' : '0';
  const sign = m > 0 ? '+' : '−';
  const a = Math.abs(m);
  if (a < 60) return `${sign}${a}${withUnit ? ' min' : ''}`;
  return `${sign}${Math.floor(a / 60)}u${String(a % 60).padStart(2, '0')}`;
}

/** Datum uit het tijdstip-veld, of null als er alleen een tijd in staat. */
function parseDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/\b(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})\b/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}

function dateLabel(items) {
  const col = state.mapping.time;
  if (!col) return '';
  const days = [...new Set(items.map(it => parseDate(it.row[col])).filter(Boolean).map(d => d.getTime()))].sort((a, b) => a - b);
  if (!days.length) return '';
  const fmt = t => new Date(t).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  return days.length === 1 ? cap(fmt(days[0])) : `${cap(fmt(days[0]))} t/m ${cap(fmt(days[days.length - 1]))}`;
}

function hexToHsl(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = [...h].map(c => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let hu = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > .5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hu = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) hu = (b - r) / d + 2;
    else hu = (r - g) / d + 4;
    hu *= 60;
  }
  return [hu, s * 100, l * 100];
}
function onContainerColor(hex) {
  const [h, s] = hexToHsl(hex);
  const sat = s < 8 ? 6 : Math.min(85, Math.max(35, s * 1.6));
  return `hsl(${h.toFixed(0)}, ${sat.toFixed(0)}%, 17%)`;
}

function hostFromUrl(url) {
  if (!isHttpUrl(url)) return '';
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function faviconUrlFromHost(host) {
  const clean = String(host || '').trim().toLowerCase();
  if (!clean) return '';
  // Clearbit's gratis logo-API is onbetrouwbaar/uitgefaseerd; Google's favicon-dienst is stabieler als eerste keuze.
  return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(`https://${clean}`)}&sz=${FAVICON_SIZE}`;
}

function faviconBackupUrlFromHost(host) {
  const clean = String(host || '').trim().toLowerCase();
  if (!clean) return '';
  return `https://logo.clearbit.com/${encodeURIComponent(clean)}?size=${FAVICON_SIZE}`;
}

function faviconThirdUrlFromHost(host) {
  const clean = String(host || '').trim().toLowerCase();
  if (!clean) return '';
  return `https://icons.duckduckgo.com/ip3/${encodeURIComponent(clean)}.ico`;
}

function faviconSiteUrlFromHost(host) {
  const clean = String(host || '').trim().toLowerCase();
  if (!clean) return '';
  return `https://${clean}/favicon.ico`;
}

function faviconFallbackList(host) {
  const list = [
    faviconBackupUrlFromHost(host),
    faviconThirdUrlFromHost(host),
    faviconSiteUrlFromHost(host)
  ].filter(Boolean);
  return [...new Set(list)];
}

function fallbackHostFromBrand(brandValue) {
  const key = norm(brandValue);
  if (!key) return '';
  return BRAND_HOST_FALLBACK[key] || '';
}

function inferHostFromLogoValue(logoValue) {
  const raw = String(logoValue || '').trim();
  if (!raw) return '';
  const fromUrl = hostFromUrl(raw);
  if (fromUrl) return fromUrl;
  const fromBrand = fallbackHostFromBrand(raw);
  if (fromBrand) return fromBrand;
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(raw)) return raw.toLowerCase();
  return '';
}

function onBrandLogoError(el) {
  if (!el) return;
  const all = String(el.dataset.fallbacks || '').split('|').filter(Boolean);
  const tried = new Set(String(el.dataset.tried || '').split('|').filter(Boolean));
  const next = all.find(u => !tried.has(u));
  if (next) {
    tried.add(next);
    el.dataset.tried = [...tried].join('|');
    el.src = next;
    return;
  }
  const label = String(el.dataset.brandText || '').trim();
  if (!label) {
    el.remove();
    return;
  }
  const span = document.createElement('span');
  span.className = 'brand-text';
  span.textContent = label;
  el.replaceWith(span);
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function toneFromHex(hex, opts = {}) {
  const [h, s] = hexToHsl(hex);
  const sat = clamp(s * (opts.sMul ?? 1), opts.sMin ?? 0, opts.sMax ?? 100);
  const light = clamp(opts.l ?? 50, 0, 100);
  const alpha = opts.alpha;
  if (alpha !== undefined && alpha < 1) {
    return `hsla(${h.toFixed(0)}, ${sat.toFixed(0)}%, ${light.toFixed(0)}%, ${alpha})`;
  }
  return `hsl(${h.toFixed(0)}, ${sat.toFixed(0)}%, ${light.toFixed(0)}%)`;
}

const TRUTHY = new Set(['ja', 'yes', 'y', 'true', 'waar', '1', 'x', 'premium', 'plus', 'paywall']);
const isPremium = (v) => TRUTHY.has(String(v ?? '').trim().toLowerCase());
const isHttpUrl = (v) => /^https?:\/\/\S+$/i.test(String(v ?? '').trim());
const isLiveType = (v) => /\bLIVE(?:\s*[-_]?\s*BLOG)?\b/i.test(String(v ?? '').trim());
const NEWS_TZ = 'Europe/Amsterdam';

function tzOffsetMinutes(timeZone, dateLike) {
  try {
    const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(date);
    const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT+0';
    const m = tzPart.match(/GMT(?<sign>[+-])(?<hh>\d{1,2})(?::?(?<mm>\d{2}))?/i);
    if (!m) return 0;
    const sign = m.groups?.sign === '-' ? -1 : 1;
    const hh = +(m.groups?.hh || 0);
    const mm = +(m.groups?.mm || 0);
    return sign * (hh * 60 + mm);
  } catch {
    return 0;
  }
}

function parseNaiveDateTimeInTz(raw, timeZone = NEWS_TZ) {
  const m = String(raw || '').trim().match(/^(?<y>\d{4})-(?<mo>\d{1,2})-(?<d>\d{1,2})[ T](?<h>\d{1,2}):(?<mi>\d{2})(?::(?<s>\d{2})(?:\.\d+)?)?$/);
  if (!m) return null;
  const y = +(m.groups?.y || 0);
  const mo = +(m.groups?.mo || 0);
  const d = +(m.groups?.d || 0);
  const h = +(m.groups?.h || 0);
  const mi = +(m.groups?.mi || 0);
  const s = +(m.groups?.s || 0);
  if (!y || !mo || !d) return null;
  const utcGuess = Date.UTC(y, mo - 1, d, h, mi, s);
  const offsetMin = tzOffsetMinutes(timeZone, utcGuess);
  return (utcGuess - offsetMin * 60000) / 60000;
}

function needsImageProxy(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    // DPG Media-, RTL- en Mediahuis-merken blokkeren cross-origin hotlinking op hun beeld-CDN's.
    return host.includes('dpgmedia.net')
      || host.includes('dnr.dpgmedia.net')
      || host.includes('ad.nl')
      || host.includes('volkskrant.nl')
      || host.includes('trouw.nl')
      || host.includes('parool.nl')
      || host.includes('demorgen.be')
      || host.includes('hln.be')
      || host.includes('rtl.nl')
      || host.includes('telegraaf.nl');
  } catch {
    return false;
  }
}

function toProxyImageUrl(url) {
  if (!isHttpUrl(url)) return url;
  try {
    const u = new URL(url);
    const target = `${u.host}${u.pathname}${u.search}`;
    return `https://images.weserv.nl/?url=${encodeURIComponent(target)}&output=jpg`;
  } catch {
    return url;
  }
}

function isLiveblog(vTitle, vType) {
  const s = String(vTitle ?? '').trim();
  const t = String(vType ?? '').trim();
  return /\bLIVE\b/i.test(s) || s.includes('|') || isLiveType(t);
}

/* ---------- afbeeldingen: inladen als data-URL zodat de export altijd werkt ---------- */
const imgCache = new Map();
const imgPending = new Set();
function imageFor(url) {
  if (!isHttpUrl(url)) return null;
  const cached = imgCache.get(url);
  if (cached) return cached === 'raw' ? url : cached;
  if (!imgPending.has(url)) {
    imgPending.add(url);
    const asDataUrl = (blob) => new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob);
    });
    // een trage beeldserver mag de rest niet ophouden
    const fetchBlob = (u) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      return fetch(u, { mode: 'cors', signal: ctrl.signal })
        .then(r => { if (!r.ok) throw new Error('http'); return r.blob(); })
        .finally(() => clearTimeout(timer));
    };
    // bekende hotlink-blokkerende hosts direct via de proxy, anders eerst rechtstreeks proberen
    const first = needsImageProxy(url) ? toProxyImageUrl(url) : url;

    fetchBlob(first)
      .then(asDataUrl)
      .then(d => imgCache.set(url, d))
      .catch(() => {
        const proxyUrl = toProxyImageUrl(url);
        if (proxyUrl === first) throw new Error('no-proxy');
        return fetchBlob(proxyUrl)
          .then(asDataUrl)
          .then(d => imgCache.set(url, d));
      })
      .catch(() => imgCache.set(url, 'raw'))
      .finally(() => { imgPending.delete(url); scheduleTimeline(); });
  }
  return url;
}

/* ============================================================
   Merken & logo's
   ============================================================ */
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

function brandFaviconFromRows(brandValue, rows, brandCol, urlCol) {
  const host = rows
    .filter(r => String(r?.[brandCol] || '') === String(brandValue || ''))
    .map(r => hostFromUrl(urlCol ? r?.[urlCol] : ''))
    .find(Boolean);

  if (host) return faviconUrlFromHost(host);

  const fallbackHost = fallbackHostFromBrand(brandValue);
  return fallbackHost ? faviconUrlFromHost(fallbackHost) : '';
}

function canonicalBrandKey(brandValue) {
  const n = norm(brandValue);
  if (!n) return '';
  let best = '', bestLen = 0;
  for (const [key, aliases] of Object.entries(LOGO_ALIASES)) {
    for (const alias of [norm(key), ...aliases.map(norm)]) {
      if (!alias) continue;
      const exact = alias === n;
      const partial = alias.length >= 3 && n.includes(alias);
      const score = exact ? 99 : alias.length;
      if ((exact || partial) && score > bestLen) { best = key; bestLen = score; }
    }
  }
  return best;
}

// Sommige liveblogs gebruiken in hun data de uitgeefgroep (holding) i.p.v. het merk zelf;
// corrigeer dat met terugwerkende kracht aan de hand van de artikel-URL, ook in al opgeslagen rijen.
const HOLDING_BRAND_NAMES = new Set(['mediahuis', 'mediahuis netherlands', 'dpg media', 'dpg media nederland', 'talpa', 'talpa network']);
function fixHoldingBrandNames() {
  const col = state.mapping.brand;
  const urlCol = state.mapping.articleUrl;
  if (!col || !urlCol) return;
  state.rows.forEach(r => {
    const name = String(r[col] || '').trim();
    if (!name || !HOLDING_BRAND_NAMES.has(name.toLowerCase())) return;
    const fixed = detectBrandFromUrl(r[urlCol]);
    if (!fixed || fixed === name) return;
    if (r.bron === name) r.bron = fixed;
    r[col] = fixed;
  });
}

function rebuildBrands() {
  fixHoldingBrandNames();
  const col = state.mapping.brand;
  if (!col) { state.brands = {}; return; }
  const urlCol = state.mapping.articleUrl;
  // alle datasets meenemen, zodat icoon en kleur blijven bestaan als een dataset uit en weer aan gaat
  const activeRows = state.rows;
  const seen = [];
  activeRows.forEach(r => { const v = r[col]; if (v && !seen.includes(v)) seen.push(v); });
  const next = {};
  seen.forEach((name, i) => {
    const prev = state.brands[name];
    const rowHost = activeRows
      .filter(r => String(r?.[col] || '') === String(name || ''))
      .map(r => hostFromUrl(urlCol ? r?.[urlCol] : ''))
      .find(Boolean);
    const fallbackHost = titleHost(name, rowHost);
    const host = fallbackHost || inferHostFromLogoValue(prev?.logo) || inferHostFromLogoValue(prev?.logoHost);
    const logo = host ? faviconUrlFromHost(host) : brandFaviconFromRows(name, activeRows, col, urlCol);
    const key = canonicalBrandKey(name);
    next[name] = {
      logo,
      logoHost: host,
      logoKey: key,
      color: prev ? prev.color : (BRAND_COLORS[key] || PALETTE[i % PALETTE.length])
    };
  });
  state.brands = next;
}

const logoSrc = (src) => {
  if (isHttpUrl(src) || String(src || '').startsWith('data:')) return src;
  const host = inferHostFromLogoValue(src);
  return host ? faviconUrlFromHost(host) : null;
};

/* Logo-bibliotheek: eerst favicons.js (meegeleverd), dan een cache in de browser.
   Onbekende titels worden één keer opgehaald en bewaard, zodat ze daarna direct beschikbaar zijn. */
const FAVICON_CACHE_KEY = 'reconstruct.favicons.v1';
const faviconCache = (() => {
  try { return JSON.parse(localStorage.getItem(FAVICON_CACHE_KEY) || '{}') || {}; } catch { return {}; }
})();
const faviconPending = new Set();

function domainKeys(host) {
  let k = String(host || '').trim().toLowerCase().replace(/^www\./, '');
  const out = [];
  while (k.split('.').length >= 2) {
    out.push(k);
    k = k.slice(k.indexOf('.') + 1);
  }
  return out;
}

function libraryFavicon(host) {
  const lib = typeof FAVICONS !== 'undefined' ? FAVICONS : {};
  for (const k of domainKeys(host)) {
    if (lib[k]) return lib[k];
    if (faviconCache[k]) return faviconCache[k];
  }
  return '';
}

function cacheFavicon(host) {
  const key = domainKeys(host)[0];
  if (!key || faviconPending.has(key) || faviconCache[key]) return;
  faviconPending.add(key);
  // via weserv omdat Google's favicon-dienst geen CORS-header meestuurt
  const target = `www.google.com/s2/favicons?domain_url=https://${key}&sz=128`;
  fetch(`https://images.weserv.nl/?url=${encodeURIComponent(target)}&output=png`)
    .then(r => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
    .then(blob => new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    }))
    .then(dataUrl => {
      faviconCache[key] = dataUrl;
      try { localStorage.setItem(FAVICON_CACHE_KEY, JSON.stringify(faviconCache)); } catch { /* vol */ }
      renderDatasetTabs();
      renderBrands();
      scheduleTimeline();
    })
    .catch(() => { /* valt terug op de externe favicon-URL's */ })
    .finally(() => faviconPending.delete(key));
}

/* Vaste koppeling titel → domein: eerst de ingebouwde lijst, dan wat eerder is geleerd en bewaard.
   Zo krijgt een titel altijd hetzelfde icoon, ongeacht welke link toevallig in de data staat. */
const TITLE_HOST_KEY = 'reconstruct.titlehosts.v1';
const titleHostCache = (() => {
  try { return JSON.parse(localStorage.getItem(TITLE_HOST_KEY) || '{}') || {}; } catch { return {}; }
})();
const NOT_A_TITLE_HOST_RE = /(^|\.)(timepath\.co|tickaroo\.com|invalid\.local|weserv\.nl|google\.com|googleapis\.com)$/i;

function titleHost(name, candidateHost = '') {
  const known = fallbackHostFromBrand(name);
  if (known) return known;
  const key = norm(name);
  if (key && titleHostCache[key]) return titleHostCache[key];
  const host = String(candidateHost || '').toLowerCase();
  if (!domainKeys(host).length || NOT_A_TITLE_HOST_RE.test(host)) return '';
  if (key) {
    titleHostCache[key] = host;
    try { localStorage.setItem(TITLE_HOST_KEY, JSON.stringify(titleHostCache)); } catch { /* vol */ }
  }
  return host;
}

function brandLogo(brand, name) {
  const host = titleHost(name, brand?.logoHost);
  const fromLibrary = host ? libraryFavicon(host) : '';
  if (fromLibrary) return fromLibrary;
  if (host) {
    cacheFavicon(host);
    return faviconUrlFromHost(host);
  }
  return logoSrc(brand?.logo);
}

/** Klein icoon van een titel voor in pillen en legenda's. */
function titleIconHtml(name, cls = 'pill-icon') {
  if (!name) return '';
  const src = brandLogo(state.brands[name], name);
  if (!src) return '';
  const host = titleHost(name, state.brands[name]?.logoHost);
  return `<img class="${cls}" src="${escAttr(src)}" data-fallbacks="${escAttr(faviconFallbackList(host).join('|'))}" data-brand-text="" onerror="onBrandLogoError(this)" alt="">`;
}

const logoRatioCache = new Map();
const logoRatioPending = new Set();

function logoRatio(key) {
  if (!key) return 2;
  const cached = logoRatioCache.get(key);
  if (cached) return cached;

  const src = logoSrc(key);
  if (!src) return 2;

  logoRatioCache.set(key, 2);
  if (!logoRatioPending.has(key)) {
    logoRatioPending.add(key);
    const img = new Image();
    img.onload = () => {
      const ratio = img.naturalWidth > 0 && img.naturalHeight > 0
        ? (img.naturalWidth / img.naturalHeight)
        : 2;
      logoRatioCache.set(key, ratio);
      logoRatioPending.delete(key);
      scheduleTimeline();
    };
    img.onerror = () => {
      logoRatioPending.delete(key);
    };
    img.src = src;
  }

  return 2;
}

/* ============================================================
   Tijdbereik
   ============================================================ */
/* ---------- dagselectie: hele (lokale) dagen als periode ---------- */
function localDateOf(min) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: NEWS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date(min * 60000));
  } catch {
    return new Date(min * 60000).toISOString().slice(0, 10);
  }
}

function addDays(dateStr, n) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const dayStartMinutes = (dateStr) => parseNaiveDateTimeInTz(`${dateStr} 00:00`, NEWS_TZ);

/** Beschikbare dagen in de actieve data, met aantal updates per dag. */
function availableDays() {
  const col = state.mapping.time;
  if (!col) return [];
  const counts = new Map();
  getActiveRows().forEach(r => {
    const t = parseTime(r[col]);
    if (t === null || !isAbsoluteMinutes(t)) return;
    const d = localDateOf(t);
    counts.set(d, (counts.get(d) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, n]) => ({ date, n }));
}

/** Grenzen (minuten) van de gekozen dagperiode, of null als er geen periode is gekozen. */
function periodBounds() {
  const s = state.settings;
  if (!s.periodFrom && !s.periodTo) return null;
  const from = s.periodFrom || s.periodTo;
  const to = s.periodTo || s.periodFrom;
  const lo = dayStartMinutes(from);
  const hi = dayStartMinutes(addDays(to, 1));
  return lo === null || hi === null ? null : { lo, hi };
}

function applyWholeDays() {
  const b = periodBounds();
  if (!b) {
    state.settings.autoFit = true;
    state.settings.rangeMode = 'compact';
    autoRange();
    return;
  }
  state.settings.autoFit = false;
  state.settings.rangeMode = 'days';
  state.settings.startTime = timeInputLabel(b.lo);
  state.settings.endTime = timeInputLabel(b.hi);
}

function autoRange() {
  const col = state.mapping.time;
  // alleen zichtbare tegels (geen verborgen merken of verwijderde tegels) bepalen het venster
  let times = visibleItems().map(it => it.minutes);
  if (!times.length && col) times = getActiveRows().map(r => parseTime(r[col])).filter(t => t !== null);
  if (!times.length) times = reachRows().map(r => r.t);
  // binnen een gekozen dagperiode alleen de tegels van die dagen meenemen
  const period = periodBounds();
  if (period) {
    const inPeriod = times.filter(t => t >= period.lo && t < period.hi);
    if (inPeriod.length) times = inPeriod;
    else {
      state.settings.startTime = timeInputLabel(period.lo);
      state.settings.endTime = timeInputLabel(period.hi);
      return;
    }
  }
  if (!times.length) return;
  let lo = Math.min(...times), hi = Math.max(...times);
  // hooguit op hele uren afronden, anders levert een lange periode tot een dag extra lege ruimte op
  const step = Math.min(60, niceStep(Math.max(1, hi - lo)));
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  if (hi - lo < step) hi = lo + step;
  state.settings.startTime = timeInputLabel(lo);
  state.settings.endTime = timeInputLabel(hi);
}

function rangeMinutes() {
  const s = state.settings;
  let start = parseTime(s.startTime);
  let end = parseTime(s.endTime);
  if (start === null) start = 0;
  if (end === null || end <= start) end = start + 5;
  return { start, end, span: end - start };
}

/* ============================================================
   Sidebar
   ============================================================ */
function fillSelect(select, selected, emptyLabel) {
  select.innerHTML = `<option value="">${esc(emptyLabel)}</option>` +
    state.headers.map(h => `<option value="${escAttr(h)}" ${h === selected ? 'selected' : ''}>${esc(h)}</option>`).join('');
  select.disabled = !state.headers.length;
}

function renderMapping() {
  fillSelect($('#mapTime'), state.mapping.time, '— kies kolom —');
  fillSelect($('#mapTitle'), state.mapping.title, '— kies kolom —');
  fillSelect($('#mapBrand'), state.mapping.brand, '— geen merk —');
  fillSelect($('#mapBody'), state.mapping.body, '— geen inhoud —');
  fillSelect($('#mapLink'), state.mapping.link, '— geen link —');
  fillSelect($('#mapImage'), state.mapping.image, '— geen afbeelding —');
  fillSelect($('#mapArticleUrl'), state.mapping.articleUrl, '— geen artikel-URL —');
  fillSelect($('#mapArticleType'), state.mapping.articleType, '— geen ARTICLE_TYPE —');
  fillSelect($('#mapPremium'), state.mapping.premium, '— geen premium-label —');
  fillSelect($('#mapLinkPremium'), state.mapping.linkPremium, '— niet bekend —');
  fillSelect($('#mapVideo'), state.mapping.video, '— geen video —');
  fillSelect($('#mapSocial'), state.mapping.social, '— geen social —');
  fillSelect($('#mapDataviz'), state.mapping.dataviz, '— geen datavisualisatie —');
  $('#fieldAutoNote').hidden = !(state.datasets || []).some(d => d.kind === 'liveblog');

  const notes = [];
  if (state.mapping.premium) {
    const activeRows = getActiveRows();
    const n = activeRows.filter(r => isPremium(r[state.mapping.premium])).length;
    notes.push(`${n} van ${activeRows.length} actieve rijen krijgen een Premium-label (ja, yes, true, 1, x).`);
  }
  if (state.mapping.image) {
    const n = getActiveRows().filter(r => isHttpUrl(r[state.mapping.image])).length;
    notes.push(`${n} rijen hebben een geldige afbeeldings-URL.`);
  }
  if (state.mapping.articleUrl) {
    const n = getActiveRows().filter(r => isHttpUrl(r[state.mapping.articleUrl])).length;
    notes.push(`${n} rijen hebben een klikbare artikel-URL.`);
  }
  if (state.mapping.articleType) {
    const n = getActiveRows().filter(r => isLiveType(r[state.mapping.articleType])).length;
    notes.push(`${n} rijen zijn als liveblog gemarkeerd via ARTICLE_TYPE.`);
  }
  const hint = $('#fieldHint');
  hint.hidden = !notes.length;
  hint.textContent = notes.join(' ');
}

function renderMetrics() {
  const host = $('#metricList');
  host.innerHTML = '';
  if (!state.metrics.length) {
    host.innerHTML = '<p class="hint">Nog geen cijfers toegevoegd.</p>';
    return;
  }
  state.metrics.forEach((m, idx) => {
    const card = document.createElement('div');
    card.className = 'metric-card';
    card.innerHTML = `
      <div class="metric-top">
        <div class="preview-icon"><i data-lucide="${m.icon}"></i></div>
        <div class="field"><label>Kolom</label>
          <select data-k="column">
            <option value="">— kies kolom —</option>
            ${state.headers.map(h => `<option value="${escAttr(h)}" ${h === m.column ? 'selected' : ''}>${esc(h)}</option>`).join('')}
          </select>
        </div>
        <button class="icon-btn" data-act="up" title="Omhoog" ${idx === 0 ? 'disabled' : ''}><span class="ms">arrow_upward</span></button>
        <button class="icon-btn" data-act="del" title="Verwijderen"><span class="ms">delete</span></button>
      </div>
      <div class="metric-grid">
        <div class="field"><label>Tekst op de tegel</label><input type="text" data-k="label" value="${escAttr(m.label)}" placeholder="${escAttr(m.column || 'bijv. Opens')}"></div>
        <div class="field"><label>Icoon</label>
          <select data-k="icon">${ICON_OPTIONS.map(([v, t]) => `<option value="${v}" ${v === m.icon ? 'selected' : ''}>${t}</option>`).join('')}</select>
        </div>
        <div class="field" style="grid-column:1/-1"><label>Weergave</label>
          <select data-k="format">${FORMATS.map(([v, t]) => `<option value="${v}" ${v === m.format ? 'selected' : ''}>${t}</option>`).join('')}</select>
        </div>
      </div>`;

    $$('[data-k]', card).forEach(input => {
      if (input.dataset.k === 'label') {
        // tekst live bijwerken zonder de hele zijbalk opnieuw op te bouwen
        input.addEventListener('input', () => { m.label = input.value; scheduleTimeline(); });
        return;
      }
      input.addEventListener('change', () => {
        const k = input.dataset.k;
        if (k === 'column') {
          m.column = input.value || null;
          if (m.column) {
            const guess = newMetric(m.column);
            m.label = m.column;
            m.icon = guess.icon; m.format = guess.format;
          }
        } else m[k] = input.value;
        renderAll();
      });
    });
    $('[data-act=del]', card).addEventListener('click', () => { state.metrics.splice(idx, 1); renderAll(); });
    $('[data-act=up]', card).addEventListener('click', () => {
      [state.metrics[idx - 1], state.metrics[idx]] = [state.metrics[idx], state.metrics[idx - 1]];
      renderAll();
    });
    host.appendChild(card);
  });
}

function renderBrands() {
  const activeBrandNames = new Set(getActiveRows().map(r => r[state.mapping.brand]).filter(Boolean));
  const names = Object.keys(state.brands).filter(n => activeBrandNames.has(n));
  const host = $('#brandList');
  host.innerHTML = '';
  if (!names.length) {
    host.innerHTML = '<p class="hint">Nog geen titels. Kies bij Velden een kolom voor het merk.</p>';
    return;
  }

  const col = state.mapping.brand;

  names.forEach(name => {
    const b = state.brands[name];
    const count = getActiveRows().filter(r => r[col] === name).length;
    const current = String(b.color).toLowerCase();
    const open = openBrands.has(name);
    const row = document.createElement('div');
    row.className = 'brand-row' + (open ? ' open' : '');
    row.innerHTML = `
      <div class="brand-top">
        ${titleIconHtml(name, 'brand-icon')}
        <div class="brand-name" title="${escAttr(name)}">${esc(name)} <span class="brand-count">\u00b7 ${count}\u00d7</span></div>
        <button type="button" class="brand-color" style="background:${escAttr(b.color)}" title="Kleur kiezen" aria-expanded="${open}"></button>
      </div>
      ${open ? `<div class="swatches">
        ${PALETTE.map(c => `<button type="button" class="swatch ${c.toLowerCase() === current ? 'on' : ''}" style="background:${c}" data-color="${c}" title="${c}"></button>`).join('')}
      </div>` : ''}`;

    $('.brand-color', row).addEventListener('click', () => {
      const wasOpen = openBrands.has(name);
      openBrands.clear();
      if (!wasOpen) openBrands.add(name);
      renderBrands();
    });
    $$('.swatch', row).forEach(sw => sw.addEventListener('click', () => {
      b.color = sw.dataset.color;
      openBrands.clear();
      renderAll();
    }));
    host.appendChild(row);
  });
}

/* ============================================================
   De slide
   ============================================================ */
function visibleItems() {
  const m = state.mapping;
  if (!m.time) return [];
  const removed = new Set(state.removed);
  const hidden = new Set(state.hiddenTitles);
  return getActiveRows()
    .filter(r => !removed.has(r.__id))
    .filter(r => !(m.brand && hidden.has(r[m.brand])))
    .map(r => ({ row: r, minutes: parseTime(r[m.time]) }))
    .filter(it => it.minutes !== null)
    .sort((a, b) => a.minutes - b.minutes);
}

function computeStatusCounts(start, end) {
  const m = state.mapping;
  const removed = new Set(state.removed);
  const hidden = new Set(state.hiddenTitles);
  const activeRows = getActiveRows();
  const out = {
    total: activeRows.length,
    inWindow: 0,
    outsideWindow: 0,
    removed: 0,
    hidden: 0,
    invalidTime: 0
  };

  if (!m.time) return out;

  activeRows.forEach(r => {
    if (removed.has(r.__id)) { out.removed++; return; }
    if (m.brand && hidden.has(r[m.brand])) { out.hidden++; return; }
    const t = parseTime(r[m.time]);
    if (t === null) { out.invalidTime++; return; }
    if (t < start || t > end) out.outsideWindow++;
    else out.inWindow++;
  });
  return out;
}

function updateStatusStrip(counts, notExact) {
  $('#statTotal').textContent = `Totaal: ${counts.total}`;
  $('#statInWindow').textContent = `In venster: ${counts.inWindow}`;
  $('#statOutside').textContent = `Buiten venster: ${counts.outsideWindow}`;
  $('#statRemoved').textContent = `Verwijderd: ${counts.removed}`;
  $('#statHidden').textContent = `Merk verborgen: ${counts.hidden}`;
  $('#statUnplaced').textContent = `Niet exact: ${notExact}`;
}

/** Titels (merken) in volgorde van hun eerste artikel. */
function titlesOf(items) {
  const col = state.mapping.brand;
  if (!col) return [];
  const order = [];
  items.forEach(it => { const v = it.row[col] || '—'; if (!order.includes(v)) order.push(v); });
  return order;
}

/** Raster van minimaal GRID_COLS kolommen; elke titel krijgt een eigen, links uitgelijnd blok van `caps` kolommen. */
function geometry(items, caps = null) {
  const brandCol = state.mapping.brand;
  const named = titlesOf(items);
  const titles = named.length ? named : ['—'];
  const used = titles.reduce((n, t) => n + Math.max(1, caps?.get(t) || 1), 0);
  const cols = Math.max(GRID_COLS, used);
  const colW = (LAYER_W - COL_GAP * (cols - 1)) / cols;
  const scale = Math.max(.8, Math.min(1.6, colW / 320));

  const titleCaps = new Map();
  const titleOffsets = new Map();
  let cursor = 0;
  titles.forEach(t => {
    const cap = Math.max(1, caps?.get(t) || 1);
    titleCaps.set(t, cap);
    titleOffsets.set(t, cursor);
    cursor += cap;
  });

  const keyOf = (it) => (named.length ? (it.row[brandCol] || '—') : '—');
  const candidates = items.map(it => {
    const t = keyOf(it);
    const offset = titleOffsets.get(t) ?? 0;
    const cap = titleCaps.get(t) ?? 1;
    return [...Array(cap).keys()].map(k => offset + k);
  });

  return { titles, multi: titles.length > 1, cols, colW, cardW: colW, scale, candidates, brandCol, titleCaps, titleOffsets, keyOf };
}

/** Items die vlak na elkaar vallen (binnen CLUSTER_MINUTES van het eerste item in de groep)
 *  krijgen dezelfde ideale tijd, zodat ze straks op precies dezelfde hoogte komen te staan. */
function clusterIdealMinutes(items) {
  const out = items.map(it => it.minutes);
  let anchor = 0;
  for (let i = 1; i < items.length; i++) {
    if (items[i].minutes - items[anchor].minutes <= CLUSTER_MINUTES) {
      out[i] = out[anchor];
    } else {
      anchor = i;
    }
  }
  return out;
}

/** Plaatst tegels in de kolommen. Elke tegel start altijd exact op zijn echte tijdstip —
 *  nooit verschoven. Bij drukte wordt eerst een vrije kolom binnen de titel gezocht;
 *  is die er niet, dan mag de tegel een stuk overlappen met de vorige in die kolom. */
function pack(items, heights, pxPerMin, start, geo) {
  const bottom = new Array(geo.cols).fill(-Infinity);
  const out = [];
  let hasOverlap = false;
  const clusteredMinutes = clusterIdealMinutes(items);

  for (let i = 0; i < items.length; i++) {
    const top = (clusteredMinutes[i] - start) * pxPerMin;
    const cand = geo.candidates[i];
    // altijd de meest linkse vrije kolom van de titel
    let chosen = cand.find(c => bottom[c] + ROW_GAP <= top);
    if (chosen === undefined) {
      // geen kolom zonder overlap beschikbaar: kies de kolom met de minste overlap
      hasOverlap = true;
      chosen = cand.reduce((a, b) => (bottom[a] <= bottom[b] ? a : b));
    }

    bottom[chosen] = Math.max(bottom[chosen], top + heights[i]);
    out.push({ col: chosen, top });
  }
  return { placed: out, hasOverlap };
}

/** Laat zien welke venster-modus actief is en welk tijdvak er getoond wordt. */
function updateRangeControls() {
  const s = state.settings;
  const mode = s.autoFit ? 'compact' : (periodBounds() ? 'days' : 'compact');
  $('#btnAutoRange').classList.toggle('on', mode === 'compact');
  $('#btnWholeDays').classList.toggle('on', mode === 'days');
  const { start, end } = rangeMinutes();
  const fmt = (t, withDay) => {
    if (!isAbsoluteMinutes(t)) return timeLabel(t);
    try {
      const opts = withDay
        ? { timeZone: NEWS_TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
        : { timeZone: NEWS_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
      return new Intl.DateTimeFormat('nl-NL', opts).format(new Date(t * 60000));
    } catch {
      return timeInputLabel(t);
    }
  };
  const sameDay = isAbsoluteMinutes(start) && localDateOf(start) === localDateOf(end - 1);
  const label = mode === 'compact' ? 'Compact' : 'Hele dag(en)';
  $('#rangeSummary').textContent = `${label}: ${fmt(start, true)} – ${fmt(end, !sameDay)}`;
}

function renderTimeline() {
  try {
    if (state.settings.autoFit) autoRange();
    updateRangeControls();
    const live = state.settings.view === 'live';
    $('#stage').classList.toggle('is-live', live);
    if (!live && document.body.classList.contains('wall')) toggleWall(false);
    if (live) renderLiveBoard();
    else if (state.settings.view === 'chart') renderChart();
    else if (['table', 'compare', 'scatter'].includes(state.settings.view)) renderTable();
    else renderTimelineInner();
    syncSelection();
  } catch (err) {
    console.error('renderTimeline crashed:', err);
    const track = $('#timelineTrack');
    const layer = $('#cardLayer');
    if (track) track.innerHTML = '';
    if (layer) layer.innerHTML = '';
    const emptyState = $('#emptyState');
    const emptyText = $('#emptyText');
    if (emptyState) emptyState.hidden = false;
    if (emptyText) emptyText.textContent = `Er ging iets mis bij het tekenen: ${err?.message || err}`;
    const previewInfo = $('#previewInfo');
    if (previewInfo) previewInfo.textContent = '0 tegels · fout bij tekenen';
    toast(`Tekenfout: ${err?.message || err}`);
  }
}

function renderTimelineInner() {
  const s = state.settings;
  $('#slideBody').hidden = false;
  $('#chartView').hidden = true;
  $('#tableView').hidden = true;
  const allItems = visibleItems();
  const { start, end, span: minutes } = rangeMinutes();
  const statusCounts = computeStatusCounts(start, end);
  const items = allItems.filter(it => it.minutes >= start && it.minutes <= end);
  const base = items.length ? items[0].minutes : start;
  const largePeriod = minutes >= 1440;
  updateStatusStrip(statusCounts, 0);

  const titleEl = $('#slideTitleEl'), metaEl = $('#slideMeta');
  // zelfde kop als bij grafieken en tabel: eigen titel klein erboven, beschrijvende kop, daaronder periode en aantallen
  $('#slideKicker').textContent = s.slideTitle || '';
  $('#slideKicker').hidden = !s.slideTitle;
  titleEl.textContent = `${itemNoun(allItems)} op de tijdlijn`;
  titleEl.hidden = false;

  const parts = [];
  let dl = '';
  if (s.showDate) {
    if (largePeriod) {
      const years = [...new Set(items.map(it => parseDate(it.row[state.mapping.time])).filter(Boolean).map(d => d.getFullYear()))].sort((a, b) => a - b);
      if (years.length === 1) dl = String(years[0]);
      else if (years.length > 1) dl = `${years[0]}-${years[years.length - 1]}`;
    } else {
      dl = dateLabel(items);
    }
  }
  if (dl) parts.push(esc(dl));
  if (items.length) {
    const nTitles = new Set(items.map(it => state.mapping.brand ? it.row[state.mapping.brand] : '')).size;
    parts.push(`${nTitles} titel${nTitles === 1 ? '' : 's'}`, `${items.length} posts`);
  }
  if (s.relative && items.length) parts.push(`Eerste bericht om ${timeLabel(base)}`);
  if (state.mapping.premium && items.length) {
    const n = items.filter(it => isPremium(it.row[state.mapping.premium])).length;
    if (n) parts.push(`<span class="legend"><span class="legend-swatch"></span>${n} van ${items.length} premium</span>`);
  }
  metaEl.innerHTML = parts.map(p => `<span>${p}</span>`).join('<span class="sep">·</span>');
  metaEl.hidden = !parts.length;
  $('#slideHead').hidden = false;

  const ready = !!(state.mapping.time && state.mapping.title && items.length);

  $('#emptyState').hidden = ready;
  $('#emptyText').textContent = !state.rows.length
    ? 'Voeg data toe in het Data-blok'
    : (!state.mapping.time || !state.mapping.title)
      ? 'Kies bij Velden een kolom voor tijdstip en titel'
      : (allItems.length && !items.length)
        ? 'Geen posts binnen de gekozen periode'
        : 'Geen geldige tijdstippen gevonden in de gekozen kolom';
  $('#previewInfo').textContent = `${items.length} ${items.length === 1 ? 'tegel' : 'tegels'}`
    + (allItems.length !== items.length ? ` · ${allItems.length - items.length} buiten bereik` : '')
    + (state.hiddenTitles.length ? ` · ${state.hiddenTitles.length} titel${state.hiddenTitles.length === 1 ? '' : 's'} verborgen` : '');
  $('#removedCount').textContent = state.removed.length;
  $('#btnRestore').hidden = !state.removed.length;

  const track = $('#timelineTrack');
  const layer = $('#cardLayer');
  track.innerHTML = '';
  layer.innerHTML = '';
  if (!ready) {
    const fixed = SLIDE_FORMATS[s.format]?.h || null;
    $('#slide').style.height = fixed ? fixed + 'px' : '';
    layer.style.height = fixed ? '' : '360px';
    track.style.height = '0';
    applyZoom();
    return;
  }

  let geo = geometry(items);
  const step = niceStep(minutes);
  const fixedH = SLIDE_FORMATS[s.format]?.h || null;

  // 1. tegels bouwen
  const maxByMetric = new Map();
  if (s.highlightMax) {
    state.metrics.filter(mt => mt.column).forEach(mt => {
      const vals = items.map(it => parseNumber(it.row[mt.column])).filter(v => v !== null);
      if (vals.length > 1) maxByMetric.set(mt.id, Math.max(...vals));
    });
  }
  // als alles liveblog-updates zijn, voegt een LIVE-label niets toe en kost het ruimte
  const onlyLiveblogs = items.every(it => isLiveblog(state.mapping.title ? it.row[state.mapping.title] : '', state.mapping.articleType ? it.row[state.mapping.articleType] : ''));
  const ctx = { base, maxByMetric, onlyLiveblogs };

  const cards = items.map(it => {
    const el = buildCard(it, geo, ctx);
    el.style.width = geo.cardW + 'px';
    el.style.left = '0px'; el.style.top = '0px'; el.style.visibility = 'hidden';
    layer.appendChild(el);
    return el;
  });
  if (window.lucide) lucide.createIcons();

  const minPx = Math.max(.2, 320 / minutes);
  let maxPx = Math.max(minPx + .1, 8000 / minutes);

  const measure = (f) => {
    cards.forEach(el => el.style.setProperty('--cs', (geo.scale * f).toFixed(3)));
    return cards.map(el => el.offsetHeight);
  };

  // Kolommen verdelen: elke titel begint met één kolom; de titel die de meeste hoogte vraagt krijgt er
  // een bij, zolang dat de benodigde hoogte duidelijk verlaagt en er nog kolommen vrij zijn.
  {
    const baseHeights = measure(1);
    const groups = new Map(geo.titles.map(t => [t, []]));
    items.forEach((it, i) => (groups.get(geo.keyOf(it)) || groups.get(geo.titles[0])).push(i));
    const reqPx = (t, cap) => {
      const idx = groups.get(t);
      if (!idx.length) return minPx;
      const sub = idx.map(i => items[i]);
      const h = idx.map(i => baseHeights[i]);
      const g = { cols: cap, candidates: sub.map(() => [...Array(cap).keys()]) };
      const fits = (px) => !pack(sub, h, px, start, g).hasOverlap;
      if (fits(minPx)) return minPx;
      // posts in dezelfde minuut(cluster) staan op dezelfde hoogte: met te weinig kolommen past het nooit
      if (!fits(maxPx * 1.6 ** 20)) return Infinity;
      let hi = maxPx, guard = 0;
      while (!fits(hi) && guard++ < 20) hi *= 1.6;
      let lo = minPx;
      for (let k = 0; k < 18; k++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
      return hi;
    };
    const caps = new Map(geo.titles.map(t => [t, 1]));
    const need = new Map(geo.titles.map(t => [t, reqPx(t, 1)]));
    let free = MAX_GRID_COLS - geo.titles.length;
    while (free > 0) {
      const t = [...need.entries()].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
      const next = reqPx(t, caps.get(t) + 1);
      if (Number.isFinite(need.get(t)) && next > need.get(t) * 0.85) break;
      caps.set(t, caps.get(t) + 1);
      need.set(t, next);
      free--;
    }
    geo = geometry(items, caps);
    // boven de 6 kolommen worden alle tegels smaller; breedte en schaal opnieuw zetten
    cards.forEach(el => { el.style.width = geo.cardW + 'px'; });
    const usedCols = geo.titles.reduce((n, t) => n + caps.get(t), 0);
    const split = geo.titles.length > 1 ? ` — ${geo.titles.map(t => `${t} ${caps.get(t)}`).join(' · ')}` : '';
    $('#layoutHint').textContent = geo.titles.length > MAX_GRID_COLS
      ? `${geo.titles.length} titels is meer dan ${MAX_GRID_COLS} goed leesbare kolommen; verberg een deel van de titels.`
      : `${usedCols} van ${geo.cols} kolommen in gebruik (minimaal ${GRID_COLS}, maximaal ${MAX_GRID_COLS})${split}`;
  }

  // Automatisch formaat: de pagina mag doorgroeien totdat alle tegels zonder overlap passen
  // (elke tegel blijft wel altijd exact op haar eigen tijdstip staan, nooit verschoven).
  if (!fixedH) {
    const probeHeights = measure(1);
    const fitsAt = (px) => !pack(items, probeHeights, px, start, geo).hasOverlap;
    // alleen oprekken als dat de overlap echt oplost; anders levert het alleen lege ruimte op
    if (fitsAt(maxPx * 1.6 ** 14)) {
      let guard = 0;
      while (!fitsAt(maxPx) && guard < 14) {
        maxPx *= 1.6;
        guard++;
      }
    }
  }

  // kleinste schaal waarbij elke tegel nog zonder overlap past; lukt dat zelfs bij maxPx niet
  // (alleen mogelijk bij een vast exportformaat met een harde pixelhoogte), dan accepteren we lichte overlap.
  const solve = (heights) => {
    let best = pack(items, heights, maxPx, start, geo);
    let px = maxPx;
    if (!best.hasOverlap) {
      let lo = minPx, hi = maxPx;
      for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        const r = pack(items, heights, mid, start, geo);
        if (!r.hasOverlap) { hi = mid; best = r; } else lo = mid;
      }
      px = hi;
    }
    return { placed: best.placed, px, exact: !best.hasOverlap, ...dims(heights, best.placed, px) };
  };

  function dims(heights, placed, px) {
    const offset = Math.max(0, -Math.min(...placed.map(p => p.top)));
    let maxBottom = 0;
    placed.forEach((p, i) => { maxBottom = Math.max(maxBottom, p.top + offset + heights[i]); });
    return { offset, contentH: Math.max(offset + minutes * px, maxBottom) };
  }

  // 2. passend maken binnen het gekozen formaat
  const headH = $('#slideHead').hidden ? 0 : $('#slideHead').offsetHeight;
  const avail = fixedH ? fixedH - PAD_TOP - PAD_BOTTOM - headH : null;
  let heights = measure(1), sol = solve(heights);

  if (avail) {
    if (sol.contentH > avail) {
      // tekst stapsgewijs kleiner tot de inhoud op de slide past
      let lo = .5, hi = 1, bestF = null;
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2;
        const s2 = solve(measure(mid));
        if (s2.contentH <= avail) { lo = mid; bestF = mid; } else hi = mid;
      }
      heights = measure(bestF ?? .5);
      sol = solve(heights);
    }
    // overgebleven ruimte benutten zodat de tijdlijn de slide vult
    if (sol.exact && sol.contentH < avail) {
      let lo = sol.px, hi = maxPx;
      for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        const r = pack(items, heights, mid, start, geo);
        const d = !r.hasOverlap ? dims(heights, r.placed, mid) : null;
        if (d && d.contentH <= avail) { lo = mid; sol = { placed: r.placed, px: mid, exact: true, ...d }; } else hi = mid;
      }
    }
  }
  if (!sol.exact) $('#previewInfo').textContent += ' · te veel artikelen tegelijk voor dit formaat: enkele tegels overlappen';

  // afgekapte titels krijgen een beletselteken; dit verandert de hoogte niet meer
  cards.forEach(el => {
    const t = $('.m3-title.clamp', el);
    if (!t || t.scrollHeight <= t.clientHeight + 1) return;
    const full = t.textContent;
    let lo = 0, hi = full.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      t.textContent = full.slice(0, mid).trimEnd() + '…';
      if (t.scrollHeight <= t.clientHeight + 1) lo = mid; else hi = mid - 1;
    }
    t.textContent = full.slice(0, lo).trimEnd() + '…';
  });

  // 3. plaatsen
  cards.forEach((el, i) => {
    el.style.left = (sol.placed[i].col * (geo.colW + COL_GAP)) + 'px';
    el.style.top = (sol.placed[i].top + sol.offset) + 'px';
    el.style.visibility = 'visible';
  });

  const notExactCount = items.reduce((n, it, i) => {
    const idealTop = (it.minutes - start) * sol.px + sol.offset;
    const actualTop = sol.placed[i].top + sol.offset;
    return n + (actualTop > idealTop + 1 ? 1 : 0);
  }, 0);
  updateStatusStrip(statusCounts, notExactCount);

  // 4. tijdas — de lijn loopt door tot onderaan de inhoud
  const bodyH = avail || sol.contentH;
  track.style.top = sol.offset + 'px';
  track.style.height = (bodyH - sol.offset) + 'px';
  const marks = [];
  const absoluteRange = isAbsoluteMinutes(start);
  const isLocalMidnight = (t) => {
    const localTotal = Math.round(t + tzOffsetMinutes(NEWS_TZ, t * 60000));
    return ((localTotal % 1440) + 1440) % 1440 === 0;
  };
  // vanaf 2 uur: elk heel (lokaal) uur een label, gelijk met de uurlijnen
  const axisStep = minutes >= 120 ? 60 : step;
  if (s.relative) {
    // nullpunt op het eerste bericht, zodat de as op 0 begint
    for (let t = base; t >= start - 0.001; t -= step) marks.unshift(t);
    for (let t = base + step; t <= start + minutes + 0.001; t += step) marks.push(t);
  } else {
    const off = absoluteRange ? tzOffsetMinutes(NEWS_TZ, start * 60000) : 0;
    const firstMark = Math.ceil((start + off - 0.001) / axisStep) * axisStep - off;
    for (let t = firstMark; t <= start + minutes + 0.001; t += axisStep) marks.push(t);
  }
  marks.forEach(t => {
    const el = document.createElement('div');
    el.className = 'time-marker';
    el.style.top = ((t - start) * sol.px) + 'px';
    let markerLabel;
    if (s.relative) markerLabel = relLabel(t - base);
    else markerLabel = absoluteRange && isLocalMidnight(t) ? monthDayLabel(t) : timeLabel(t);
    el.innerHTML = `<span class="time-label">${markerLabel}</span>`;
    track.appendChild(el);
  });

  // referentielijnen voor oriëntatie: stippellijn per uur, dichte lijn op een daggrens (alleen bij echte datums)
  const firstHour = Math.ceil(start / 60) * 60;
  for (let t = firstHour; t <= start + minutes + 0.001; t += 60) {
    const isDayBoundary = absoluteRange && (() => {
      const offsetMin = tzOffsetMinutes(NEWS_TZ, t * 60000);
      const localTotal = Math.round(t + offsetMin);
      return ((localTotal % 1440) + 1440) % 1440 === 0;
    })();
    const el = document.createElement('div');
    el.className = 'grid-line ' + (isDayBoundary ? 'grid-line-day' : 'grid-line-hour');
    el.style.top = ((t - start) * sol.px + sol.offset) + 'px';
    layer.appendChild(el);
  }

  layer.style.height = bodyH + 'px';
  $('#slide').style.height = fixedH ? fixedH + 'px' : '';
  applyZoom();
  $('#sizeHint').textContent = `Afbeelding wordt ${SLIDE_W} × ${Math.round($('#slide').offsetHeight)} px`;
}

/** Tweede weergave: gestapelde staafgrafiek met het aantal updates per (lokaal) uur. */
// grafiek, heatmap en tabel hebben een vaste maat voor onder een slidetitel (iets hoger dan 'under'); het formaat in de zijbalk geldt alleen voor de tijdlijn
const STAT_FORMAT_H = 920;

/** Periode voor onder een slidetitel: 'Woensdag 4 november 2026' of '2 – 4 november 2026', met tijden als het geen hele dagen zijn. */
function periodText(start, end) {
  if (!isAbsoluteMinutes(start)) return `${timeLabel(start)}\u2013${timeLabel(end)}`;
  const fmt = (t, o) => new Intl.DateTimeFormat('nl-NL', { timeZone: NEWS_TZ, ...o }).format(new Date(t * 60000));
  const midnight = (t) => ((Math.round(t + tzOffsetMinutes(NEWS_TZ, t * 60000)) % 1440) + 1440) % 1440 === 0;
  const last = midnight(end) ? end - 1 : end;
  const day = (t) => fmt(t, { day: 'numeric', month: 'long', year: 'numeric' });
  const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
  let txt = localDateOf(start) === localDateOf(last) ? cap(`${fmt(start, { weekday: 'long' })} ${day(start)}`) : `${day(start)} \u2013 ${day(last)}`;
  if (!midnight(start) || !midnight(end)) txt += `, ${timeLabel(start)}\u2013${timeLabel(end)}`;
  return txt;
}

/** Wat de items zijn (voor in de kop): door de gebruiker ingesteld, anders liveblogs als de data daar duidelijk op wijst. */
function itemNoun(items = visibleItems()) {
  const kind = String(state.settings.itemKind || '').trim();
  if (kind) return kind.charAt(0).toUpperCase() + kind.slice(1);
  const m = state.mapping;
  const active = (state.datasets || []).filter(d => d.active);
  const live = (active.length && active.every(d => d.kind === 'liveblog'))
    || state.headers.some(h => /liveblog|postnummer|update_nummer/i.test(h))
    || (items.length && items.every(it => isLiveblog(m.title ? it.row[m.title] : '', m.articleType ? it.row[m.articleType] : '')));
  return live ? 'Liveblogs' : 'Berichten';
}

/** Slidekop: eigen titel klein erboven, de kop zelf beschrijft wat je ziet, daaronder uitleg, periode en aantallen. */
function setSlideHead(title, parts) {
  $('#slideKicker').textContent = state.settings.slideTitle || '';
  $('#slideKicker').hidden = !state.settings.slideTitle;
  $('#slideTitleEl').textContent = title;
  $('#slideTitleEl').hidden = !title;
  const shown = parts.filter(Boolean);
  $('#slideMeta').innerHTML = shown.map(p => `<span>${esc(p)}</span>`).join('<span class="sep">\u00b7</span>');
  $('#slideMeta').hidden = !shown.length;
  $('#slideHead').hidden = !title && !shown.length && !state.settings.slideTitle;
}

// korte uitleg onder grafiek- en tabeltitels, zodat een slide zonder toelichting te lezen is
const MEDIA_EXPLAIN = 'Één rubriek per post: video, datavisualisatie, social, foto of geen media';
const EXPLAIN = {
  n: 'Aantal posts in de gekozen periode',
  perHour: 'Posts per actief uur; pauzes van meer dan 2 uur tellen niet mee',
  regularity: '100 = vast ritme, 50 = willekeurig, 0 = alles in uitbarstingen',
  maxGap: 'Langste tijd zonder post; pauzes van meer dan 2 uur tellen niet mee',
  medianWords: 'Mediaan aantal woorden per post, kop en tekst samen',
  noText: 'Aandeel posts zonder lopende tekst: alleen een kop, beeld of embed (bij sport vaak een wissel of doelpunt)',
  image: MEDIA_EXPLAIN, video: MEDIA_EXPLAIN, social: MEDIA_EXPLAIN, dataviz: MEDIA_EXPLAIN,
  media: 'Aandeel posts met foto, video, social embed of datavisualisatie',
  link: 'Aandeel posts met minstens één link naar een eigen artikel (gratis of premium)',
  premium: 'Aandeel posts met een link naar een eigen premium-artikel',
  external: 'Aandeel posts met minstens één link naar een andere site',
  firstShare: 'Aandeel van alle gedeelde nieuwsmomenten waarin deze titel als eerste post',
  coverShare: 'Aandeel van alle gedeelde nieuwsmomenten dat deze titel in het liveblog brengt',
  lag: 'Mediaan aantal minuten na de eerste post, over de gedeelde momenten die de titel bracht (de eerste telt als 0); niet brengen telt hier niet mee, dat staat bij Gedeeld nieuws gebracht',
  headQuote: 'Aandeel koppen met aanhalingstekens',
  statements: 'Aandeel zinnen met aanhalingstekens of een werkwoord als zegt, stelt of schrijft',
  sourced: 'Aandeel posts dat een persbureau noemt of een bron opvoert (volgens, meldt, laat weten); fotobijschriften en ondertekening tellen niet mee',
  urgency: 'Woorden als zojuist, spannend, cruciaal en op het spel, per 1.000 woorden; alledaagse woorden als nu en momenteel tellen niet mee',
  ownAngle: 'Nederland, Den Haag en Haagse voor Nederlandse titels; België, Belgische, Vlaanderen en Vlaamse voor Belgische titels, per 1.000 woorden',
  reachViews: 'Weergaven van de liveblog: opgeteld over de uren, of het totaal uit de totaalcijfers',
  reachUsers: 'Gebruikers: per uur opgeteld (geen unieke gebruikers), of het totaal uit de totaalcijfers',
  reachVpu: 'Weergaven gedeeld door gebruikers',
  viewsPerPost: 'Weergaven gedeeld door het aantal posts',
  'stack-links': 'Eigen premium-artikel, eigen gratis artikel of uitgaande link; per post de eerste die van toepassing is',
  'stack-media': MEDIA_EXPLAIN,
  'stack-length': 'Kort: minder dan 40 woorden · middel: 40–150 · lang: meer dan 150',
  __views: 'Weergaven van de liveblog per uur',
  __users: 'Gebruikers van de liveblog per uur',
  __vpu: 'Weergaven gedeeld door gebruikers',
  __vpp: 'Weergaven gedeeld door het aantal posts in dat uur',
  __words: 'Mediaan aantal woorden per post, kop en tekst samen',
  __regularity: '100 = vast ritme, 50 = willekeurig, 0 = alles in uitbarstingen; berekend over 3 uur rond het uur (een uur ervoor en erna), pas vanaf 8 tussentijden'
};
const explainOf = (key) => EXPLAIN[key]
  || (/_sum$/.test(key) ? 'Totaal van alle posts' : /_avg$/.test(key) ? 'Gemiddelde per post' : /_med$/.test(key) ? 'Mediaan per post' : '');

/** Heatmap: titels als rijen, uren als kolommen. mode: 'sum' (aantal of som), 'words' (mediane lengte) of 'regularity'. */
function renderHeatmap(view, { names, hours, items, bucketOf, brandCol, absolute, localOf, isLocalMidnight, fixedH, weight = () => 1, measureLabel = 'Posts', mode = 'sum', cell = null, icons = !!brandCol }) {
  const cellItems = names.map(() => hours.map(() => []));
  // tussentijd tot de vorige post van dezelfde titel, alleen binnen een sessie
  const prevGap = new Map();
  const lastByTitle = new Map();
  const gapsByRow = names.map(() => []);
  [...items].sort((a, b) => a.minutes - b.minutes).forEach(it => {
    const key = brandCol ? it.row[brandCol] : '';
    const prev = lastByTitle.get(key);
    if (prev !== undefined && it.minutes - prev <= PAUSE_MIN) {
      prevGap.set(it, it.minutes - prev);
      const ri = brandCol ? names.indexOf(key) : 0;
      if (ri >= 0) gapsByRow[ri].push({ t: it.minutes, g: it.minutes - prev });
    }
    lastByTitle.set(key, it.minutes);
  });
  items.forEach(it => {
    const r = brandCol ? names.indexOf(it.row[brandCol]) : 0;
    if (r >= 0) cellItems[r][bucketOf(it.minutes)].push(it);
  });
  const valueOf = (list) => {
    if (!list.length) return null;
    if (mode === 'words') return medianOf(list.map(it => postWords(it.row)));
    return list.reduce((a, it) => a + weight(it), 0);
  };
  // regelmaat over uurgrenzen heen: tussentijden van het uur zelf plus een uur ervoor en erna, terug toegekend aan dat uur
  const regularityAt = (r, c) => {
    if (!cellItems[r][c].length) return null;
    const lo = hours[c] - 60, hi = hours[c] + 120;
    return regularityScore(gapsByRow[r].filter(x => x.t >= lo && x.t < hi).map(x => x.g), 8);
  };
  const counts = cell ? names.map(n => hours.map((_, i) => cell(n, i)))
    : mode === 'regularity' ? cellItems.map((row, r) => row.map((_, c) => regularityAt(r, c)))
      : cellItems.map(row => row.map(valueOf));
  const short = (v) => v === null ? '' : sig3(v);
  const vals = counts.flat().filter(v => v !== null);
  const max = mode === 'regularity' ? 100 : Math.max(mode === 'ratio' ? 0 : 1, ...vals);
  // verhoudingen liggen dicht bij elkaar (1,1\u20131,6); kleur over het werkelijke bereik
  const lo = mode === 'ratio' && vals.length ? Math.min(...vals) : 0;
  // \u00e9\u00e9n kleurverloop voor alle titels, zodat intensiteit direct vergelijkbaar is
  const shade = (v) => {
    if (v === null || (mode === 'sum' && !v)) return { bg: '#F3EDF7', fg: 'transparent' };
    const f = mode === 'sum' ? Math.sqrt(v / max) : Math.max(0.05, (v - lo) / ((max - lo) || 1));
    return { bg: `hsl(262, ${Math.round(70 - 25 * f)}%, ${Math.round(91 - 66 * f)}%)`, fg: f > 0.5 ? '#fff' : '#21005D' };
  };
  const hourOfDay = (t) => Math.floor((((localOf(t) % 1440) + 1440) % 1440) / 60);
  // zelfde labelinterval als de staaf- en lijngrafiek (bij een hele dag: even uren)
  const every = [1, 2, 3, 4, 6, 12].find(k => hours.length / k <= 16) || 24;
  const showNumbers = hours.length <= 48;

  const headH = $('#slideHead').hidden ? 0 : $('#slideHead').offsetHeight;
  const H = Math.max(260, fixedH - PAD_TOP - PAD_BOTTOM - headH - 24);
  // legenda (~28px) + marge (16px) + ruimte tussen legenda en heatmap (24px)
  const legendH = 68, axisH = 56;
  const rowH = Math.max(18, Math.min(90, (H - legendH - axisH) / names.length));
  // naamkolom even breed als de titelkolom van de tabel (ca. 240px), langere namen krijgen meer ruimte
  const cols = `minmax(max-content, 240px) repeat(${hours.length}, minmax(0, 1fr))`;

  const rowsHtml = names.map((name, r) => {
    const cells = counts[r].map((v, i) => {
      const { bg, fg } = shade(v);
      return `<div class="hm-cell" style="background:${bg};color:${fg}" title="${escAttr(`${name} \u00b7 ${timeLabel(hours[i])}: ${short(v)}`)}">${showNumbers && v !== null && (mode !== 'sum' || v) ? short(v) : ''}</div>`;
    }).join('');
    return `<div class="hm-name">${icons ? titleIconHtml(name, 'hm-logo') : ''}<span>${esc(name)}</span></div>${cells}`;
  }).join('');

  const axis = hours.map((t) => {
    if (absolute && isLocalMidnight(t)) return `<div class="hm-tick day">${esc(monthDayLabel(t))}</div>`;
    return `<div class="hm-tick">${hourOfDay(t) % every === 0 ? esc(timeLabel(t)) : ''}</div>`;
  }).join('');

  const steps = [0, 0.25, 0.5, 0.75, 1].map(f => mode === 'ratio' ? lo + f * (max - lo) : Math.max(mode === 'sum' ? 1 : 0, Math.round(f * max)));
  view.innerHTML = `
    <div class="hm-legend">
      <span>${esc(measureLabel)} per uur</span>
      ${[...new Set(steps)].map(v => `<i style="background:${shade(v).bg}"></i><b>${short(v)}</b>`).join('')}
    </div>
    <div class="heatmap" style="grid-template-columns:${cols};grid-template-rows:repeat(${names.length}, ${rowH}px) ${axisH}px;font-size:${Math.min(1.15, rowH / 40)}rem">
      ${rowsHtml}
      <div class="hm-axis-spacer"></div>${axis}
    </div>`;

  $('#slide').style.height = fixedH + 'px';
  applyZoom();
  $('#sizeHint').textContent = `Afbeelding wordt ${SLIDE_W} \u00d7 ${Math.round($('#slide').offsetHeight)} px`;
}

function renderChart() {
  const s = state.settings, m = state.mapping;
  const { start, end } = rangeMinutes();
  const items = visibleItems().filter(it => it.minutes >= start && it.minutes <= end);
  const view = $('#chartView');
  $('#slideBody').hidden = true;
  $('#tableView').hidden = true;
  view.hidden = false;
  view.innerHTML = '';
  updateStatusStrip(computeStatusCounts(start, end), 0);
  $('#removedCount').textContent = state.removed.length;
  $('#btnRestore').hidden = !state.removed.length;

  // tellen: aantal artikelen, de som van een cijfer, bereik per titel, of (alleen heatmap) lengte en regelmaat per uur
  // staven alleen voor updates; bereik als lijn of heatmap
  const combo = s.chartType === 'combo';
  const reachKey = !reachRows().length ? null
    : combo ? (REACH_MEASURES[s.chartMeasure] ? s.chartMeasure : '__users')
      : REACH_MEASURES[s.chartMeasure] && s.chartType !== 'bars' ? s.chartMeasure : null;
  const reach = reachKey ? reachRows().filter(r => r.t >= start && r.t <= end) : [];
  // combinatie: alleen titels met zowel posts als bereikdata
  const comboTitles = combo && reachKey && m.brand
    ? titlesOf(items).filter(n => reach.some(r => r.title === n)) : null;
  const postsOf = (n) => items.filter(it => it.row[m.brand] === n).length;
  // gekozen titel, anders de titel met de meeste posts
  const comboTitle = !comboTitles?.length ? ''
    : comboTitles.includes(s.comboTitle) ? s.comboTitle : [...comboTitles].sort((a, b) => postsOf(b) - postsOf(a))[0];
  const comboPosts = comboTitle ? postsOf(comboTitle) : 0;
  const textTm = !combo && !reachKey && m.title && TEXT_MEASURES[s.chartMeasure]
    && !(s.chartType === 'bars' && TEXT_MEASURES[s.chartMeasure].bars === false)
    && !(TEXT_MEASURES[s.chartMeasure].moments && !m.brand) ? TEXT_MEASURES[s.chartMeasure] : null;
  if (textTm?.moments) {
    // zelfde titelsleutel als de tabel, zodat de berekening uit de cache komt
    const keyOf = (it) => it.row[m.brand] || '\u2014';
    const shared = sharedMoments(items, keyOf);
    chartRole = (it) => shared.roles.get(momentKey(it, keyOf)) || null;
    chartMoments = shared;
  }
  const heatMode = reachKey ? (reachKey === '__vpu' ? 'ratio' : 'sum')
    : textTm && s.chartType !== 'bars' ? 'level'
      : s.chartType === 'heatmap' && s.chartMeasure === '__words' ? 'words'
        : s.chartType === 'heatmap' && s.chartMeasure === '__regularity' ? 'regularity' : 'sum';
  const measure = heatMode === 'sum' && !reachKey ? state.metrics.find(mt => mt.id === s.chartMeasure && mt.column && mt.format !== 'percent') : null;
  const weight = (it) => textTm ? (textTm.test(it) ? 1 : 0) : measure ? (parseNumber(it.row[measure.column]) || 0) : 1;
  const measureLabel = reachKey ? REACH_MEASURES[reachKey]
    : textTm ? (heatMode === 'level' ? textTm.rate : `Posts ${textTm.post.startsWith('als ') ? '' : 'met '}${textTm.post}`)
      : heatMode === 'words' ? 'Woorden per post (mediaan)'
        : heatMode === 'regularity' ? 'Regelmaat (0\u2013100)'
          : measure ? (measure.label || measure.column) : 'Posts';
  const titleCount = new Set(reachKey ? reach.map(r => r.title) : items.map(it => m.brand ? it.row[m.brand] : '')).size;
  setSlideHead(comboTitles ? `Posts en ${measureLabel.toLowerCase()} per uur`
    : s.chartType === 'heatmap' ? `${measureLabel} per uur en titel` : `${measureLabel} per uur`, [
    periodText(start, end),
    comboTitles ? comboTitle : `${titleCount} titel${titleCount === 1 ? '' : 's'}`,
    comboTitles ? `${comboPosts} posts` : reachKey ? '' : `${items.length} posts`
  ]);

  const fixedH = STAT_FORMAT_H;
  const ready = comboTitles ? comboTitles.length > 0 : reachKey ? reach.length > 0 : !!(m.time && items.length);
  $('#emptyState').hidden = ready;
  $('#previewInfo').textContent = reachKey ? `${reach.length} uren bereikdata in grafiek` : `${items.length} updates in grafiek`;
  if (!ready) {
    $('#emptyText').textContent = combo && !reachKey ? 'Voeg bereikdata toe in het Data-blok'
      : comboTitles ? 'Geen titels met zowel posts als bereikdata binnen de gekozen periode'
        : !state.rows.length && !reachKey ? 'Voeg data toe in het Data-blok'
          : reachKey ? 'Geen bereikdata binnen de gekozen periode' : 'Geen posts binnen de gekozen periode';
    $('#slide').style.height = fixedH ? fixedH + 'px' : '';
    applyZoom();
    return;
  }

  // uurbakjes op lokale hele uren
  const absolute = isAbsoluteMinutes(start);
  const localOf = (t) => Math.round(t + (absolute ? tzOffsetMinutes(NEWS_TZ, t * 60000) : 0));
  const isLocalMidnight = (t) => ((localOf(t) % 1440) + 1440) % 1440 === 0;
  const off = absolute ? tzOffsetMinutes(NEWS_TZ, start * 60000) : 0;
  const hours = [];
  for (let t = Math.floor((start + off) / 60) * 60 - off; t < end || !hours.length; t += 60) hours.push(t);
  const bucketOf = (min) => Math.max(0, Math.min(hours.length - 1, Math.floor((min - hours[0]) / 60)));

  // segmenten per staaf: per titel, of naar link/premium, of naar mediatype
  const brandCol = m.brand;
  const titleTotals = new Map();
  if (brandCol) items.forEach(it => titleTotals.set(it.row[brandCol], (titleTotals.get(it.row[brandCol]) || 0) + 1));
  // meeste updates eerst, in heatmap, legenda en stapelvolgorde
  const names = brandCol ? titlesOf(items).sort((a, b) => (titleTotals.get(b) || 0) - (titleTotals.get(a) || 0)) : ['Updates'];
  // bereik: titels met bereikdata, in dezelfde volgorde; titels zonder posts achteraan
  const reachCells = new Map();
  if (reachKey) {
    const reachNames = [...new Set(reach.map(r => r.title))];
    names.splice(0, names.length, ...names.filter(n => reachNames.includes(n)), ...reachNames.filter(n => !names.includes(n)));
    reach.forEach(r => {
      const k = `${r.title}|${bucketOf(r.t)}`;
      const c = reachCells.get(k) || { views: 0, users: 0, posts: 0 };
      c.views += r.views || 0;
      c.users += r.users || 0;
      reachCells.set(k, c);
    });
    if (brandCol) items.forEach(it => {
      const c = reachCells.get(`${it.row[brandCol]}|${bucketOf(it.minutes)}`);
      if (c) c.posts++;
    });
  }
  // verhoudingen altijd opnieuw uit de sommen, nooit opgeteld of gemiddeld
  const reachValue = (c) => !c ? null : reachKey === '__views' ? c.views : reachKey === '__users' ? c.users
    : reachKey === '__vpp' ? (c.posts ? c.views / c.posts : null) : (c.users ? c.views / c.users : null);
  const reachAt = (name, i) => reachValue(reachCells.get(`${name}|${i}`));
  // tekst per uur: aandeel of dichtheid uit de posts van die titel in dat uur
  const textRows = new Map();
  if (heatMode === 'level') items.forEach(it => {
    const k = `${brandCol ? it.row[brandCol] : 'Updates'}|${bucketOf(it.minutes)}`;
    textRows.set(k, [...(textRows.get(k) || []), it]);
  });
  const textAt = (name, i) => textTm.cell ? textTm.cell(name, hours[i], hours[i] + 60) : textValue(textTm, textRows.get(`${name}|${i}`) || []);
  if (s.chartType === 'heatmap') {
    renderHeatmap(view, { names, hours, items, bucketOf, brandCol, absolute, localOf, isLocalMidnight, fixedH, weight, measureLabel, mode: heatMode, cell: reachKey ? reachAt : heatMode === 'level' ? textAt : null, icons: !!(brandCol || reachKey) });
    return;
  }
  const brandColor = (name, i) => state.brands[name]?.color || PALETTE[i % PALETTE.length];
  const mkSeries = (name, color, extra = {}) => ({ name, color, counts: new Array(hours.length).fill(0), total: 0, ...extra });
  // vaste, goed onderscheidbare kleuren; 'zonder' is altijd neutraal grijs
  const SPLITS = {
    links: [
      mkSeries('Eigen premium-artikel', CAT.premium, { test: it => linkInfo(it.row).cls === 'premium' }),
      mkSeries('Eigen artikel', CAT.link, { test: it => linkInfo(it.row).cls === 'own' }),
      mkSeries('Uitgaande link', CAT.external, { test: it => linkInfo(it.row).cls === 'external' }),
      mkSeries('Zonder link', CAT.none, { test: () => true })
    ],
    // \u00e9\u00e9n categorie per update, in deze volgorde: video gaat voor social, social voor foto
    media: [
      mkSeries('Video', CAT.video, { test: it => mediaCategory(it.row, m.image) === 'video' }),
      mkSeries('Datavisualisatie', CAT.dataviz, { test: it => mediaCategory(it.row, m.image) === 'dataviz' }),
      mkSeries('Social embed', CAT.social, { test: it => mediaCategory(it.row, m.image) === 'social' }),
      mkSeries('Foto', CAT.photo, { test: it => !!m.image && isHttpUrl(it.row[m.image]) }),
      mkSeries('Geen media', CAT.none, { test: () => true })
    ]
  };
  // per titel kleuren heeft bij \u00e9\u00e9n titel geen zin; dan standaard naar link/premium
  const lineMode = s.chartType === 'line';
  const highlight = lineMode && names.includes(s.chartHighlight) ? s.chartHighlight : '';
  const colorBy = reachKey || lineMode || s.chartColorBy === 'title' ? 'title'
    : SPLITS[s.chartColorBy] ? s.chartColorBy
      : (names.length === 1 && m.link ? 'links' : 'title');
  // titelkleur als heldere tint (geen pastel), zodat staven goed te onderscheiden zijn
  const vivid = (hex) => toneFromHex(hex, { sMul: 2, sMin: 60, sMax: 90, l: 48 });
  const series = colorBy === 'title'
    ? names.map((name, i) => mkSeries(name, vivid(brandColor(name, i)), {
      brand: state.brands[name] || null,
      test: it => !brandCol || it.row[brandCol] === name
    }))
    : SPLITS[colorBy];
  if (reachKey) {
    series.forEach(se => {
      se.points = hours.map((_, i) => reachAt(se.name, i));
      se.counts = se.points.map(v => v || 0);
      const cells = hours.map((_, i) => reachCells.get(`${se.name}|${i}`)).filter(Boolean);
      const sum = (k) => cells.reduce((a, c) => a + c[k], 0);
      se.total = reachValue({ views: sum('views'), users: sum('users'), posts: sum('posts') }) || 0;
    });
  } else if (heatMode === 'level') {
    series.forEach(se => {
      se.points = hours.map((_, i) => textAt(se.name, i));
      se.counts = se.points.map(v => v || 0);
      se.total = (textTm.cell ? textTm.cell(se.name, -Infinity, Infinity) : textValue(textTm, items.filter(it => se.test(it)))) || 0;
    });
  } else {
    items.forEach(it => {
      const se = series.find(x => x.test(it));
      if (!se) return;
      const w = weight(it);
      se.counts[bucketOf(it.minutes)] += w;
      se.total += w;
    });
    series.forEach(se => { se.points = [...se.counts]; });
    // indeling volgt de vaste testvolgorde; tonen op grootte, 'zonder'/'geen' als laatste
    if (colorBy !== 'title') {
      const last = series[series.length - 1];
      series.sort((a, b) => (a === last) - (b === last) || b.total - a.total);
    }
  }
  const fmtTotal = sig3;

  const iconFor = (brand, name) => {
    const src = brand ? brandLogo(brand, name) : null;
    if (!src) return reachKey ? titleIconHtml(name, '') : '';
    const host = brand?.logoHost || inferHostFromLogoValue(brand?.logo) || inferHostFromLogoValue(name);
    return `<img src="${src}" data-fallbacks="${escAttr(faviconFallbackList(host).join('|'))}" data-brand-text="" onerror="onBrandLogoError(this)" alt="">`;
  };
  if (comboTitles) {
    const i = names.indexOf(comboTitle);
    const se = series.find(x => x.name === comboTitle);
    const posts = new Array(hours.length).fill(0);
    items.forEach(it => { if (it.row[brandCol] === comboTitle) posts[bucketOf(it.minutes)]++; });
    if ($('#comboTitle option[value="' + CSS.escape(comboTitle) + '"]')) $('#comboTitle').value = comboTitle;
    renderCombo(view, {
      name: comboTitle, posts, reach: se.points, reachTotal: se.total, icon: iconFor(se.brand, comboTitle),
      line: toneFromHex(brandColor(comboTitle, i), { sMul: 2, sMin: 60, sMax: 90, l: 38 }),
      bar: toneFromHex(brandColor(comboTitle, i), { sMul: 1.5, sMin: 40, sMax: 80, l: 80 }),
      hours, absolute, localOf, isLocalMidnight, fixedH, measureLabel, ratio: reachKey === '__vpu'
    });
    $('#slide').style.height = fixedH ? fixedH + 'px' : '';
    applyZoom();
    $('#sizeHint').textContent = `Afbeelding wordt ${SLIDE_W} × ${Math.round($('#slide').offsetHeight)} px`;
    return;
  }
  let legend;
  if (colorBy !== 'title') {
    const titleItems = names.length === 1 && brandCol
      ? `<span class="chart-legend-item">${iconFor(state.brands[names[0]], names[0])}${esc(names[0])} <b>${fmtTotal(series.reduce((a, se) => a + se.total, 0))}</b></span>`
      : '';
    legend = titleItems + series.map(se => `<span class="chart-legend-item"><i style="background:${se.color}"></i>${esc(se.name)} <b>${fmtTotal(se.total)}</b></span>`).join('');
  } else {
    legend = series.map(se => {
      const cls = !lineMode ? '' : ` pickable${highlight && se.name !== highlight ? ' dim' : ''}${se.name === highlight ? ' on' : ''}`;
      return `<span class="chart-legend-item${cls}" data-title="${escAttr(se.name)}"${lineMode ? ' title="Klik om deze lijn uit te lichten"' : ''}><i style="background:${se.color}"></i>${iconFor(se.brand, se.name)}${esc(se.name)} <b>${fmtTotal(se.total)}</b></span>`;
    }).join('');
  }
  view.insertAdjacentHTML('beforeend', `<div class="chart-legend">${legend}</div>`);
  if (lineMode) $$('.chart-legend-item.pickable', view).forEach(el => el.addEventListener('click', () => {
    s.chartHighlight = s.chartHighlight === el.dataset.title ? '' : el.dataset.title;
    renderTimeline();
    save();
  }));

  const headH = $('#slideHead').offsetHeight + (view.firstElementChild?.offsetHeight || 0) + 24;
  const W = SLIDE_W - 2 * PAD_X;
  const H = fixedH ? Math.max(260, fixedH - PAD_TOP - PAD_BOTTOM - headH) : 680;
  const canvas = document.createElement('canvas');
  const dpr = 2;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  canvas.className = 'chart-canvas';
  view.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const pad = { l: 70, r: 30, t: 30, b: 80 };
  const plotW = W - pad.l - pad.r, plotH = H - pad.t - pad.b;
  const totals = hours.map((_, i) => series.reduce((sum, se) => sum + se.counts[i], 0));
  // lijnen (weergaven per gebruiker) op een as rond het werkelijke bereik; staven altijd vanaf 0
  const lineVals = lineMode ? series.flatMap(se => se.points.filter(v => v !== null)) : [];
  const maxCount = lineMode ? Math.max(reachKey ? 0 : 1, ...lineVals) : Math.max(1, ...totals);
  const yMin = reachKey === '__vpu' && lineVals.length ? Math.floor(Math.min(...lineVals) * 10) / 10 : 0;
  const rawStep = (maxCount - yMin) / 5 || 0.1;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const yStep = Math.max(lineMode ? 0 : 1, [1, 2, 5, 10].map(f => f * mag).find(v => rawStep <= v) || 10 * mag);
  const yMax = yMin + Math.max(1, Math.ceil((maxCount - yMin) / yStep - 1e-9)) * yStep;
  const slot = plotW / hours.length;
  const barW = Math.max(2, Math.min(40, slot * 0.6));
  const x = (i) => pad.l + (i + 0.5) * slot;
  const y = (v) => pad.t + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  const font = (size, weight = 500) => `${weight} ${size}px Roboto, system-ui, sans-serif`;

  // waarden langs de y-as en rasterlijnen achter de staven
  ctx.font = font(17);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let k = 0; yMin + k * yStep <= yMax + yStep / 1000; k++) {
    const v = yMin + k * yStep;
    ctx.fillStyle = '#49454F';
    ctx.fillText(sig3(Math.round(v * 1e6) / 1e6), pad.l - 14, y(v));
    if (k === 0) continue;
    ctx.strokeStyle = '#CAC4D0';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, Math.round(y(v)) + .5); ctx.lineTo(pad.l + plotW, Math.round(y(v)) + .5); ctx.stroke();
  }

  if (lineMode) {
    ctx.lineJoin = 'round';
    // uitgelichte lijn als laatste, zodat hij bovenop ligt
    [...series].sort((a, b) => (a.name === highlight) - (b.name === highlight)).forEach(se => {
      const on = !highlight || se.name === highlight;
      ctx.globalAlpha = on ? 1 : 0.25;
      ctx.lineWidth = highlight ? (on ? 7 : 2) : 3;
      ctx.strokeStyle = se.color;
      ctx.beginPath();
      let pen = false;
      se.points.forEach((v, i) => {
        if (v === null) { pen = false; return; }
        if (pen) ctx.lineTo(x(i), y(v)); else ctx.moveTo(x(i), y(v));
        pen = true;
      });
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  // gestapelde staven per uur met licht afgeronde bovenkant; segmenten met een smalle naad
  const seam = 1.5;
  hours.forEach((_, i) => {
    const total = series.reduce((sum, se) => sum + se.counts[i], 0);
    if (!total || lineMode) return;
    const x0 = x(i) - barW / 2;
    const stackTop = y(total), stackH = Math.max(1, y(0) - stackTop);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x0, stackTop, barW, stackH, [Math.min(6, barW / 3, stackH), Math.min(6, barW / 3, stackH), 0, 0]);
    ctx.clip();
    let acc = 0;
    series.forEach(se => {
      const c = se.counts[i];
      if (!c) return;
      const top = y(acc + c), bottom = y(acc);
      ctx.fillStyle = se.color;
      ctx.fillRect(x0, top, barW, Math.max(1, bottom - top - (acc ? seam : 0)));
      acc += c;
    });
    ctx.restore();
  });

  // alleen de horizontale aslijn over de staven heen, zodat die ononderbroken doorloopt
  ctx.strokeStyle = '#79747E';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(pad.l, y(yMin)); ctx.lineTo(pad.l + plotW, y(yMin)); ctx.stroke();

  // x-as: labels op een vaste uurinterval, op de daggrens alleen de datum (vet); geen verticale rasterlijnen
  const every = [1, 2, 3, 4, 6, 12].find(k => hours.length / k <= 16) || 24;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  hours.forEach((t, i) => {
    const midnight = absolute && isLocalMidnight(t);
    const hourOfDay = Math.floor((((localOf(t) % 1440) + 1440) % 1440) / 60);
    if (midnight) {
      ctx.fillStyle = '#1D1B20';
      ctx.font = font(17, 700);
      ctx.fillText(monthDayLabel(t), x(i), pad.t + plotH + 14);
    } else if (hourOfDay % every === 0) {
      ctx.fillStyle = '#49454F';
      ctx.font = font(17);
      ctx.fillText(timeLabel(t), x(i), pad.t + plotH + 14);
    }
  });

  $('#slide').style.height = fixedH ? fixedH + 'px' : '';
  applyZoom();
  $('#sizeHint').textContent = `Afbeelding wordt ${SLIDE_W} × ${Math.round($('#slide').offsetHeight)} px`;
}

/** Posts als staven (linkeras) en bereik als lijn (rechteras) voor één titel. */
function renderCombo(view, { hours, absolute, localOf, isLocalMidnight, fixedH, measureLabel, ratio, ...p }) {
  const postTotal = p.posts.reduce((a, b) => a + b, 0);
  view.insertAdjacentHTML('beforeend', `<div class="chart-legend">
    <span class="chart-legend-item">${p.icon}${esc(p.name)}</span>
    <span class="chart-legend-item"><i style="background:${p.bar}"></i>Posts (staven, links) <b>${sig3(postTotal)}</b></span>
    <span class="chart-legend-item"><i class="combo-key-line" style="background:${p.line}"></i>${esc(measureLabel)} (lijn, rechts) <b>${sig3(p.reachTotal)}</b></span></div>`);
  const headH = $('#slideHead').offsetHeight + (view.firstElementChild?.offsetHeight || 0) + 24;
  const W = SLIDE_W - 2 * PAD_X;
  const H = fixedH ? Math.max(260, fixedH - PAD_TOP - PAD_BOTTOM - headH) : 680;
  const fs = 17;
  const font = (size, weight = 500) => `${weight} ${size}px Roboto, system-ui, sans-serif`;
  const nice = (lo, hi, minStep) => {
    const raw = (hi - lo) / 5 || 0.1;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = Math.max(minStep, [1, 2, 5, 10].map(f => f * mag).find(v => raw <= v) || 10 * mag);
    return { lo, step, hi: lo + Math.max(1, Math.ceil((hi - lo) / step - 1e-9)) * step };
  };
  const every = [1, 2, 3, 4, 6, 12].find(k => hours.length / k <= 16) || 24;

  {
    const canvas = document.createElement('canvas');
    canvas.width = W * 2;
    canvas.height = H * 2;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    canvas.className = 'chart-canvas';
    view.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    const pad = { l: 70, r: 90, t: 30, b: 80 };
    const plotW = W - pad.l - pad.r, plotH = H - pad.t - pad.b;
    const left = nice(0, Math.max(1, ...p.posts), 1);
    const vals = p.reach.filter(v => v !== null);
    const rMin = ratio && vals.length ? Math.floor(Math.min(...vals) * 10) / 10 : 0;
    const right = nice(rMin, Math.max(rMin + 0.1, ...vals), 0);
    const slot = plotW / hours.length;
    const barW = Math.max(2, Math.min(40, slot * 0.6));
    const x = (i) => pad.l + (i + 0.5) * slot;
    const yL = (v) => pad.t + plotH - (v / left.hi) * plotH;
    const yR = (v) => pad.t + plotH - ((v - right.lo) / (right.hi - right.lo)) * plotH;

    // raster op de linkeras; rechteras alleen labels in de lijnkleur
    ctx.font = font(fs);
    ctx.textBaseline = 'middle';
    for (let v = 0; v <= left.hi + 1e-9; v += left.step) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#49454F';
      ctx.fillText(sig3(v), pad.l - 14, yL(v));
      if (v === 0) continue;
      ctx.strokeStyle = '#E6E0E9';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.l, Math.round(yL(v)) + .5); ctx.lineTo(pad.l + plotW, Math.round(yL(v)) + .5); ctx.stroke();
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = '#49454F';
    for (let k = 0; right.lo + k * right.step <= right.hi + right.step / 1000; k++) {
      const v = right.lo + k * right.step;
      ctx.fillText(sig3(Math.round(v * 1e6) / 1e6), pad.l + plotW + 14, yR(v));
    }

    p.posts.forEach((c, i) => {
      if (!c) return;
      const top = yL(c), h = Math.max(1, yL(0) - top);
      ctx.fillStyle = p.bar;
      ctx.beginPath();
      ctx.roundRect(x(i) - barW / 2, top, barW, h, [Math.min(5, barW / 3, h), Math.min(5, barW / 3, h), 0, 0]);
      ctx.fill();
    });

    ctx.strokeStyle = '#79747E';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(pad.l, yL(0)); ctx.lineTo(pad.l + plotW, yL(0)); ctx.stroke();

    ctx.strokeStyle = p.line;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let pen = false;
    p.reach.forEach((v, i) => {
      if (v === null) { pen = false; return; }
      if (pen) ctx.lineTo(x(i), yR(v)); else ctx.moveTo(x(i), yR(v));
      pen = true;
    });
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    hours.forEach((t, i) => {
      const midnight = absolute && isLocalMidnight(t);
      const hourOfDay = Math.floor((((localOf(t) % 1440) + 1440) % 1440) / 60);
      if (!midnight && hourOfDay % every) return;
      ctx.fillStyle = midnight ? '#1D1B20' : '#49454F';
      ctx.font = font(fs, midnight ? 700 : 500);
      ctx.fillText(midnight ? monthDayLabel(t) : timeLabel(t), x(i), pad.t + plotH + 14);
    });
  }
}

function buildCard(item, geo, ctx) {
  const r = item.row, m = state.mapping, s = state.settings;
  const brandName = m.brand ? r[m.brand] : null;
  const brand = brandName ? state.brands[brandName] : null;
  const color = brand?.color || PALETTE[0];
  const premium = !!(m.premium && isPremium(r[m.premium]));
  const liveblog = isLiveblog(m.title ? r[m.title] : '', m.articleType ? r[m.articleType] : '');
  const articleUrl = m.articleUrl ? String(r[m.articleUrl] ?? '').trim() : '';
  const hasArticleUrl = isHttpUrl(articleUrl);

  const card = document.createElement('div');
  card.className = 'm3-card style-' + (s.cardStyle || 'modern') + (premium ? ' premium' : '') + (liveblog ? ' liveblog' : '');
  card.dataset.minute = String(item.minutes);
  card.dataset.rid = String(r.__id);
  if (hasArticleUrl) card.classList.add('has-link');
  card.style.setProperty('--cs', geo.scale.toFixed(2));
  card.style.setProperty('--brand-color', color);
  card.style.setProperty('--brand-ink', onContainerColor(color));

  const logo = brandName ? brandLogo(brand, brandName) : null;
  const ratio = logo ? logoRatio(logo) : 2;
  const logoScaleKey = brand?.logoKey || '';
  const logoHost = brand?.logoHost || inferHostFromLogoValue(brand?.logo) || inferHostFromLogoValue(brandName);
  const logoBackups = faviconFallbackList(logoHost).join('|');
  const logoHtml = logo
    ? `<img class="brand-logo" src="${logo}" data-fallbacks="${escAttr(logoBackups)}" data-brand-text="${escAttr(brandName || '')}" onerror="onBrandLogoError(this)" alt="${escAttr(brandName)}" style="--ls:${LOGO_SCALE[logoScaleKey] || 1};--lr:${ratio}">`
    : (brandName ? `<span class="brand-text">${esc(brandName)}</span>` : '');

  const timeLabelTxt = s.relative && !ctx.live ? relLabel(item.minutes - ctx.base, true) : timeLabel(item.minutes);

  const imgSrc = !ctx.compact && s.showImage && m.image ? imageFor(r[m.image]) : null;

  const stats = ctx.compact ? '' : state.metrics.filter(mt => mt.column).map(mt => {
    const n = parseNumber(r[mt.column]);
    const best = n !== null && ctx.maxByMetric.get(mt.id) === n;
    const roundWhole = isCountMetric(mt.column, mt.label || mt.column);
    return `
    <div class="stat-row">
      <span class="stat-label"><i data-lucide="${mt.icon}" class="icon"></i>${esc(mt.label || mt.column)}</span>
      <span class="stat-value${best ? ' best' : ''}">${best ? '<i data-lucide="crown"></i>' : ''}${esc(formatValue(r[mt.column], mt.format, { roundWhole }))}</span>
    </div>`;
  }).join('');

  const lines = ctx.titleLines ?? (+s.titleLines || 0);
  const titleStyle = lines ? ` style="-webkit-line-clamp:${lines}"` : '';
  const bodyText = !ctx.compact && s.showBody && m.body ? clipText(bodyOnly(r), 450) : '';
  const linkedUrl = m.link ? String(r[m.link] ?? '').trim() : '';
  const hasLink = isHttpUrl(linkedUrl);
  const linkKind = hasLink ? linkInfo(r).cls : '';
  const premiumLink = linkKind === 'premium';
  const linkTip = premiumLink ? 'Eigen premium-artikel' : linkKind === 'external' ? 'Uitgaande link' : 'Eigen artikel';
  const linkChip = hasLink
    ? `<a class="link-chip${premiumLink ? ' premium-link' : ''}" href="${escAttr(linkedUrl)}" target="_blank" rel="noopener noreferrer" title="${linkTip}: ${escAttr(linkedUrl)}"><i data-lucide="${linkKind === 'external' ? 'external-link' : 'link'}"></i>${premiumLink ? '<i data-lucide="lock"></i>' : ''}</a>`
    : '';
  const social = socialOf(r);
  const mediaChips = (isVideoRow(r) ? '<span class="link-chip media-chip" title="Bevat video"><i data-lucide="play"></i></span>' : '')
    + (social ? `<span class="link-chip media-chip" title="Social embed: ${escAttr(social)}"><i data-lucide="at-sign"></i></span>` : '')
    + (isDatavizRow(r) ? '<span class="link-chip media-chip" title="Bevat datavisualisatie"><i data-lucide="bar-chart-3"></i></span>' : '');

  card.innerHTML = `
    <button class="card-delete" title="Tegel verwijderen">&times;</button>
    <div class="card-header">
      <div class="card-brand">${logoHtml}${ctx.brandName && logo && brandName ? `<span class="brand-name">${esc(brandName)}</span>` : ''}</div>
      <div class="card-chips">${liveblog && !ctx.onlyLiveblogs ? '<span class="live-chip">LIVE</span>' : ''}${mediaChips}${linkChip}<span class="time-chip">${timeLabelTxt}</span></div>
    </div>
    ${imgSrc ? `<img class="card-image" src="${escAttr(imgSrc)}" alt="">` : ''}
    <div class="m3-title${lines ? ' clamp' : ''}"${titleStyle}>${esc(m.title ? headOf(r) : '')}</div>
    ${bodyText ? `<div class="m3-body">${esc(bodyText)}</div>` : ''}
    ${stats ? `<div class="stats-container">${stats}</div>` : ''}`;

  const img = $('.card-image', card);
  if (img) img.addEventListener('error', () => { img.remove(); });

  $('.card-delete', card).addEventListener('click', () => {
    if (!state.removed.includes(r.__id)) state.removed.push(r.__id);
    renderTimeline(); save();
  });

  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.addEventListener('click', (ev) => {
    if (ev.target.closest('.card-delete') || ev.target.closest('.link-chip')) return;
    selectPost(r.__id);
  });
  card.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    if (ev.target.closest('.link-chip')) return;
    ev.preventDefault();
    selectPost(r.__id);
  });

  return card;
}

/* ============================================================
   Gekoppeld nieuws: tegel kiezen, rest dimmen, zijpaneel
   ============================================================ */
let selectedPostId = null;
const postKeyOf = (it) => state.mapping.brand ? (it.row[state.mapping.brand] || '\u2014') : '\u2014';
const isTimelineView = () => !['chart', 'table', 'compare', 'scatter'].includes(state.settings.view);
const cardLayerEl = () => $(state.settings.view === 'live' ? '#liveCards' : '#cardLayer');
const shownCards = () => $$('.m3-card', cardLayerEl());

/** Alle posts met een tijdstip, ook verwijderde en verborgen: in het paneel zijn gekoppelde posts altijd te zien. */
function allPostItems() {
  const m = state.mapping;
  if (!m.time) return [];
  return getActiveRows()
    .map(r => ({ row: r, minutes: parseTime(r[m.time]) }))
    .filter(it => it.minutes !== null)
    .sort((a, b) => a.minutes - b.minutes);
}

/** Naar de vorige (-1) of volgende (1) post van dezelfde titel op de tijdlijn. */
function stepSelection(dir) {
  const items = allPostItems();
  const cur = items.find(it => String(it.row.__id) === String(selectedPostId));
  if (!cur) return;
  const shown = new Set(shownCards().map(el => el.dataset.rid));
  const key = postKeyOf(cur);
  const sibs = items.filter(it => postKeyOf(it) === key && shown.has(String(it.row.__id)));
  // live staat de nieuwste bovenaan: omhoog is dan later
  const next = sibs[sibs.findIndex(it => it.row === cur.row) + (state.settings.view === 'live' ? -dir : dir)];
  if (next) selectPost(next.row.__id, { scroll: true });
}

function selectPost(id, { scroll = false } = {}) {
  selectedPostId = id === null || String(id) === String(selectedPostId) ? null : String(id);
  syncSelection(scroll);
}

function whenLabel(min) {
  if (!isAbsoluteMinutes(min)) return timeLabel(min);
  const day = new Intl.DateTimeFormat('nl-NL', { timeZone: NEWS_TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(min * 60000));
  return `${day} ${timeLabel(min)}`;
}

const shortUrl = (u, n = 52) => clipText(String(u).replace(/^https?:\/\/(www\.)?/i, ''), n);
const photoOf = (row) => state.mapping.image && isHttpUrl(row[state.mapping.image]) ? String(row[state.mapping.image]).trim() : '';
const photoSrc = (url) => imageFor(url) || (needsImageProxy(url) ? toProxyImageUrl(url) : url);
const msIcon = (icon, label) => `<span class="ms" title="${escAttr(label)}">${icon}</span>`;

/** Links van een post met soort: eigen artikel, eigen premium-artikel of uitgaand. */
function postLinks(row) {
  const m = state.mapping;
  const raw = m.link
    ? (m.link === 'artikel_link' ? rowLinks(row) : [String(row[m.link] ?? '').trim()])
    : String(row['Links'] ?? row.artikel_links ?? '').split(/\s+/);
  const urls = [...new Set(raw.filter(isHttpUrl))];
  const base = m.articleUrl ? String(row[m.articleUrl] ?? '').trim() : '';
  const ownSite = isHttpUrl(base) ? siteKey(hostFromUrl(base)) : '';
  const isOwn = (u) => !ownSite || siteKey(hostFromUrl(u)) === ownSite;
  const ownCount = urls.filter(isOwn).length;
  return urls.map(url => {
    if (!isOwn(url)) return { url, kind: 'external' };
    const premium = linkMeta[url]?.premium === true || (isLinkPremiumRow(row) && ownCount === 1);
    return { url, kind: premium ? 'premium' : 'own' };
  });
}
const LINK_KIND = {
  own: ['link', 'Eigen artikel'],
  premium: ['lock', 'Eigen premium-artikel'],
  external: ['open_in_new', 'Uitgaande link']
};

/** Verrijkingen van een post als icoon met uitleg: beeld, embeds en links. */
function postEnrichments(row, links = postLinks(row)) {
  const m = state.mapping, out = [];
  if (photoOf(row)) out.push(['image', 'Foto']);
  if (isVideoRow(row)) out.push(['play_circle', 'Video']);
  const social = socialOf(row);
  if (social) out.push(['alternate_email', `Social embed: ${social}`]);
  if (isDatavizRow(row)) out.push(['bar_chart', 'Datavisualisatie']);
  ['own', 'premium', 'external'].forEach(k => {
    const n = links.filter(l => l.kind === k).length;
    if (n) out.push([LINK_KIND[k][0], `${LINK_KIND[k][1]}${n > 1 ? ` (${n}×)` : ''}`]);
  });
  if (!links.some(l => l.kind === 'premium') && m.premium && isPremium(row[m.premium])) out.push(['workspace_premium', 'Premium']);
  return out;
}

/** Waarom een post niet op de tijdlijn staat; leeg als hij er wel op staat. */
function offTimeline(row, viewIds) {
  const m = state.mapping;
  if (state.removed.includes(row.__id)) return 'verwijderd uit de tijdlijn';
  if (m.brand && state.hiddenTitles.includes(row[m.brand])) return 'titel verborgen';
  return viewIds.has(String(row.__id)) ? '' : 'buiten het getoonde tijdvenster';
}

/** Pil zoals de tijdchip op de tijdlijntegels; cls: accent (primair), hard (bijna kopie), lg (groter). */
const pill = (html, cls = '', title = '') => `<span class="dp-pill${cls ? ' ' + cls : ''}"${title ? ` title="${escAttr(title)}"` : ''}>${html}</span>`;
const iconPill = (icon, label, withLabel = false, cls = '') => pill(`<span class="ms">${icon}</span>${withLabel ? esc(label) : ''}`, cls, label);
const COPY_LABEL = {
  near: ['bijna kopie', 'hard', 'Zoveel procent van de woorden staat in dezelfde volgorde in beide posts'],
  short: ['ingekorte kopie', 'hard', 'Zoveel procent van de woorden van de kortste post staat in dezelfde volgorde in de andere post'],
  part: ['deels gelijk', '', 'Overlap in woordreeksen van 3 woorden']
};
const copyBadge = (m) => {
  if (!m) return '';
  const [label, cls, tip] = COPY_LABEL[m.kind];
  return pill(`${label} ${Math.round(m.s * 100)}%`, cls, tip);
};

/** Een post in een lijst in het paneel: merk links, tijd en verschil rechts, daaronder kop, tekst en verrijkingen. */
function postEntryHtml(row, minutes, { lag = '', badge = '', foot = '' }, viewIds) {
  const m = state.mapping;
  const key = m.brand ? String(row[m.brand] ?? '') : '';
  const why = offTimeline(row, viewIds);
  const icons = postEnrichments(row).map(([ic, lb]) => iconPill(ic, lb)).join('');
  return `<button type="button" class="dp-item${why ? ' off' : ''}" data-id="${escAttr(row.__id)}">
    <span class="dp-item-top">${titleIconHtml(key, 'dp-icon')}<b>${esc(key)}</b><span class="dp-pills">${pill(esc(whenLabel(minutes)))}${lag}</span></span>
    <span class="dp-item-head">${esc(headOf(row))}</span>
    <span class="dp-item-body">${esc(clipText(bodyOnly(row), 200))}</span>
    <span class="dp-item-foot">${icons}${badge}<small>${[foot, why].filter(Boolean).map(esc).join(' \u00b7 ')}</small></span>
  </button>`;
}

/** Alle maten van een post: de cijfers uit de data en de tekstmaten van de app. */
function postMetrics(item, all) {
  const row = item.row, m = state.mapping;
  const yn = (v) => v ? 'ja' : 'nee';
  const rows = state.metrics.filter(mt => mt.column).map(mt =>
    [mt.label || mt.column, formatValue(row[mt.column], mt.format, { roundWhole: isCountMetric(mt.column, mt.label || mt.column) })]);
  const lens = sentenceLengths(row);
  const sentences = splitSentences(sentenceBody(row));
  const text = rowText(row);
  const count = (re) => (text.match(re) || []).length;
  const key = postKeyOf(item);
  const prev = all.filter(o => o !== item && o.minutes <= item.minutes && postKeyOf(o) === key).pop();
  rows.push(
    ['Woorden (kop en tekst)', allWords(row)],
    ['Lengte', LENGTH_CLASSES.find(c => c[0] === lengthClass(postWords(row)))[1]],
    ['Zinnen', lens.length || '\u2013'],
    ['Woorden per zin', lens.length ? (lens.reduce((a, b) => a + b, 0) / lens.length).toFixed(1).replace('.', ',') : '\u2013'],
    ['Kop met citaat', yn(QUOTE_RE.test(rowHead(row)))],
    ['Zinnen met een uitspraak', sentences.length ? `${sentences.filter(s => QUOTE_RE.test(s) || SPEECH_RE.test(s)).length} van ${sentences.length}` : '\u2013'],
    ['Bronvermelding', yn(AGENCY_RE.test(stripCredits(text)) || ATTRIB_RE.test(stripCredits(text)))],
    ['Urgentietaal (woorden)', count(URGENCY_RE)],
    ['Eigen land (woorden)', count(ownAngleRe(row))],
    ['Minuten sinds vorige post van de titel', prev ? relLabel(item.minutes - prev.minutes, false).replace(/^\+/, '') : '\u2013']
  );
  return rows;
}

/** Bijna-kopieën buiten de groep: bij andere titels (horen bij het nieuws) en bij dezelfde titel (herhaling). */
function copiesOf(item, all, group) {
  const key = postKeyOf(item);
  const inGroup = new Set(group ? group.posts.map(p => String(p.id)) : []);
  const found = nearCopies(item, all).filter(c => !inGroup.has(String(c.o.row.__id)));
  return { others: found.filter(c => postKeyOf(c.o) !== key), same: found.filter(c => postKeyOf(c.o) === key) };
}

const RICH_LINK = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;

/** De tekst van een post als alinea's met links in de tekst; null als de opmaak ontbreekt of niet bij de getoonde tekst past. */
function richBody(row, body) {
  const rich = String(row.update_opmaak ?? '').trim();
  if (!rich || !body) return null;
  const norm = (s) => s.toLowerCase().replace(/[^\p{L}\d]+/gu, '');
  const target = norm(body);
  const paras = rich.split(/\n{2,}/);
  for (let i = 0; i < Math.min(paras.length, 4); i++) {
    const shown = paras.slice(i);
    if (norm(shown.map(p => p.replace(RICH_LINK, '$1')).join(' ')) !== target) continue;
    const urls = new Set();
    shown.forEach(p => [...p.matchAll(RICH_LINK)].forEach(m => { urls.add(m[2]); urls.add(m[2].replace(/%29/g, ')')); }));
    const html = shown.map(p => `<p>${esc(p).replace(RICH_LINK, (_, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`)}</p>`).join('');
    return { html, urls };
  }
  return null;
}

function detailHtml(item, group, all, viewIds) {
  const row = item.row, m = state.mapping;
  const brandName = m.brand ? String(row[m.brand] ?? '') : '';
  const articleUrl = m.articleUrl ? String(row[m.articleUrl] ?? '').trim() : '';
  const me = group?.posts.find(p => p.id === row.__id);
  const role = !me ? '' : me.lag === 0 ? 'Eerste' : relLabel(me.lag, true);
  const body = bodyOnly(row);
  const rich = richBody(row, body);
  const photo = photoOf(row);
  const links = postLinks(row);
  const why = offTimeline(row, viewIds);
  const skip = new Set([m.title, m.body, 'update_opmaak'].filter(Boolean));
  const raw = Object.entries(row)
    .filter(([k, v]) => !k.startsWith('__') && !skip.has(k) && String(v ?? '').trim() !== '')
    .map(([k, v]) => {
      const parts = String(v).trim().split(/\s+/);
      const val = parts.every(isHttpUrl)
        ? parts.map(u => `<a href="${escAttr(u)}" target="_blank" rel="noopener noreferrer">${esc(shortUrl(u))}</a>`).join('<br>')
        : esc(clipText(v, 300));
      return `<dt>${esc(k)}</dt><dd>${val}</dd>`;
    }).join('');

  const related = group ? group.posts.filter(p => p.id !== row.__id) : [];
  const { others, same } = copiesOf(item, all, group);
  const entries = [
    ...related.map(p => ({ row: p.row, minutes: p.minutes,
      lag: pill(p.lag === 0 ? 'eerste' : esc(relLabel(p.lag, true)), 'accent'), badge: copyBadge(copyMatch(row, p.row)), foot: `gelijkenis ${Math.round(p.sim * 100)}%` })),
    ...others.map(c => ({ row: c.o.row, minutes: c.o.minutes, badge: copyBadge(c), foot: `${relLabel(c.o.minutes - item.minutes, true)} t.o.v. deze post` }))
  ].sort((x, y) => x.minutes - y.minutes);
  const relatedInfo = `Posts van andere titels over hetzelfde nieuws, ook als ze niet op de tijdlijn staan. Gekoppeld op tekstgelijkenis binnen ${group ? Math.round(group.window / 60) : 3} uur, of als kopie binnen 24 uur: 80% of meer dezelfde woorden in dezelfde volgorde (bijna kopie), de kortste post staat voor 80% of meer in de andere (ingekorte kopie), of 50% of meer dezelfde woordreeksen van 3 woorden (deels gelijk). De achterstand is gemeten vanaf de eerste post van de groep.`;
  const relatedNote = entries.length ? '' : '<p class="dp-note">Geen vergelijkbare post van een andere titel gevonden. Dat kan ook liggen aan een korte post of een post zonder tekst.</p>';
  const relatedList = entries.map(e => postEntryHtml(e.row, e.minutes, e, viewIds)).join('');
  const sameHtml = same.length
    ? `<section class="dp-sec"><h4 class="dp-sec-head">Herhaald in dezelfde titel<small>${same.length}</small></h4><div class="dp-list">`
      + same.map(c => postEntryHtml(c.o.row, c.o.minutes, { badge: copyBadge(c), foot: `${relLabel(c.o.minutes - item.minutes, true)} t.o.v. deze post` }, viewIds)).join('')
      + '</div></section>'
    : '';

  const metrics = postMetrics(item, all).map(([k, v]) => `<div class="dp-stat"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');

  const loose = rich ? links.filter(l => !rich.urls.has(l.url)) : links;
  const chips = postEnrichments(row, links).map(([ic, lb]) => iconPill(ic, lb, true, 'lg')).join('')
    || '<span class="dp-note">Geen foto, video, embed of link</span>';
  return `
    <header class="dp-top">
      ${brandName ? titleIconHtml(brandName, 'dp-logo') : ''}
      <div class="dp-who"><b>${esc(brandName || 'Post')}</b></div>
      ${pill(esc(whenLabel(item.minutes)))}
      <button type="button" class="icon-btn" id="dpClose" title="Sluiten (Esc)"><span class="ms">close</span></button>
    </header>
    <div class="dp-body">
      ${why ? `<p class="dp-warn"><span class="ms">info</span>Deze post staat niet in de tijdlijn: ${esc(why)}.</p>` : ''}
      <article class="dp-msg">
        ${role ? pill(esc(role), 'accent') : ''}
        <h3 class="dp-title">${esc(headOf(row))}</h3>
        ${photo ? `<img class="dp-photo" src="${escAttr(photoSrc(photo))}" referrerpolicy="no-referrer" alt="" onerror="this.remove()">` : ''}
        ${body ? `<div class="dp-text">${rich ? rich.html : esc(body)}</div>` : ''}
        <div class="dp-chips">${chips}</div>
        ${loose.length ? `<ul class="dp-links">${loose.map(l => `<li>${msIcon(LINK_KIND[l.kind][0], LINK_KIND[l.kind][1])}<a href="${escAttr(l.url)}" target="_blank" rel="noopener noreferrer">${esc(shortUrl(l.url, 46))}</a><small>${LINK_KIND[l.kind][1]}</small></li>`).join('')}</ul>` : ''}
        ${isHttpUrl(articleUrl) ? `<a class="btn tonal" href="${escAttr(articleUrl)}" target="_blank" rel="noopener noreferrer"><span class="ms">open_in_new</span>Open liveblog</a>` : ''}
      </article>
      <section class="dp-sec"><h4 class="dp-sec-head">Kenmerken van deze post</h4><dl class="dp-stats">${metrics}</dl></section>
      <section class="dp-sec"><h4 class="dp-sec-head">Hetzelfde nieuws bij andere titels<span class="ms dp-info" title="${escAttr(relatedInfo)}">info</span><small>${entries.length}</small></h4>${relatedNote}<div class="dp-list">${relatedList}</div></section>
      ${sameHtml}
      <details class="dp-sec dp-raw"><summary class="dp-sec-head">Alle gegevens uit de data</summary><dl class="dp-meta">${raw}</dl></details>
    </div>`;
}

/** Zet selectie, dimming en zijpaneel gelijk met selectedPostId; ook na elke nieuwe tekening. */
function syncSelection(scroll = false) {
  const panel = $('#detailPanel');
  const layer = cardLayerEl();
  const cards = shownCards();
  const rid = selectedPostId === null ? null : String(selectedPostId);
  const all = isTimelineView() && rid !== null ? allPostItems() : [];
  const item = all.find(it => String(it.row.__id) === rid);
  if (!item) selectedPostId = null;
  const wasOpen = !panel.hidden;

  if (item) {
    const group = sharedMoments(all, postKeyOf).byId.get(item.row.__id) || null;
    const ids = new Set([rid, ...(group ? group.posts.map(p => String(p.id)) : []), ...copiesOf(item, all, group).others.map(c => String(c.o.row.__id))]);
    cards.forEach(el => {
      el.classList.toggle('selected', el.dataset.rid === rid);
      el.classList.toggle('related', el.dataset.rid !== rid && ids.has(el.dataset.rid));
      el.classList.toggle('dim', !ids.has(el.dataset.rid));
    });
    const keepTop = panel.dataset.rid === rid ? $('.dp-body', panel)?.scrollTop || 0 : 0;
    panel.innerHTML = detailHtml(item, group, all, new Set(cards.map(el => el.dataset.rid)));
    panel.dataset.rid = rid;
    $('.dp-body', panel).scrollTop = keepTop;
    $('#dpClose', panel).addEventListener('click', () => selectPost(null));
    $$('.dp-item[data-id]', panel).forEach(b => b.addEventListener('click', () => selectPost(b.dataset.id, { scroll: true })));
  } else {
    cards.forEach(el => el.classList.remove('selected', 'related', 'dim'));
  }
  layer.classList.toggle('has-selection', !!item);
  panel.hidden = !item;
  if (wasOpen === panel.hidden) applyZoom();
  if (item && scroll) cards.find(el => el.dataset.rid === rid)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

/* ============================================================
   Live: een eigen bord voor een scherm op de redactie
   ============================================================ */
const LIVE_RECENT_MIN = 1440;     // nieuwste post binnen een dag: de klok loopt echt mee
const LIVE_LANE_MIN = 720;        // een titel houdt zijn baan zolang zijn laatste post niet ouder is dan dit (of het venster)
const LIVE_NEW_MS = 5 * 60000;    // zo lang houdt een nieuwe post het label Nieuw
const LIVE_ENTER_MS = 12000;      // duur van de binnenkomst-animatie
const LIVE_COL_MAX_W = 340, LIVE_COL_MIN_W = 240, LIVE_COL_GAP = 16, LIVE_LANE_GAP = 36, LIVE_ROW_GAP = 14;
const liveSeen = new Set();
const liveNewAt = new Map();
let liveSeeded = false;
let liveReplay = null;            // oude data: de klok loopt door vanaf de nieuwste post
let liveBoard = null;             // indeling van de laatste tekening; de klok verschuift die elke seconde

const liveKey = (row) => {
  const m = state.mapping;
  return `${row.__datasetId ?? ''}|${Math.round(parseTime(row[m.time]) ?? 0)}|${String(row[m.title] ?? '').trim()}`;
};
const windowLabel = (w) => w % 60 ? `${w} min` : w === 60 ? 'uur' : `${w / 60} uur`;
const clockLabel = (min) => new Intl.DateTimeFormat('nl-NL', { timeZone: NEWS_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(min * 60000));
const liveAgo = (d) => d < 1 ? 'zojuist' : d < 60 ? `${Math.floor(d)} min geleden` : `${Math.floor(d / 60)} u ${Math.floor(d % 60)} min geleden`;

/** De klok van het bord: nu, of bij oude data een klok die vanaf de nieuwste post doorloopt. */
function liveClock(all) {
  const nowReal = Date.now() / 60000;
  const newest = all.length ? all[all.length - 1].minutes : null;
  const live = newest !== null && isAbsoluteMinutes(newest) && nowReal - newest <= LIVE_RECENT_MIN;
  if (live) return { now: Math.max(nowReal, newest), live, newest };
  if (newest === null) return { now: nowReal, live, newest };
  if (!liveReplay || liveReplay.at !== newest) liveReplay = { at: newest, real: Date.now() };
  return { now: newest + (Date.now() - liveReplay.real) / 60000, live, newest };
}

/** Tegels van posts die sinds de vorige keer zijn binnengekomen krijgen een label en een binnenkomst-animatie. */
function updateLiveSeen(all) {
  const keys = all.map(it => liveKey(it.row));
  if (!liveSeeded) { keys.forEach(k => liveSeen.add(k)); liveSeeded = all.length > 0; }
  const unseen = keys.filter(k => !liveSeen.has(k));
  unseen.forEach(k => liveSeen.add(k));
  // een hele nieuwe dataset in één keer is geen binnenkomst
  if (unseen.length <= 15) unseen.forEach(k => liveNewAt.set(k, Date.now()));
}
const liveSince = (row) => { const at = liveNewAt.get(liveKey(row)); return at ? Date.now() - at : Infinity; };

function markNewCards(all, items, cards) {
  updateLiveSeen(all);
  items.forEach((it, i) => {
    const since = liveSince(it.row);
    if (since >= LIVE_NEW_MS) return;
    const el = cards[i];
    el.classList.add('is-new');
    $('.card-chips', el)?.insertAdjacentHTML('afterbegin', '<span class="live-chip new-chip">Nieuw</span>');
    if (since < LIVE_ENTER_MS) { el.classList.add('enter'); el.style.setProperty('--since', `-${since}ms`); }
  });
}

function liveBarHtml(clock, win) {
  const sources = (state.datasets || []).filter(d => d.active && d.sourceUrl);
  const lastRefresh = Math.max(0, ...sources.map(d => d.refreshedAt || 0));
  const status = clock.newest === null ? 'Nog geen posts'
    : !clock.live ? `Replay: de klok loopt door vanaf de laatste post (${whenLabel(clock.newest)})`
    : !sources.length ? 'Geen liveblog-bron om te verversen'
    : !extensionBridge ? 'Verversen kan alleen met de Chrome-extensie'
    : `Elke minuut ververst${lastRefresh ? ` \u00b7 laatst om ${clockLabel(lastRefresh / 60000)}` : ''}`;
  const wall = document.body.classList.contains('wall');
  const opts = [15, 30, 60, 120, 180].map(w => `<option value="${w}"${w === win ? ' selected' : ''}>laatste ${windowLabel(w)}</option>`).join('');
  return `<header class="lv-bar">
      <span class="lv-state${clock.live ? ' on' : ''}"><span class="lv-dot"></span>${clock.live ? 'Live' : clock.newest === null ? 'Niet live' : 'Replay'}</span>
      <select id="liveWindow" class="lv-window" aria-label="Venster">${opts}</select>
      <span class="lv-status">${esc(status)}</span>
      <button type="button" class="icon-btn" id="btnWall" title="${wall ? 'Muurweergave sluiten' : 'Muurweergave: schermvullend voor een scherm op de redactie'}"><span class="ms">${wall ? 'fullscreen_exit' : 'fullscreen'}</span></button>
    </header>`;
}

/** Het bord: een baan per titel over de volle breedte, nu bovenaan en oudere posts naar beneden. */
function renderLiveBoard() {
  const host = $('#liveView');
  const m = state.mapping;
  const all = visibleItems();
  const win = +state.settings.liveWindow || 60;
  const clock = liveClock(all);
  const laneOf = (it) => (m.brand ? it.row[m.brand] || '\u2014' : '\u2014');
  const lastBy = new Map(all.map(it => [laneOf(it), it.minutes]));
  const lanes = [...lastBy.keys()].filter(t => clock.now - lastBy.get(t) <= Math.max(LIVE_LANE_MIN, win));
  const n = lanes.length;

  host.innerHTML = liveBarHtml(clock, win)
    + '<div class="lv-board"><div class="lv-corner"><span class="lv-clock"></span></div><div class="lv-heads"></div><div class="lv-axis"></div>'
    + '<div class="lv-plot" id="liveCards"><div class="lv-lanes"></div><div class="lv-grid"></div></div></div>';
  liveBoard = null;
  const plot = $('#liveCards');
  if (!n || !m.time || !m.title) {
    const msg = !state.rows.length ? 'Voeg data toe in het Data-blok' : !m.time || !m.title ? 'Kies bij Velden een kolom voor tijdstip en titel' : 'Nog geen posts';
    plot.insertAdjacentHTML('beforeend', `<p class="lv-none">${msg}</p>`);
    $('#previewInfo').textContent = '0 tegels';
    return;
  }
  const W = plot.clientWidth, H = plot.clientHeight;
  if (W < 200 || H < 150) return;
  const px = H / win;

  // nieuwste eerst; een tegel komt nooit hoger dan zijn eigen tijdstip
  const order = all.filter(it => it.minutes <= clock.now && it.minutes >= clock.now - win).reverse();
  const ages = order.map(it => clock.now - it.minutes);
  const laneIdx = order.map(it => lanes.indexOf(laneOf(it)));
  const byLane = lanes.map((_, li) => order.map((__, i) => i).filter(i => laneIdx[i] === li));

  const ctx = { base: 0, maxByMetric: new Map(), onlyLiveblogs: true, live: true, titleLines: 3, brandName: true };
  const cards = order.map(it => {
    const el = buildCard(it, { scale: 1 }, ctx);
    el.style.visibility = 'hidden';
    plot.appendChild(el);
    return el;
  });
  markNewCards(all, order, cards);
  if (window.lucide) lucide.createIcons();

  // tegels van één titel in `cap` kolommen; alleen als er geen ruimte is schuift een tegel naar beneden
  const packLane = (idx, cap, heights) => {
    const bottom = new Array(cap).fill(-Infinity);
    let shifted = false;
    const out = idx.map(i => {
      const want = ages[i] * px;
      let c = bottom.findIndex(b => b + LIVE_ROW_GAP <= want);
      let top = want;
      if (c < 0) { c = bottom.indexOf(Math.min(...bottom)); top = bottom[c] + LIVE_ROW_GAP; shifted = true; }
      bottom[c] = top + heights[i];
      return { col: c, top };
    });
    return { out, shifted };
  };

  // C kolommen over de volle breedte; titels die niet passen krijgen er een bij
  const trial = (C, f) => {
    const colW = (W - LIVE_LANE_GAP * (n - 1) - LIVE_COL_GAP * (C - n)) / C;
    const scale = Math.min(1.7, colW / 320) * f;
    cards.forEach(el => { el.style.width = colW + 'px'; el.style.setProperty('--cs', scale.toFixed(3)); });
    const heights = cards.map(el => el.offsetHeight);
    const caps = new Array(n).fill(1);
    const packs = byLane.map(idx => packLane(idx, 1, heights));
    for (let free = C - n; free > 0; free--) {
      let pick = -1;
      packs.forEach((p, li) => { if (p.shifted && (pick < 0 || byLane[li].length > byLane[pick].length)) pick = li; });
      // past alles al: de rest van de breedte gaat naar de drukste titel, zodat tegels nooit breder worden
      if (pick < 0) byLane.forEach((idx, li) => { if (idx.length && (pick < 0 || idx.length / caps[li] > byLane[pick].length / caps[pick])) pick = li; });
      if (pick < 0) break;
      caps[pick]++;
      packs[pick] = packLane(byLane[pick], caps[pick], heights);
    }
    return { colW, caps, packs, fits: packs.every(p => !p.shifted) };
  };
  // een tegel is nooit breder dan LIVE_COL_MAX_W (zoals in de tijdlijn); past het niet, dan kleinere tekst en meer kolommen
  const minC = Math.max(n, Math.ceil((W + LIVE_COL_GAP) / (LIVE_COL_MAX_W + LIVE_COL_GAP)));
  const maxC = Math.max(minC, Math.min(12, Math.floor((W + LIVE_COL_GAP) / (LIVE_COL_MIN_W + LIVE_COL_GAP))));
  let best;
  search: for (const f of [1, .9, .8, .7]) {
    for (let C = minC; C <= maxC; C++) {
      best = trial(C, f);
      if (best.fits) break search;
    }
  }

  const { colW, caps, packs } = best;
  const laneX = [];
  let x = 0;
  lanes.forEach((_, li) => { laneX.push(x); x += caps[li] * colW + (caps[li] - 1) * LIVE_COL_GAP + LIVE_LANE_GAP; });
  const laneW = caps.map(c => c * colW + (c - 1) * LIVE_COL_GAP);
  const placed = [];
  byLane.forEach((idx, li) => idx.forEach((i, k) => {
    const { col, top } = packs[li].out[k];
    cards[i].style.left = (laneX[li] + col * (colW + LIVE_COL_GAP)) + 'px';
    placed.push({ el: cards[i], real: order[i].minutes, shift: top - ages[i] * px });
  }));

  $('.lv-lanes').innerHTML = lanes.map((t, li) => `<div class="lv-lane" style="left:${laneX[li]}px;width:${laneW[li]}px">${byLane[li].length ? '' : `<span class="lv-empty">Geen posts in het laatste ${windowLabel(win)}</span>`}</div>`).join('');
  const heads = $('.lv-heads');
  heads.style.display = m.brand ? '' : 'none';
  heads.innerHTML = lanes.map((t, li) => `<div class="lv-head" style="left:${laneX[li]}px;width:${laneW[li]}px"><span class="lv-count" title="Posts in dit venster">${byLane[li].length}</span><span class="lv-last"></span></div>`).join('');

  liveBoard = {
    plot, axis: $('.lv-axis'), grid: $('.lv-grid'), clockEl: $('.lv-clock'), px, H, win,
    off: tzOffsetMinutes(NEWS_TZ, clock.now * 60000), now0: clock.now, t0: Date.now(), cards: placed,
    heads: $$('.lv-head', heads).map((el, li) => ({ el, last: $('.lv-last', el), at: lastBy.get(lanes[li]) }))
  };
  $('#previewInfo').textContent = `${order.length} ${order.length === 1 ? 'tegel' : 'tegels'}`;
  tickLive();
}

/** Tijdas en rasterlijnen voor het moment `now`; ze schuiven mee met de klok. */
function drawLiveAxis(b, now) {
  const step = b.win <= 30 ? 5 : b.win <= 60 ? 10 : b.win <= 120 ? 15 : 30;
  let ticks = '', lines = '';
  for (let t = Math.floor((now + b.off) / step) * step - b.off; t >= now - b.win; t -= step) {
    const y = ((now - t) * b.px).toFixed(1);
    const hour = Math.round(t + b.off) % 60 === 0;
    lines += `<div class="lv-line${hour ? ' hour' : ''}" style="top:${y}px"></div>`;
    if (y > 14 && y < b.H - 8) ticks += `<div class="lv-tick${hour ? ' hour' : ''}" style="top:${y}px">${timeLabel(t)}</div>`;
  }
  b.axis.innerHTML = ticks;
  b.grid.innerHTML = lines;
}

/** Elke seconde: tegels, as en klok schuiven een stukje mee. */
function tickLive() {
  const b = liveBoard;
  if (!b || state.settings.view !== 'live' || !b.plot.isConnected) return;
  const now = b.now0 + (Date.now() - b.t0) / 60000;
  b.cards.forEach(c => {
    const top = (now - c.real) * b.px + c.shift;
    c.el.style.top = top.toFixed(1) + 'px';
    c.el.style.visibility = top >= b.H ? 'hidden' : 'visible';
  });
  drawLiveAxis(b, now);
  b.clockEl.textContent = clockLabel(now);
  b.heads.forEach(h => {
    const ago = now - h.at;
    h.last.textContent = `laatste ${liveAgo(ago)}`;
    h.el.classList.toggle('fresh', ago < 5);
  });
}

function toggleWall(on = !document.body.classList.contains('wall')) {
  document.body.classList.toggle('wall', on);
  if (on && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  if (!on && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  if (state.settings.view === 'live') renderTimeline();
}

function bindLive() {
  const host = $('#liveView');
  host.addEventListener('click', (ev) => {
    if (ev.target.closest('#btnWall')) toggleWall();
  });
  host.addEventListener('change', (ev) => {
    if (ev.target.id !== 'liveWindow') return;
    state.settings.liveWindow = +ev.target.value;
    renderTimeline(); save();
  });
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && document.body.classList.contains('wall')) toggleWall(false);
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && document.body.classList.contains('wall') && !document.fullscreenElement && selectedPostId === null) toggleWall(false);
  });
  // de klok loopt elke seconde mee; elke minuut wordt het bord opnieuw ingedeeld en verversen de bronnen
  setInterval(tickLive, 1000);
  setInterval(() => { if (state.settings.view === 'live') renderTimeline(); }, 60000);
  let resizeTimer;
  new ResizeObserver(() => {
    if (state.settings.view !== 'live') return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderTimeline, 150);
  }).observe(host);
  setInterval(() => { if (state.settings.view === 'live' && extensionBridge) refreshAll(true); }, 60000);
}

/* ============================================================
   Zoom
   ============================================================ */
const fitScale = () => Math.min(1, ($('#stageScroll').clientWidth - 48) / SLIDE_W);

function applyZoom() {
  const wrap = $('#slideWrap');
  const z = zoom ?? fitScale();
  wrap.style.transform = `scale(${z})`;
  wrap.style.width = (SLIDE_W * z) + 'px';
  wrap.style.height = ($('#slide').offsetHeight * z) + 'px';
  $('#zoomVal').textContent = Math.round(z * 100) + '%';
}

/* ============================================================
   PNG downloaden / kopiëren
   ============================================================ */
async function renderCanvas() {
  if (!window.html2canvas) throw new Error('De export-bibliotheek kon niet geladen worden (internet nodig).');
  const wrap = $('#slideWrap'), slide = $('#slide');
  const prev = { t: wrap.style.transform, w: wrap.style.width, h: wrap.style.height };
  wrap.style.transform = 'none'; wrap.style.width = 'auto'; wrap.style.height = 'auto';
  document.body.classList.add('exporting');
  try {
    return await html2canvas(slide, { scale: 1, backgroundColor: '#ffffff', useCORS: true, logging: false });
  } finally {
    document.body.classList.remove('exporting');
    wrap.style.transform = prev.t; wrap.style.width = prev.w; wrap.style.height = prev.h;
    applyZoom();
  }
}

async function downloadPng() {
  try {
    toast('Afbeelding maken…');
    const canvas = await renderCanvas();
    const a = document.createElement('a');
    a.download = `reconstruct-${new Date().toISOString().slice(0, 10)}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    toast('PNG gedownload.');
  } catch (err) { console.error(err); toast('Downloaden mislukt: ' + err.message); }
}

async function copyPng() {
  try {
    toast('Afbeelding maken…');
    const canvas = await renderCanvas();
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast('Gekopieerd — plak hem in PowerPoint, Slides of Teams.');
  } catch (err) {
    console.error(err);
    toast('Kopiëren lukte niet in deze browser. Gebruik "Download PNG".');
  }
}

function gifThresholds(items, start, end, maxFrames = 30) {
  const unique = [...new Set(items.map(it => it.minutes))].sort((a, b) => a - b);
  if (!unique.length) return [start, end];

  if (unique.length <= maxFrames - 2) {
    const out = [start, ...unique, end];
    return [...new Set(out)].sort((a, b) => a - b);
  }

  const sampled = [start];
  for (let i = 1; i <= maxFrames - 2; i++) {
    const idx = Math.round((i * (unique.length - 1)) / (maxFrames - 1));
    sampled.push(unique[idx]);
  }
  sampled.push(end);
  return [...new Set(sampled)].sort((a, b) => a - b);
}

function gifSpeedProfile() {
  const mode = state.settings.gifSpeed || 'slow';
  const profiles = {
    slow: { maxFrames: 36, edgeDelay: 1300, stepDelay: 260, label: 'langzaam' },
    normal: { maxFrames: 30, edgeDelay: 900, stepDelay: 180, label: 'normaal' },
    fast: { maxFrames: 22, edgeDelay: 700, stepDelay: 110, label: 'snel' }
  };
  return profiles[mode] || profiles.slow;
}

function videoSpeedProfile() {
  const speed = state.settings.gifSpeed || 'slow';
  const mode = state.settings.videoMode || 'cinematic';

  const speedProfiles = {
    slow: { mainFrames: 42, label: 'langzaam' },
    normal: { mainFrames: 32, label: 'normaal' },
    fast: { mainFrames: 24, label: 'snel' }
  };
  const base = speedProfiles[speed] || speedProfiles.slow;

  const cinematic = {
    ...base,
    introFrames: 5,
    outroFrames: 4,
    frameRate: 10,
    easing: 'ease',
    modeLabel: 'cinematic'
  };
  const briefing = {
    ...base,
    mainFrames: Math.max(24, Math.round(base.mainFrames * 0.72)),
    introFrames: 1,
    outroFrames: 1,
    frameRate: 8,
    easing: 'linear',
    modeLabel: 'briefing'
  };

  return mode === 'briefing' ? briefing : cinematic;
}

function easeInOutSine(t) {
  return 0.5 - (Math.cos(Math.PI * t) / 2);
}

async function gifWorkerUrl() {
  const local = new URL('lib/gif.worker.js', window.location.href).href;
  const sources = [
    local,
    'https://unpkg.com/gif.js.optimized/dist/gif.worker.js'
  ];
  for (const src of sources) {
    try {
      const res = await fetch(src, { cache: 'no-store' });
      if (!res.ok) continue;
      const js = await res.text();
      const blob = new Blob([js], { type: 'text/javascript' });
      return URL.createObjectURL(blob);
    } catch {
      // Probeer de volgende bron.
    }
  }
  throw new Error('gif.worker.js kon niet geladen worden.');
}

function assertWorkerUsable(workerUrl) {
  try {
    const w = new Worker(workerUrl);
    w.terminate();
  } catch {
    const viaFile = window.location.protocol === 'file:';
    if (viaFile) {
      throw new Error('Deze browser blokkeert workers op file://. Open Reconstruct via http://localhost:8777.');
    }
    throw new Error('Web Worker kon niet starten in deze browsercontext. Herlaad de pagina en probeer opnieuw.');
  }
}

async function downloadGif() {
  if (!window.html2canvas) throw new Error('html2canvas ontbreekt.');
  if (!window.GIF) throw new Error('GIF-bibliotheek kon niet geladen worden.');

  const { start, end } = rangeMinutes();
  const items = visibleItems().filter(it => it.minutes >= start && it.minutes <= end);
  if (!items.length) throw new Error('Geen artikelen binnen het gekozen tijdvenster.');

  const wrap = $('#slideWrap');
  const slide = $('#slide');
  const layer = $('#cardLayer');
  const body = $('.slide-body', slide);
  const axis = $('.timeline-axis', slide);
  const head = $('#slideHead');
  const fmt = state.settings.format;
  const targetH = SLIDE_FORMATS[fmt]?.h || 1080;
  const cards = $$('.m3-card', layer).map(el => ({
    el,
    minute: parseFloat(el.dataset.minute || 'NaN'),
    prevOpacity: el.style.opacity,
    prevVisibility: el.style.visibility
  })).filter(c => Number.isFinite(c.minute));
  if (!cards.length) throw new Error('Geen zichtbare tegels om te exporteren.');

  const speed = gifSpeedProfile();
  const thresholds = gifThresholds(items, start, end, speed.maxFrames);
  const prev = { t: wrap.style.transform, w: wrap.style.width, h: wrap.style.height };
  const prevSlideH = slide.style.height;
  const prevBodyH = body.style.height;
  const prevBodyOverflow = body.style.overflow;
  const prevLayerTransform = layer.style.transform;
  const prevAxisTransform = axis.style.transform;
  wrap.style.transform = 'none';
  wrap.style.width = 'auto';
  wrap.style.height = 'auto';
  document.body.classList.add('exporting');
  setRecordingOverlay(true);
  setRecordingProgress(0, 'Voorbereiden', 'GIF opname');

  const headH = head.hidden ? 0 : head.offsetHeight;
  const bodyViewportH = Math.max(220, targetH - PAD_TOP - PAD_BOTTOM - headH);
  slide.style.height = `${targetH}px`;
  body.style.height = `${bodyViewportH}px`;
  body.style.overflow = 'hidden';
  layer.style.transform = 'translateY(0px)';
  axis.style.transform = 'translateY(0px)';

  const contentH = layer.offsetHeight;
  const maxPan = Math.max(0, contentH - bodyViewportH);

  const gifW = slide.offsetWidth;
  const gifH = targetH;
  toast(`GIF-formaat: ${gifW}x${gifH} · pan: ${Math.round(maxPan)}px · snelheid: ${speed.label}`);
  let workerUrl = null;
  let gif = null;

  try {
    workerUrl = await gifWorkerUrl();
    assertWorkerUsable(workerUrl);

    gif = new GIF({
      workers: 2,
      quality: 9,
      width: gifW,
      height: gifH,
      workerScript: workerUrl
    });

    for (let i = 0; i < thresholds.length; i++) {
      const t = thresholds[i];
      cards.forEach(c => {
        const show = c.minute <= t + 1e-6;
        c.el.style.opacity = show ? '1' : '0';
        c.el.style.visibility = show ? 'visible' : 'hidden';
      });

      const progress = end > start ? (t - start) / (end - start) : 0;
      const pan = Math.round(maxPan * Math.max(0, Math.min(1, progress)));
      layer.style.transform = `translateY(${-pan}px)`;
      axis.style.transform = `translateY(${-pan}px)`;

      // Wacht 2 frames zodat de zichtbaarheid zeker in de canvasopname zit.
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      const frame = await html2canvas(slide, { scale: 1, backgroundColor: '#ffffff', useCORS: true, logging: false });
      const delay = (i === 0 || i === thresholds.length - 1) ? speed.edgeDelay : speed.stepDelay;
      gif.addFrame(frame, { copy: true, delay });
      setRecordingProgress((i + 1) / (thresholds.length + 1), `Frames ${i + 1}/${thresholds.length}`, 'GIF opname');
    }

    const blob = await new Promise((resolve, reject) => {
      let lastShown = -10;
      gif.on('progress', p => {
        const pct = Math.round(p * 100);
        if (pct >= lastShown + 10) lastShown = pct;
        const normalized = 0.72 + (Math.max(0, Math.min(1, p)) * 0.28);
        setRecordingProgress(normalized, `Renderen ${pct}%`, 'GIF renderen');
      });
      gif.on('finished', resolve);
      gif.on('abort', () => reject(new Error('GIF-render afgebroken.')));
      try {
        gif.render();
      } catch (err) {
        reject(new Error('GIF-render kon niet starten: ' + (err?.message || String(err))));
      }
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `reconstruct-playback-${new Date().toISOString().slice(0, 10)}.gif`;
    a.href = url;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('GIF gedownload.');
  } finally {
    if (workerUrl) URL.revokeObjectURL(workerUrl);
    cards.forEach(c => {
      c.el.style.opacity = c.prevOpacity;
      c.el.style.visibility = c.prevVisibility;
    });
    slide.style.height = prevSlideH;
    body.style.height = prevBodyH;
    body.style.overflow = prevBodyOverflow;
    layer.style.transform = prevLayerTransform;
    axis.style.transform = prevAxisTransform;
    setRecordingOverlay(false);
    document.body.classList.remove('exporting');
    wrap.style.transform = prev.t;
    wrap.style.width = prev.w;
    wrap.style.height = prev.h;
    applyZoom();
  }
}

async function downloadVideo() {
  if (!window.html2canvas) throw new Error('html2canvas ontbreekt.');
  if (!window.MediaRecorder) throw new Error('Video-export wordt niet ondersteund in deze browser.');

  const { start, end } = rangeMinutes();
  const items = visibleItems().filter(it => it.minutes >= start && it.minutes <= end);
  if (!items.length) throw new Error('Geen artikelen binnen het gekozen tijdvenster.');

  const wrap = $('#slideWrap');
  const slide = $('#slide');
  const layer = $('#cardLayer');
  const body = $('.slide-body', slide);
  const axis = $('.timeline-axis', slide);
  const head = $('#slideHead');
  const fmt = state.settings.format;
  const targetH = SLIDE_FORMATS[fmt]?.h || 1080;
  const cards = $$('.m3-card', layer).map(el => ({
    el,
    minute: parseFloat(el.dataset.minute || 'NaN'),
    prevOpacity: el.style.opacity,
    prevVisibility: el.style.visibility
  })).filter(c => Number.isFinite(c.minute));
  if (!cards.length) throw new Error('Geen zichtbare tegels om te exporteren.');

  const speed = videoSpeedProfile();
  const prev = { t: wrap.style.transform, w: wrap.style.width, h: wrap.style.height };
  const prevSlideH = slide.style.height;
  const prevBodyH = body.style.height;
  const prevBodyOverflow = body.style.overflow;
  const prevLayerTransform = layer.style.transform;
  const prevAxisTransform = axis.style.transform;
  wrap.style.transform = 'none';
  wrap.style.width = 'auto';
  wrap.style.height = 'auto';
  document.body.classList.add('exporting');
  setRecordingOverlay(true);
  setRecordingProgress(0, 'Voorbereiden', 'Video opname');

  const headH = head.hidden ? 0 : head.offsetHeight;
  const bodyViewportH = Math.max(220, targetH - PAD_TOP - PAD_BOTTOM - headH);
  slide.style.height = `${targetH}px`;
  body.style.height = `${bodyViewportH}px`;
  body.style.overflow = 'hidden';
  layer.style.transform = 'translateY(0px)';
  axis.style.transform = 'translateY(0px)';

  const contentH = layer.offsetHeight;
  const maxPan = Math.max(0, contentH - bodyViewportH);
  const itemMin = items[0].minutes;
  const itemMax = items[items.length - 1].minutes;
  const videoW = slide.offsetWidth;
  const videoH = targetH;

  try {
    const outCanvas = document.createElement('canvas');
    outCanvas.width = videoW;
    outCanvas.height = videoH;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) throw new Error('Canvas-context voor video ontbreekt.');

    const mimeType = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ].find(m => MediaRecorder.isTypeSupported(m));
    if (!mimeType) throw new Error('Deze browser ondersteunt geen WebM-opname.');

    const stream = outCanvas.captureStream(0);
    const videoTrack = stream.getVideoTracks()[0];
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };

    const totalFrames = speed.introFrames + speed.mainFrames + speed.outroFrames;
    const frameMs = Math.round(1000 / speed.frameRate);
    const startAt = performance.now();
    toast(`Video-formaat: ${videoW}x${videoH} · pan: ${Math.round(maxPan)}px · ${speed.modeLabel} / ${speed.label}`);
    recorder.start();

    for (let i = 0; i < totalFrames; i++) {
      let progress;
      if (i < speed.introFrames) progress = 0;
      else if (i < speed.introFrames + speed.mainFrames) {
        const idx = i - speed.introFrames;
        progress = speed.mainFrames <= 1 ? 1 : (idx / (speed.mainFrames - 1));
      } else progress = 1;

      const t = itemMin + ((itemMax - itemMin) * progress);

      cards.forEach(c => {
        const show = c.minute <= t + 1e-6;
        c.el.style.opacity = show ? '1' : '0';
        c.el.style.visibility = show ? 'visible' : 'hidden';
      });

      const p = Math.max(0, Math.min(1, progress));
      const eased = speed.easing === 'ease' ? easeInOutSine(p) : p;
      const pan = Math.round(maxPan * eased);
      layer.style.transform = `translateY(${-pan}px)`;
      axis.style.transform = `translateY(${-pan}px)`;

      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      const frame = await html2canvas(slide, { scale: 0.7, backgroundColor: '#ffffff', useCORS: true, logging: false });
      outCtx.fillStyle = '#ffffff';
      outCtx.fillRect(0, 0, videoW, videoH);
      outCtx.drawImage(frame, 0, 0, videoW, videoH);
      if (videoTrack && typeof videoTrack.requestFrame === 'function') videoTrack.requestFrame();
      setRecordingProgress((i + 1) / totalFrames, `Frames ${i + 1}/${totalFrames}`, 'Video opname');

      const nextAt = startAt + ((i + 1) * frameMs);
      const wait = Math.max(0, nextAt - performance.now());
      if (wait > 0) await new Promise(res => setTimeout(res, wait));
    }

    await new Promise((resolve, reject) => {
      recorder.onstop = resolve;
      recorder.onerror = () => reject(new Error('Video-opname is mislukt.'));
      recorder.stop();
    });

    const blob = new Blob(chunks, { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `reconstruct-playback-${new Date().toISOString().slice(0, 10)}.webm`;
    a.href = url;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Video gedownload (.webm).');
  } finally {
    cards.forEach(c => {
      c.el.style.opacity = c.prevOpacity;
      c.el.style.visibility = c.prevVisibility;
    });
    slide.style.height = prevSlideH;
    body.style.height = prevBodyH;
    body.style.overflow = prevBodyOverflow;
    layer.style.transform = prevLayerTransform;
    axis.style.transform = prevAxisTransform;
    setRecordingOverlay(false);
    document.body.classList.remove('exporting');
    wrap.style.transform = prev.t;
    wrap.style.width = prev.w;
    wrap.style.height = prev.h;
    applyZoom();
  }
}

/* ============================================================
   CSV-export: de data achter de huidige weergave
   ============================================================ */
let compareExport = null;

// puntkomma en decimale komma, zodat Excel (NL) het direct goed opent
function csvCell(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(Math.round(v * 1e4) / 1e4).replace('.', ',') : '';
  const s = String(v);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(name, header, rows) {
  const text = '\ufeff' + [header, ...rows].map(r => r.map(csvCell).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = `reconstruct-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(`${rows.length} rijen ge\u00ebxporteerd.`);
}

/** Vergelijking: de tabel; grafiek: per titel per uur; tijdlijn: alle posts met afgeleide kenmerken. */
function exportCsv() {
  const m = state.mapping, view = state.settings.view || 'timeline';
  if (view === 'table' || view === 'compare' || view === 'scatter') {
    if (!compareExport) return toast('Nog geen vergelijking om te exporteren.');
    return downloadCsv('vergelijking', compareExport.header, compareExport.rows);
  }
  const { start, end } = rangeMinutes();
  const items = visibleItems().filter(it => it.minutes >= start && it.minutes <= end);
  const titleOf = (r) => (m.brand ? r[m.brand] : '') || '';
  if (view === 'chart') {
    const hourOf = (t) => {
      const off = isAbsoluteMinutes(t) ? tzOffsetMinutes(NEWS_TZ, t * 60000) : 0;
      return Math.floor((t + off) / 60) * 60 - off;
    };
    const cells = new Map();
    const cell = (title, h) => {
      const k = `${title}|${h}`;
      if (!cells.has(k)) cells.set(k, { title, h, posts: 0, words: [], views: null, users: null });
      return cells.get(k);
    };
    items.forEach(it => {
      const c = cell(titleOf(it.row), hourOf(it.minutes));
      c.posts++;
      c.words.push(postWords(it.row));
    });
    reachRows().filter(r => r.t >= start && r.t < end).forEach(r => {
      const c = cell(r.title, hourOf(r.t));
      c.views = (c.views || 0) + (r.views || 0);
      c.users = (c.users || 0) + (r.users || 0);
    });
    const rows = [...cells.values()].sort((a, b) => a.title.localeCompare(b.title) || a.h - b.h).map(c => [
      c.title, timeInputLabel(c.h), c.posts, medianOf(c.words), c.views, c.users,
      c.views !== null && c.users ? c.views / c.users : null,
      c.views !== null && c.posts ? c.views / c.posts : null
    ]);
    return downloadCsv('per-uur', ['Titel', 'Uur', 'Posts', 'Woorden (mediaan)', 'Weergaven', 'Gebruikers', 'Weergaven per gebruiker', 'Weergaven per post'], rows);
  }
  const metrics = state.metrics.filter(mt => mt.column);
  const datasetOf = new Map((state.datasets || []).map(d => [d.id, d]));
  const last = new Map();
  const rows = items.map(it => {
    const r = it.row, title = titleOf(r), words = postWords(r);
    const prev = last.get(title);
    last.set(title, it.minutes);
    const d = datasetOf.get(r.__datasetId);
    const links = rowLinks(r);
    return [
      title, r.liveblog_titel || d?.label || '', d?.sourceUrl || (m.articleUrl ? r[m.articleUrl] : '') || '', r.update_nummer || '',
      timeInputLabel(it.minutes), m.title ? headOf(r) : '', m.body ? bodyOnly(r) : '',
      words, lengthClass(words), (sl => sl.length ? Math.round(10 * sl.reduce((a, b) => a + b, 0) / sl.length) / 10 : null)(sentenceLengths(r)),
      mediaCategory(r, m.image) || 'geen',
      m.image && isHttpUrl(r[m.image]) ? r[m.image] : '', isVideoRow(r) ? 'ja' : '', socialOf(r), isDatavizRow(r) ? 'ja' : '',
      links.length, links.join(' '), { premium: 'eigen premium', own: 'eigen', external: 'uitgaand' }[linkInfo(r).cls] || '',
      isLinkPremiumRow(r) ? 'ja' : '', m.premium && isPremium(r[m.premium]) ? 'ja' : '',
      prev === undefined ? null : it.minutes - prev, r.blokken || '', r.embed_bronnen || '',
      ...metrics.map(mt => parseNumber(r[mt.column]))
    ];
  });
  downloadCsv('posts', ['Titel', 'Liveblog', 'Liveblog-URL', 'Postnummer', 'Tijd', 'Kop', 'Tekst', 'Woorden', 'Lengte', 'Woorden per zin', 'Media',
    'Foto-URL', 'Video', 'Social', 'Datavisualisatie', 'Aantal links', 'Links', 'Soort link', 'Link naar premium', 'Premium',
    'Minuten sinds vorige', 'Blokken', 'Embed-bronnen', ...metrics.map(mt => mt.label || mt.column)], rows);
}

/* ============================================================
   Opslag in de browser
   ============================================================ */
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    // volledige pagina-HTML (plakken/extensie) kan groter zijn dan de opslaglimiet; dan alleen de verwerkte rijen bewaren
    const raw = String(state.raw || '');
    const snapshot = raw.length > 200000 ? { ...state, raw: '' } : state;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)); } catch {
      toast('De opslag van de browser is vol: wijzigingen worden niet bewaard. Verwijder een dataset die je niet meer nodig hebt.');
    }
  }, 400);
}
function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
      || LEGACY_STORAGE_KEYS.map(k => localStorage.getItem(k)).find(Boolean);
    if (!raw) return;
    applyState(JSON.parse(raw));
  } catch { /* begin schoon */ }
}

/** Zet een opgeslagen of gedeelde toestand terug, met de opschoning voor oudere versies. */
function applyState(parsed) {
  state = Object.assign(defaultState(), parsed);
  state.settings = Object.assign(defaultState().settings, parsed.settings || {});
  state.mapping = Object.assign(defaultState().mapping, parsed.mapping || {});
  if (!Array.isArray(state.rows)) state.rows = [];
  if (!Array.isArray(state.headers)) state.headers = [];
  if (!Array.isArray(state.metrics)) state.metrics = [];
  if (!Array.isArray(state.removed)) state.removed = [];
  // een vroeger handmatig ingesteld venster bestaat niet meer: terug naar hele dagen of compact
  if (!state.settings.autoFit && !(state.settings.periodFrom || state.settings.periodTo)) state.settings.autoFit = true;
  if (!Array.isArray(state.datasets)) state.datasets = [];
  state.datasets.forEach(d => { if (!isHttpUrl(d.sourceUrl)) d.sourceUrl = ''; });
  // titels worden alleen nog via hun dataset aan- en uitgezet
  state.hiddenTitles = [];
  if (!['modern', 'compact'].includes(state.settings.cardStyle)) state.settings.cardStyle = 'modern';
  // vroeger zaten de vergelijkingsgrafieken onder de tabelknop
  if (state.settings.view === 'table' && state.settings.compareShow && state.settings.compareShow !== 'table') state.settings.view = 'compare';
  if (state.settings.view === 'text') Object.assign(state.settings, { view: 'table', tableShow: 'speed' });
  if (!state.datasets.length && state.rows.length) {
    const legacyId = crypto.randomUUID();
    state.datasets = [{ id: legacyId, label: 'Data', kind: 'table', rowCount: state.rows.length, active: true }];
    state.rows = state.rows.map((r, idx) => ({ ...r, __id: idx, __datasetId: legacyId }));
  }
  // alleen kleuren als hexcode; logo's worden hieronder opnieuw afgeleid
  const brands = {};
  Object.entries(state.brands || {}).forEach(([name, b]) => {
    if (/^#[0-9a-f]{3,8}$/i.test(String(b?.color || ''))) brands[name] = { color: b.color };
  });
  state.brands = brands;
  $('#pasteArea').value = state.raw || '';
  // eerder ingelezen placeholders alsnog als datavisualisatie herkennen
  fixPlaceholderMedia(state.rows);
  mergeDuplicateDatasets();
  dedupeRows();
  if (state.rows.some(r => r.dataviz) && !state.headers.includes('dataviz')) state.headers.push('dataviz');
  // Vult ontbrekende koppelingen (zoals een nieuw toegevoegd veld) aan voor sessies van vóór die toevoeging.
  if (state.headers.length) autoMap();
  else rebuildBrands();
}

/* ============================================================
   Hulpjes
   ============================================================ */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escAttr = esc;

let toastTimer;
let suppressToast = false;
function toast(msg) {
  if (suppressToast) return;
  const el = $('#snackbar');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

function setRecordingOverlay(on) {
  const el = $('#recordingOverlay');
  suppressToast = !!on;
  const snack = $('#snackbar');
  if (on && snack) {
    snack.classList.remove('show');
    clearTimeout(toastTimer);
  }
  if (!el) return;
  el.hidden = !on;
}

function setRecordingProgress(progress, label, title) {
  const p = Math.max(0, Math.min(1, Number(progress) || 0));
  const bar = $('#recordingProgressBar');
  const meta = $('#recordingMeta');
  const ttl = $('#recordingTitle');
  if (bar) bar.style.width = `${Math.round(p * 100)}%`;
  if (meta) meta.textContent = `${Math.round(p * 100)}%${label ? ` · ${label}` : ''}`;
  if (ttl && title) ttl.textContent = title;
}

/** Derde weergave: per liveblog de belangrijkste kengetallen naast elkaar, binnen het gekozen tijdvenster. */
function renderTable() {
  const s = state.settings, m = state.mapping;
  const { start, end } = rangeMinutes();
  // strikt binnen de gekozen periode: dan eindigt het venster op de grens van de volgende dag
  const inEnd = periodBounds() ? (t) => t < end : (t) => t <= end;
  const items = visibleItems().filter(it => it.minutes >= start && inEnd(it.minutes));
  const view = $('#tableView');
  $('#slideBody').hidden = true;
  $('#chartView').hidden = true;
  view.hidden = false;
  view.innerHTML = '';
  updateStatusStrip(computeStatusCounts(start, end), 0);
  $('#removedCount').textContent = state.removed.length;
  $('#btnRestore').hidden = !state.removed.length;

  // per titel (merk), over alle actieve datasets heen; zonder merkkolom per dataset
  const groupMap = new Map();
  const keyOf = (it) => m.brand ? (it.row[m.brand] || '\u2014') : (state.datasets.find(d => d.id === it.row.__datasetId)?.label || 'Data');
  items.forEach(it => {
    const key = keyOf(it);
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key).push(it);
  });
  const groups = [...groupMap].map(([key, list]) => ({ key, items: list }));
  const counts = [`${groups.length} titel${groups.length === 1 ? '' : 's'}`, `${items.length} posts`];
  const axis = TABLE_AXES[s.tableShow] ? s.tableShow : 'speed';
  setSlideHead(s.view === 'table' ? axisTitle(axis) : `${itemNoun(items)} in cijfers`, [periodText(start, end), ...counts]);

  const fixedH = STAT_FORMAT_H;
  const ready = !!(m.time && groups.length);
  $('#emptyState').hidden = ready;
  $('#previewInfo').textContent = `${groups.length} titel${groups.length === 1 ? '' : 's'} vergeleken`;
  if (!ready) {
    $('#emptyText').textContent = !state.rows.length ? 'Voeg data toe in het Data-blok' : 'Geen posts binnen de gekozen periode';
    $('#slide').style.height = fixedH ? fixedH + 'px' : '';
    applyZoom();
    return;
  }

  const pct = (n, total) => total ? n / total : null;
  const median = (arr) => {
    if (!arr.length) return null;
    const a = [...arr].sort((x, y) => x - y), mid = a.length >> 1;
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  };
  const statsOf = (list) => {
    const rows = list.map(it => it.row);
    const times = list.map(it => it.minutes).sort((a, b) => a - b);
    const links = rows.map(linkInfo);
    const words = rows.map(postWords);
    const lengths = words.map(lengthClass);
    const { activeMinutes, gaps: sessionGaps } = rhythmOf(times);
    const metricStats = {};
    state.metrics.filter(mt => mt.column).forEach(mt => {
      const vals = rows.map(r => parseNumber(r[mt.column])).filter(v => v !== null);
      metricStats[`m_${mt.id}_sum`] = vals.length && mt.format !== 'percent' ? vals.reduce((a, b) => a + b, 0) : null;
      metricStats[`m_${mt.id}_avg`] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      metricStats[`m_${mt.id}_med`] = median(vals);
    });
    // elke post precies één mediarubriek, zodat foto + video + social + geen samen 100% is
    const cats = rows.map(r => mediaCategory(r, m.image));
    const share = (cat) => pct(cats.filter(c => c === cat).length, rows.length);
    const linkCount = (cls) => links.filter(l => l.cls === cls).length;
    return {
      n: rows.length,
      first: times[0],
      last: times[times.length - 1],
      // frequentie: posts per uur actieve tijd (pauzes > 2 uur tellen niet mee)
      perHour: activeMinutes >= 30 ? rows.length / (activeMinutes / 60) : null,
      regularity: regularityScore(sessionGaps),
      maxGap: sessionGaps.length ? Math.max(...sessionGaps) : null,
      medianWords: median(words),
      noText: m.body ? pct(rows.filter(r => !bodyOnly(r)).length, rows.length) : null,
      stackLength: {
        kort: lengths.filter(l => l === 'kort').length,
        middel: lengths.filter(l => l === 'middel').length,
        lang: lengths.filter(l => l === 'lang').length
      },
      image: m.image ? share('foto') : null,
      link: m.link ? pct(links.filter(l => l.own).length, rows.length) : null,
      premium: m.link && m.linkPremium ? pct(linkCount('premium'), rows.length) : null,
      external: m.link ? pct(links.filter(l => l.external).length, rows.length) : null,
      video: m.video ? share('video') : null,
      social: m.social ? share('social') : null,
      dataviz: m.dataviz ? share('dataviz') : null,
      media: m.image || m.video || m.social || m.dataviz ? 1 - share('') : null,
      stackLinks: {
        premium: linkCount('premium'),
        own: linkCount('own'),
        external: linkCount('external'),
        none: linkCount('')
      },
      stackMedia: {
        video: cats.filter(c => c === 'video').length,
        dataviz: cats.filter(c => c === 'dataviz').length,
        social: cats.filter(c => c === 'social').length,
        photo: cats.filter(c => c === 'foto').length,
        none: cats.filter(c => c === '').length
      },
      ...textStats(rows),
      ...metricStats
    };
  };

  const fmtPct = (v) => v === null ? '\u2013' : `${Math.round(v * 100)}%`;
  const fmtDur = (v) => {
    if (v === null) return '\u2013';
    const min = Math.round(v);
    return min < 60 ? `${min} min` : `${Math.floor(min / 60)}u${String(min % 60).padStart(2, '0')}`;
  };
  const fmtNum = (v) => v === null ? '\u2013' : String(Math.round(v));
  const fmtDec = (v) => v === null || v === undefined ? '\u2013' : v.toFixed(1).replace('.', ',');
  // better: welke kant 'beter' is, om de koploper per kolom te markeren
  const COLS = [
    { key: 'n', label: 'Posts', fmt: (v) => String(v), better: 'high' },
    { key: 'perHour', label: 'Frequentie (per actief uur)', fmt: (v) => v === null ? '\u2013' : v.toFixed(1).replace('.', ','), better: 'high' },
    { key: 'regularity', label: 'Regelmaat (0\u2013100)', fmt: fmtNum, better: 'high' },
    { key: 'maxGap', label: 'Langste stilte', fmt: fmtDur, better: 'low' },
    { key: 'medianWords', label: 'Woorden (mediaan)', fmt: fmtNum, better: null },
    { key: 'noText', label: 'Zonder tekst', fmt: fmtPct, better: null },
    { key: 'image', label: 'Met foto', fmt: fmtPct, better: 'high' },
    { key: 'video', label: 'Met video', fmt: fmtPct, better: 'high' },
    { key: 'social', label: 'Met social embed', fmt: fmtPct, better: 'high' },
    { key: 'dataviz', label: 'Met datavisualisatie', fmt: fmtPct, better: 'high' },
    { key: 'media', label: 'Met media', fmt: fmtPct, better: 'high' },
    { key: 'link', label: 'Met eigen link', fmt: fmtPct, better: 'high' },
    { key: 'premium', label: 'Met premium-link', fmt: fmtPct, better: null },
    { key: 'external', label: 'Met uitgaande link', fmt: fmtPct, better: null },
    { key: 'firstShare', label: 'Als eerste bij gedeeld nieuws', fmt: fmtPct, better: 'high' },
    { key: 'coverShare', label: 'Gedeeld nieuws gebracht', fmt: fmtPct, better: 'high' },
    { key: 'lag', label: 'Achterstand (mediaan)', fmt: fmtDur, better: 'low' },
    { key: 'headQuote', label: 'Citaat in de kop', fmt: fmtPct, better: null },
    { key: 'statements', label: 'Zinnen met een uitspraak', fmt: fmtPct, better: null },
    { key: 'sourced', label: 'Met bronvermelding', fmt: fmtPct, better: 'high' },
    { key: 'urgency', label: 'Urgentietaal (per 1.000 woorden)', fmt: fmtDec, better: null },
    { key: 'ownAngle', label: 'Eigen land (per 1.000 woorden)', fmt: fmtDec, better: null }
  ];
  // cijfers per titel: totaal, gemiddelde en mediaan per artikel
  state.metrics.filter(mt => mt.column).forEach(mt => {
    const name = mt.label || mt.column;
    const fmtMetric = (whole) => (v) => v === null ? '\u2013'
      : formatValue(String(v), mt.format === 'raw' ? 'number' : mt.format, { roundWhole: whole });
    COLS.push(
      { key: `m_${mt.id}_sum`, label: `${name} totaal`, chartTitle: `${name}, totaal`, fmt: fmtMetric(true), better: 'high' },
      { key: `m_${mt.id}_avg`, label: `${name} gem.`, chartTitle: `${name}, gemiddeld`, fmt: fmtMetric(false), better: 'high' },
      { key: `m_${mt.id}_med`, label: `${name} mediaan`, chartTitle: `${name}, mediaan`, fmt: fmtMetric(false), better: 'high' }
    );
  });

  // overal dezelfde volgorde: meeste updates eerst
  const rowsData = groups.map(g => {
    const title = m.brand ? g.key : '';
    return { title, label: g.key, stats: statsOf(g.items) };
  }).sort((a, b) => b.stats.n - a.stats.n);
  // gedeelde nieuwsmomenten: alleen zinvol met minstens twee titels
  const shared = groups.length > 1 && m.title ? sharedMoments(items, keyOf) : null;
  rowsData.forEach(r => {
    const p = shared?.per.get(r.label) || { first: 0, follow: 0, lags: [] };
    const ok = !!shared?.moments;
    Object.assign(r.stats, {
      firstShare: ok ? p.first / shared.moments : null,
      coverShare: ok ? (p.first + p.follow) / shared.moments : null,
      // snelheid los van dekking: mediaan over de momenten die de titel bracht
      lag: ok ? medianOf(shared.list.filter(mo => mo.who.has(r.label)).map(mo => mo.who.get(r.label))) : null
    });
  });
  // bereik per titel binnen hetzelfde venster; zonder uurdata de totaalcijfers (dan niet aan een periode gebonden)
  const reachIn = reachRows().filter(r => r.t >= start && inEnd(r.t));
  const totals = reachTotals(), totalCols = reachTotalCols();
  const wholePeriod = !s.periodFrom && !s.periodTo;
  rowsData.forEach(r => {
    const list = reachIn.filter(x => x.title === r.title);
    const sum = (k) => list.some(x => x[k] !== null) ? list.reduce((a, x) => a + (x[k] || 0), 0) : null;
    let views = sum('views'), users = sum('users');
    const tot = totals.get(r.title);
    const hourly = views !== null || users !== null;
    if (!hourly && tot) { views = tot.views; users = tot.users; }
    Object.assign(r.stats, {
      reachViews: views,
      reachUsers: users,
      reachVpu: views !== null && users ? views / users : null,
      viewsPerPost: views !== null && r.stats.n && (hourly || wholePeriod) ? views / r.stats.n : null
    });
    totalCols.forEach(c => { r.stats[c.key] = tot?.other[c.header] ?? null; });
  });
  const fmtBig = (v) => v === null ? '\u2013' : sig3(v);
  COLS.push(
    { key: 'reachViews', label: 'Weergaven', fmt: fmtBig, better: 'high', reach: true },
    { key: 'reachUsers', label: 'Gebruikers', fmt: fmtBig, better: 'high', reach: true },
    { key: 'reachVpu', label: 'Weergaven per gebruiker', fmt: fmtBig, better: 'high', reach: true },
    { key: 'viewsPerPost', label: 'Weergaven per update', fmt: fmtBig, better: 'high', reach: true },
    ...totalCols.map(c => ({ key: c.key, label: c.header, chartTitle: c.header, fmt: fmtBig, better: 'high', reach: true }))
  );
  const cols = COLS.filter(c => rowsData.some(r => r.stats[c.key] !== null));
  compareExport = {
    header: ['Titel', ...cols.map(c => c.fmt === fmtPct ? `${c.label} (%)` : c.label)],
    rows: rowsData.map(r => [r.title || r.label, ...cols.map(c => {
      const v = r.stats[c.key];
      return v !== null && c.fmt === fmtPct ? v * 100 : v;
    })])
  };
  // in elke kolom de hoogste waarde markeren
  const best = {};
  if (rowsData.length > 1) {
    cols.forEach(c => {
      const vals = rowsData.map(r => r.stats[c.key]).filter(v => v !== null);
      if (vals.length > 1 && Math.max(...vals) > Math.min(...vals)) best[c.key] = Math.max(...vals);
    });
  }

  // keuze tussen tabel en grafieken; opties volgen de beschikbare kengetallen
  const STACKS = {
    'stack-links': {
      label: 'Links',
      key: 'stackLinks',
      parts: [['premium', 'Eigen premium-artikel', CAT.premium], ['own', 'Eigen artikel', CAT.link], ['external', 'Uitgaande link', CAT.external], ['none', 'Zonder link', CAT.none]]
    },
    'stack-media': {
      label: 'Media',
      key: 'stackMedia',
      parts: [['video', 'Video', CAT.video], ['dataviz', 'Datavisualisatie', CAT.dataviz], ['social', 'Social embed', CAT.social], ['photo', 'Foto', CAT.photo], ['none', 'Geen media', CAT.none]]
    },
    'stack-length': {
      label: 'Lengte',
      key: 'stackLength',
      parts: LENGTH_CLASSES.map(([k, label]) => [k, label, CAT[k]])
    }
  };
  // korte, neutrale grafiektitels
  const CHART_TITLES = {
    n: 'Posts', perHour: 'Frequentie (posts per actief uur)', regularity: 'Regelmaat (0\u2013100)',
    maxGap: 'Langste stilte', medianWords: 'Woorden per post (mediaan)', noText: 'Aandeel posts zonder tekst',
    image: 'Aandeel met foto', video: 'Aandeel met video', social: 'Aandeel met social embed', dataviz: 'Aandeel met datavisualisatie',
    media: 'Aandeel met media', link: 'Aandeel met eigen link', premium: 'Aandeel met premium-link',
    external: 'Aandeel met uitgaande link',
    firstShare: 'Als eerste bij gedeeld nieuws', coverShare: 'Gedeeld nieuws gebracht', lag: 'Achterstand bij gebracht nieuws (mediaan)',
    headQuote: 'Aandeel koppen met citaat',
    statements: 'Aandeel zinnen met een uitspraak', sourced: 'Aandeel posts met bronvermelding',
    urgency: 'Urgentietaal per 1.000 woorden', ownAngle: 'Eigen land per 1.000 woorden',
    reachViews: 'Weergaven', reachUsers: 'Gebruikers', reachVpu: 'Weergaven per gebruiker', viewsPerPost: 'Weergaven per update'
  };
  const chartTitleOf = (c) => CHART_TITLES[c.key] || c.chartTitle;
  const chartCols = cols.filter(chartTitleOf);
  // gestapelde grafieken alleen als de data er is
  const availableStacks = Object.entries(STACKS).filter(([k]) => k === 'stack-links' ? !!m.link
    : k === 'stack-media' ? !!(m.image || m.video || m.social || m.dataviz) : true);
  const chartOptions = availableStacks.map(([k, st]) => [k, `${st.label} per titel`])
    .concat(chartCols.map(c => [c.key, `${chartTitleOf(c)} per titel`]));
  const optionHtml = optgroups(chartOptions);
  const showSel = $('#compareShow'), show2Sel = $('#compareShow2');
  showSel.innerHTML = optionHtml;
  show2Sel.innerHTML = '<option value="">\u2014 geen \u2014</option>' + optionHtml;
  const show = s.view !== 'compare' ? 'table'
    : [...showSel.options].some(o => o.value === s.compareShow) ? s.compareShow : (chartOptions[0]?.[0] || 'table');
  const show2 = show !== 'table' && [...show2Sel.options].some(o => o.value === s.compareShow2) ? s.compareShow2 : '';
  showSel.value = show;
  show2Sel.value = show2;
  $('#compareShow2Field').hidden = show === 'table';

  if (s.view === 'scatter') {
    const has = (k) => chartCols.some(c => c.key === k);
    const xKey = has(s.scatterX) ? s.scatterX : has('perHour') ? 'perHour' : chartCols[0]?.key;
    // standaard een prestatiemaat op de y-as als er bereikdata is
    const yKey = has(s.scatterY) && s.scatterY !== xKey ? s.scatterY
      : ['viewsPerPost', 'reachVpu', 'medianWords'].find(k => has(k) && k !== xKey) || chartCols.find(c => c.key !== xKey)?.key;
    const opts = optgroups(chartCols.map(c => [c.key, chartTitleOf(c)]));
    $('#scatterX').innerHTML = opts;
    $('#scatterY').innerHTML = opts;
    $('#scatterX').value = xKey || '';
    $('#scatterY').value = yKey || '';
    setSlideHead(`${itemNoun(items)} vergeleken`, [periodText(start, end), ...counts]);
    $('#previewInfo').textContent = `${groups.length} titel${groups.length === 1 ? '' : 's'} in spreidingsdiagram`;
    const headH = $('#slideHead').hidden ? 0 : $('#slideHead').offsetHeight;
    const H = Math.max(320, fixedH - PAD_TOP - PAD_BOTTOM - headH - 24);
    const cx = chartCols.find(c => c.key === xKey), cy = chartCols.find(c => c.key === yKey);
    view.innerHTML = cx && cy ? compareScatterHtml(rowsData, cx, cy, chartTitleOf(cx), chartTitleOf(cy), H) : '';
    $('#slide').style.height = fixedH + 'px';
    applyZoom();
    $('#sizeHint').textContent = `Afbeelding wordt ${SLIDE_W} \u00d7 ${Math.round($('#slide').offsetHeight)} px`;
    return;
  }

  if (show !== 'table') {
    const spec = (key) => ({
      stack: STACKS[key],
      col: chartCols.find(c => c.key === key),
      title: STACKS[key] ? `${STACKS[key].label} per titel` : `${chartTitleOf(chartCols.find(c => c.key === key))} per titel`,
      explain: explainOf(key)
    });
    const charts = [spec(show), ...(show2 ? [spec(show2)] : [])];
    // één grafiek: titel en uitleg bovenaan de slide; twee grafieken: elk een eigen kop met uitleg
    // vaste kop met periode en aantallen; elke grafiek houdt zijn eigen paneeltitel
    setSlideHead(`${itemNoun(items)} vergeleken`, [periodText(start, end), ...counts]);
    $('#previewInfo').textContent = `${groups.length} titel${groups.length === 1 ? '' : 's'} in grafiek`;
    const headH = $('#slideHead').hidden ? 0 : $('#slideHead').offsetHeight;
    const H = Math.max(320, fixedH - PAD_TOP - PAD_BOTTOM - headH - 24);
    view.innerHTML = `<div class="compare-charts${charts.length > 1 ? ' duo' : ''}" style="height:${H}px">
      ${charts.map(c => compareChartHtml(rowsData, c.stack, c.col, c.title)).join('')}
    </div>`;
    $('#slide').style.height = fixedH + 'px';
    applyZoom();
    $('#sizeHint').textContent = `Afbeelding wordt ${SLIDE_W} \u00d7 ${Math.round($('#slide').offsetHeight)} px`;
    return;
  }

  // drie tabellen zonder overlap; bereik staat alleen in vergelijking, spreiding en CSV; eigen cijfers bij snelheid
  const tcols = cols.filter(c => TABLE_AXES[axis].keys.includes(c.key) || (axis === 'speed' && /^m_/.test(c.key)))
    .sort((a, b) => (/^m_/.test(a.key) ? 999 : axisRank(a.key)) - (/^m_/.test(b.key) ? 999 : axisRank(b.key)));
  // korte kolomnamen in één stijl; de volledige uitleg staat in de tooltip
  const TABLE_HEAD = {
    n: 'Posts', perHour: 'Frequentie', regularity: 'Regelmaat', maxGap: 'Langste stilte',
    medianWords: 'Woorden', noText: 'Zonder tekst', image: 'Foto', video: 'Video', social: 'Social', dataviz: 'Visualisatie',
    link: 'Eigen link', premium: 'Premium-link', external: 'Uitgaand',
    firstShare: 'Als eerste', coverShare: 'Gebracht', lag: 'Achterstand', headQuote: 'Citaatkop',
    statements: 'Uitspraken', sourced: 'Bron', urgency: 'Urgentie', ownAngle: 'Eigen land'
  };
  const headOf = (c) => {
    const metric = c.key.match(/^m_(.+)_(sum|avg|med)$/);
    if (metric) {
      const mt = state.metrics.find(x => x.id === metric[1]);
      return `${mt?.label || mt?.column || c.label} ${{ sum: 'totaal', avg: 'gem.', med: 'mediaan' }[metric[2]]}`;
    }
    return TABLE_HEAD[c.key] || c.label;
  };
  const tcell = (stats, c) => {
    const v = stats[c.key];
    const isBest = v !== null && best[c.key] !== undefined && v === best[c.key];
    return `<td class="${isBest ? 'best' : ''}"><span>${esc(c.fmt(v))}</span></td>`;
  };
  view.innerHTML = `
    <table class="compare-table">
      <thead><tr><th class="name">Titel</th>${tcols.map(c => `<th title="${escAttr(explainOf(c.key))}">${esc(headOf(c))}</th>`).join('')}</tr></thead>
      <tbody>
        ${rowsData.map(r => `<tr>
          <th class="name" scope="row">
            <span class="name-wrap">${titleIconHtml(r.title, 'table-logo')}<b>${esc(r.title || r.label)}</b></span>
          </th>
          ${tcols.map(c => tcell(r.stats, c)).join('')}
        </tr>`).join('')}
      </tbody>
    </table>`;

  $('#slide').style.height = fixedH ? fixedH + 'px' : '';
  applyZoom();
  $('#sizeHint').textContent = `Afbeelding wordt ${SLIDE_W} \u00d7 ${Math.round($('#slide').offsetHeight)} px`;
}

// grafiekkleuren: rustige M3-tonen i.p.v. merkkleuren (de favicon in de legenda koppelt kleur aan titel)
const TABLE_AXES = {
  speed: { label: 'Snelheid en ritme', title: () => 'Snelheid en ritme per titel',
    keys: ['n', 'perHour', 'regularity', 'maxGap', 'firstShare', 'coverShare', 'lag'] },
  form: { label: 'Vorm', title: (noun) => `Vorm van de ${noun}`, keys: ['medianWords', 'noText', 'media', 'image', 'video', 'social', 'dataviz'] },
  content: { label: 'Inhoud', title: (noun) => `Inhoud van de ${noun}`,
    keys: ['sourced', 'statements', 'headQuote', 'urgency', 'ownAngle', 'link', 'premium', 'external'] }
};
const axisTitle = (axis) => TABLE_AXES[axis].title(itemNoun().toLowerCase());
const STACK_AXIS = { 'stack-length': 'form', 'stack-media': 'form', 'stack-links': 'content' };
// volgorde binnen een as: gestapelde grafiek eerst, dan de kengetallen zoals in de tabel
const axisRank = (k) => {
  const axis = STACK_AXIS[k] || Object.keys(TABLE_AXES).find(a => TABLE_AXES[a].keys.includes(k));
  return axis ? (STACK_AXIS[k] ? -1 : TABLE_AXES[axis].keys.indexOf(k)) : 0;
};
/** Keuzelijst gegroepeerd per as; bereik en eigen cijfers apart. */
function optgroups(options) {
  const groupOf = (k) => {
    const axis = STACK_AXIS[k] || Object.keys(TABLE_AXES).find(a => TABLE_AXES[a].keys.includes(k));
    return axis ? TABLE_AXES[axis].label : /^reach|^viewsPerPost$/.test(k) ? 'Bereik' : 'Cijfers';
  };
  const order = [...Object.values(TABLE_AXES).map(a => a.label), 'Bereik', 'Cijfers'];
  return order.map(g => {
    const opts = options.filter(([k]) => groupOf(k) === g).sort(([a], [b]) => axisRank(a) - axisRank(b));
    return opts.length ? `<optgroup label="${escAttr(g)}">${opts.map(([k, label]) => `<option value="${k}">${esc(label)}</option>`).join('')}</optgroup>` : '';
  }).join('');
}
const M3_SERIES = ['#6750A4', '#7D5260', '#625B71', '#B69DF8', '#E8A6B9', '#A8A0BC', '#4F378B', '#633B4B'];
// één vaste kleur per categorie, in elke grafiek dezelfde; 'geen' is M3 outline-variant
const CAT = {
  premium: '#8C5000', link: '#6750A4', external: '#006A6A', none: '#CAC4D0',
  video: '#B3261E', dataviz: '#C26100', social: '#0B57D0', photo: '#146C2E',
  kort: '#B69DF8', middel: '#6750A4', lang: '#21005D'
};

/** Staafgrafiek per titel: gestapeld (stack) of één kengetal (col), als HTML zodat favicons gewoon meegaan in de export. */
function compareChartHtml(rowsInput, stack, col, title) {
  // media en links: grootste categorie onderaan en eerst in de legenda; 'geen' altijd als laatste
  if (stack && stack.key !== 'stackLength') {
    const sumOf = (k) => rowsInput.reduce((acc, r) => acc + (r.stats[stack.key][k] || 0), 0);
    stack = { ...stack, parts: [...stack.parts].sort((a, b) => (a[0] === 'none') - (b[0] === 'none') || sumOf(b[0]) - sumOf(a[0])) };
  }
  const valueOf = (r) => stack
    ? stack.parts.reduce((sum, [k]) => sum + (r.stats[stack.key][k] || 0), 0)
    : (r.stats[col.key] ?? 0);
  // volgorde zoals de tabel: meeste updates eerst; bij bereikdata alleen de titels waarvoor die data bestaat
  const rowsData = col?.reach ? rowsInput.filter(r => r.stats[col.key] !== null) : rowsInput;
  const values = rowsData.map(valueOf);
  const maxVal = Math.max(...values, 0) || 1;
  const raw = maxVal / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(f => f * mag).find(v => raw <= v) || 10 * mag;
  const yMax = Math.ceil(maxVal / step) * step;
  const fmtTick = stack ? (v) => String(Math.round(v)) : col.fmt;
  const ticks = [];
  for (let v = 0; v <= yMax + step / 2; v += step) ticks.push(v);

  // titels die vaker voorkomen krijgen de naam van de liveblog erbij
  const titleCount = new Map();
  rowsData.forEach(r => titleCount.set(r.title, (titleCount.get(r.title) || 0) + 1));
  const n = rowsData.length;
  const barW = `min(${(100 / n) * 0.42}%, 56px)`;

  // titel en legenda altijd als (eventueel lege) rij, zodat twee grafieken naast elkaar hetzelfde kader hebben
  const legend = `<div class="cc-legend">${stack ? stack.parts.map(([k, label, color]) => {
    const sum = rowsData.reduce((acc, r) => acc + (r.stats[stack.key][k] || 0), 0);
    return `<span class="chart-legend-item"><i style="background:${color}"></i>${esc(label)} <b>${sum}</b></span>`;
  }).join('') : ''}</div>`;

  const bars = rowsData.map((r, i) => {
    const center = ((i + 0.5) / n) * 100;
    const style = `left:${center}%;width:${barW}`;
    const total = values[i];
    if (!total) return '';
    const segs = stack
      ? stack.parts.map(([k, label, color]) => {
        const v = r.stats[stack.key][k] || 0;
        return v ? `<div class="cc-seg" style="height:${(v / total) * 100}%;background:${color}" title="${escAttr(`${label}: ${v}`)}"></div>` : '';
      }).join('')
      : `<div class="cc-seg" style="height:100%;background:${M3_SERIES[0]}" title="${escAttr(col.fmt(total))}"></div>`;
    return `<div class="cc-bar" style="${style}"><div class="cc-stack" style="height:${(total / yMax) * 100}%">${segs}</div></div>`;
  }).join('');

  const labels = rowsData.map((r, i) => {
    const center = ((i + 0.5) / n) * 100;
    const sub = titleCount.get(r.title) > 1 ? `<small>${esc(clipText(r.label, 40))}</small>` : '';
    return `<div class="cc-label" style="left:${center}%;width:${(100 / n) * 0.95}%">${titleIconHtml(r.title, 'cc-logo')}<b>${esc(r.title || r.label)}</b>${sub}</div>`;
  }).join('');

  const grid = ticks.map(v => `
    <div class="cc-grid${v === 0 ? ' zero' : ''}" style="bottom:${(v / yMax) * 100}%"></div>
    <div class="cc-tick" style="bottom:${(v / yMax) * 100}%">${esc(fmtTick(v))}</div>`).join('');

  return `
    <div class="compare-chart">
      <h3 class="cc-title">${esc(title || '')}</h3>
      ${legend}
      <div class="cc-plot">${grid}${bars}</div>
      <div class="cc-labels">${labels}</div>
    </div>`;
}

/** Spreidingsdiagram per titel: x en y zijn twee kengetallen, bolgrootte = aantal posts. */
function compareScatterHtml(rowsInput, colX, colY, titleX, titleY, H) {
  const rows = rowsInput.filter(r => r.stats[colX.key] !== null && r.stats[colX.key] !== undefined && r.stats[colY.key] !== null && r.stats[colY.key] !== undefined);
  const scale = (vals) => {
    const maxVal = Math.max(...vals, 0) * 1.08 || 1;
    const raw = maxVal / 5, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(f => f * mag).find(v => raw <= v) || 10 * mag;
    const max = Math.ceil(maxVal / step) * step;
    const ticks = [];
    for (let v = 0; v <= max + step / 2; v += step) ticks.push(v);
    return { max, ticks };
  };
  const sx = scale(rows.map(r => r.stats[colX.key])), sy = scale(rows.map(r => r.stats[colY.key]));
  const nMax = Math.max(...rows.map(r => r.stats.n), 1);
  // plotmaat in pixels voor het plaatsen van labels zonder overlap
  const W = SLIDE_W - 2 * PAD_X - 220, PH = H - 150;
  const pts = rows.map(r => {
    const size = 46 + 34 * Math.sqrt(r.stats.n / nMax);
    return { r, size, x: W * r.stats[colX.key] / sx.max, y: PH * r.stats[colY.key] / sy.max };
  }).sort((a, b) => b.size - a.size);
  const hit = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  const placed = [];
  const bubbles = pts.map(p => [p.x - p.size / 2, p.y - p.size / 2, p.x + p.size / 2, p.y + p.size / 2]);
  const labels = pts.map((p, i) => {
    const name = p.r.title || p.r.label, w = 11 * name.length + 10, h = 28, g = p.size / 2 + 8;
    const opts = [['r', p.x + g, p.y - h / 2], ['l', p.x - g - w, p.y - h / 2], ['t', p.x - w / 2, p.y + g], ['b', p.x - w / 2, p.y - g - h]]
      .map(([side, x0, y0]) => ({ side, box: [x0, y0, x0 + w, y0 + h] }));
    const pick = opts.find(o => !placed.some(b => hit(o.box, b)) && !bubbles.some((b, j) => j !== i && hit(o.box, b))) || opts[0];
    placed.push(pick.box);
    return `<div class="sc-name" style="left:${pick.box[0]}px;bottom:${pick.box[1]}px">${esc(name)}</div>`;
  });
  const fmtX = colX.fmt, fmtY = colY.fmt;
  const grid = sy.ticks.map(v => `<div class="sc-gy" style="bottom:${100 * v / sy.max}%"></div><div class="sc-ty" style="bottom:${100 * v / sy.max}%">${esc(fmtY(v))}</div>`).join('')
    + sx.ticks.map(v => `<div class="sc-gx" style="left:${100 * v / sx.max}%"></div><div class="sc-tx" style="left:${100 * v / sx.max}%">${esc(fmtX(v))}</div>`).join('');
  const dots = pts.map(p => `<div class="sc-pt" style="left:${p.x}px;bottom:${p.y}px;width:${p.size}px;height:${p.size}px" title="${escAttr(`${p.r.title || p.r.label}: ${fmtX(p.r.stats[colX.key])} · ${fmtY(p.r.stats[colY.key])}`)}">${titleIconHtml(p.r.title, 'sc-logo')}</div>`).join('');
  return `<div class="compare-scatter" style="height:${H}px">
    <h3 class="cc-title">${esc(titleY)} tegenover ${esc(titleX.charAt(0).toLowerCase() + titleX.slice(1))}</h3>
    <div class="sc-body"><div class="sc-ylab">${esc(titleY)}</div>
      <div class="sc-plot" style="width:${W}px;height:${PH}px">${grid}${dots}${labels.join('')}</div></div>
    <div class="sc-xlab">${esc(titleX)} · bolgrootte = aantal posts</div>
  </div>`;
}

function syncControls() {
  const s = state.settings;

  updateRangeControls();

  const days = availableDays();
  $('#periodRow').hidden = days.length < 1;
  const dayLabel = (d) => {
    const [y, mo, da] = d.date.split('-').map(Number);
    let txt = d.date;
    try {
      txt = new Intl.DateTimeFormat('nl-NL', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })
        .format(new Date(Date.UTC(y, mo - 1, da)));
    } catch { /* datum als terugval */ }
    return `${txt} · ${d.n}`;
  };
  const dayOptions = (emptyLabel) => `<option value="">${esc(emptyLabel)}</option>`
    + days.map(d => `<option value="${d.date}">${esc(dayLabel(d))}</option>`).join('');
  $('#periodFrom').innerHTML = dayOptions('Alle dagen');
  $('#periodTo').innerHTML = dayOptions('—');
  $('#periodFrom').value = days.some(d => d.date === s.periodFrom) ? s.periodFrom : '';
  $('#periodTo').value = days.some(d => d.date === s.periodTo) ? s.periodTo : '';
  $('#slideFormat').value = s.format;
  $('#cardStyle').value = s.cardStyle || 'modern';
  $('#chartColorBy').value = s.chartColorBy || 'auto';
  const reachTitles = new Set(reachRows().map(r => r.title));
  const comboOk = !!state.mapping.brand && getActiveRows().some(r => reachTitles.has(r[state.mapping.brand]));
  $('#chartType option[value="combo"]').disabled = !comboOk;
  $('#chartType').value = ['line', 'heatmap', ...(comboOk ? ['combo'] : [])].includes(s.chartType) ? s.chartType : 'bars';
  const combo = s.chartType === 'combo';
  // titels met posts en bereik, meeste posts eerst
  const comboRows = getActiveRows(), brandKey = state.mapping.brand;
  const postCount = (n) => comboRows.filter(r => r[brandKey] === n).length;
  const comboNames = comboOk ? [...new Set(comboRows.map(r => r[brandKey]))].filter(n => reachTitles.has(n)).sort((a, b) => postCount(b) - postCount(a)) : [];
  $('#comboTitle').innerHTML = comboNames.map(n => `<option value="${escAttr(n)}">${esc(n)}</option>`).join('');
  if (comboNames.includes(s.comboTitle)) $('#comboTitle').value = s.comboTitle;
  $('#comboTitleField').hidden = s.view !== 'chart' || !combo || !comboOk;
  const sumMetrics = state.metrics.filter(mt => mt.column && mt.format !== 'percent');
  const heatOnly = s.chartType === 'heatmap';
  const TEXT_ORDER = ['__tfirst', '__tlag', '__tsource', '__tstate', '__tquote', '__turgency', '__town'];
  const textMeasures = (state.mapping.title && !combo ? Object.entries(TEXT_MEASURES)
    .filter(([, t]) => !(s.chartType === 'bars' && t.bars === false) && !(t.moments && !state.mapping.brand)) : [])
    .sort(([a], [b]) => TEXT_ORDER.indexOf(a) - TEXT_ORDER.indexOf(b));
  // tekst: staven tellen posts met het kenmerk, lijn en heatmap tonen het aandeel of de dichtheid per uur
  const textLabel = ([k, t]) => [k, s.chartType === 'bars' ? `posts ${t.post.startsWith('als ') ? '' : 'met '}${t.post}` : t.rate.toLowerCase()];
  const reachOpts = s.chartType !== 'bars' && reachRows().length
    ? Object.entries(REACH_MEASURES).map(([k, label]) => `<option value="${k}">${esc(label.toLowerCase())}</option>`).join('') : '';
  const group = (label, html) => html ? `<optgroup label="${label}">${html}</optgroup>` : '';
  const opt = ([k, label]) => `<option value="${k}">${esc(label)}</option>`;
  // zelfde indeling en volgorde als de tabellen; combinatie: posts staan altijd als staven, de keuze gaat over de lijn
  const speedOpts = ['<option value="">aantal artikelen</option>']
    .concat(heatOnly ? [opt(['__regularity', 'regelmaat'])] : [], textMeasures.filter(([, t]) => t.axis === 'speed').map(textLabel).map(opt)).join('');
  const formOpts = (heatOnly ? [opt(['__words', 'woorden per post (mediaan)'])] : []).join('');
  const contentOpts = textMeasures.filter(([, t]) => t.axis === 'content').map(textLabel).map(opt).join('');
  const numberOpts = sumMetrics.map(mt => opt([mt.id, `som van ${mt.label || mt.column}`])).join('');
  $('#chartMeasure').innerHTML = combo ? reachOpts
    : group('Snelheid en ritme', speedOpts) + group('Vorm', formOpts) + group('Inhoud', contentOpts) + group('Bereik', reachOpts) + group('Cijfers', numberOpts);
  const textOpts = textMeasures.length ? 'x' : '';
  $('#chartMeasure').value = [...$('#chartMeasure').options].some(o => o.value === s.chartMeasure) ? s.chartMeasure : combo ? '__users' : '';
  $('#chartMeasureField').hidden = s.view !== 'chart' || (!sumMetrics.length && !heatOnly && !reachOpts && !textOpts);
  $('#chartTypeField').hidden = s.view !== 'chart';
  $('#chartColorField').hidden = s.view !== 'chart' || ['heatmap', 'line', 'combo'].includes(s.chartType);
  $('#compareShowField').hidden = s.view !== 'compare';
  $('#compareShow2Field').hidden = s.view !== 'compare';
  $('#tableShowField').hidden = s.view !== 'table';
  $('#scatterXField').hidden = s.view !== 'scatter';
  $('#scatterYField').hidden = s.view !== 'scatter';
  $('#tableShow').value = TABLE_AXES[s.tableShow] ? s.tableShow : 'speed';
  $$('.view-btn[data-view]').forEach(btn => {
    const on = btn.dataset.view === (s.view || 'timeline');
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-selected', String(on));
  });
  $('#gifSpeed').value = s.gifSpeed || 'slow';
  $('#videoMode').value = s.videoMode || 'cinematic';

  $('#optShowDate').checked = s.showDate;
  $('#optRelative').checked = s.relative;
  $('#optHighlightMax').checked = s.highlightMax;
  $('#optShowImage').checked = s.showImage;
  $('#optShowBody').checked = s.showBody;
  $('#titleLines').value = String(s.titleLines);
  $('#slideTitle').value = s.slideTitle;
  $('#itemKind').value = s.itemKind || '';

  const activeRows = getActiveRows();
  $('#refreshRow').hidden = !(extensionBridge && state.datasets.some(d => d.sourceUrl));
  $('#optAutoRefresh').checked = !!s.autoRefresh;
  $('#dataStatus').textContent = activeRows.length
    ? `${activeRows.length} actieve rijen · ${state.rows.length} totaal · ${state.datasets.length} dataset${state.datasets.length === 1 ? '' : 's'}.`
    : 'Nog geen data. Plakken is genoeg — hij leest het meteen in.';

  setDot('#dot1', activeRows.length > 0);
  setDot('#dot2', !!(state.mapping.time && state.mapping.title));

  const canExport = !!(state.mapping.time && state.mapping.title && activeRows.length);
  $('#btnExportPng').disabled = !canExport || s.view === 'live';
  // video/GIF animeren tegels op de tijdlijn; in grafiek en tabel is alleen een stilstaand beeld zinvol
  const animated = (s.view || 'timeline') === 'timeline';
  $('#btnExportVideo').disabled = !canExport || !animated;
  $('#btnExportGif').disabled = !canExport || !animated;
  $('#btnCopy').disabled = !canExport || s.view === 'live';
  $('#btnExportCsv').disabled = !canExport && !reachRows().length;
}
function setDot(sel, ok) {
  const el = $(sel);
  el.className = 'status-dot ' + (ok ? 'ok' : 'todo');
  el.textContent = ok ? '✓' : '';
}

function renderAll() {
  const runSafe = (fn, name) => {
    try {
      fn();
    } catch (err) {
      console.error(`${name} crashed:`, err);
    }
  };
  runSafe(renderDatasetTabs, 'renderDatasetTabs');
  runSafe(syncControls, 'syncControls');
  runSafe(renderMapping, 'renderMapping');
  runSafe(renderMetrics, 'renderMetrics');
  runSafe(renderBrands, 'renderBrands');
  renderTimeline();
  if (window.lucide) lucide.createIcons();
  save();
}

/* ============================================================
   Events
   ============================================================ */
function bind() {
  const paste = $('#pasteArea'), zone = $('#pasteZone');
  paste.addEventListener('paste', e => {
    const txt = e.clipboardData?.getData('text/plain');
    if (!txt) {
      setTimeout(() => loadData(paste.value), 0);
      return;
    }
    e.preventDefault();
    paste.value = txt;
    loadData(txt);
  });
  paste.addEventListener('change', () => loadData(paste.value, true));
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('over');
    const f = e.dataTransfer.files[0];
    if (f) readFile(f);
  });

  const readFile = (file) => {
    const fr = new FileReader();
    fr.onload = () => { paste.value = String(fr.result).slice(0, 200000); loadData(fr.result); };
    fr.readAsText(file, 'utf-8');
  };
  $('#btnBrowse').addEventListener('click', () => $('#fileInput').click());
  $('#fileInput').addEventListener('change', e => e.target.files[0] && readFile(e.target.files[0]));
  $('#btnSample').addEventListener('click', () => { paste.value = SAMPLE; loadData(SAMPLE); });

  $$('select[data-target]').forEach(sel => {
    sel.addEventListener('change', () => {
      const target = sel.dataset.target;
      state.mapping[target] = sel.value || null;
      if (target === 'brand') rebuildBrands();
      if (target === 'time') autoRange();
      renderAll();
    });
  });

  $('#btnAddMetric').addEventListener('click', () => {
    const used = new Set([...Object.values(state.mapping), ...state.metrics.map(m => m.column)].filter(Boolean));
    state.metrics.push(newMetric(state.headers.find(h => !used.has(h)) || null));
    renderAll();
  });

  const bindSetting = (sel, key, parse = v => v, light = false) => {
    $(sel).addEventListener('input', e => {
      state.settings[key] = parse(e.target.type === 'checkbox' ? e.target.checked : e.target.value);
      if (light) scheduleTimeline(); else renderAll();
    });
  };
  bindSetting('#slideFormat', 'format');
  bindSetting('#compareShow', 'compareShow');
  bindSetting('#compareShow2', 'compareShow2');
  bindSetting('#tableShow', 'tableShow');
  bindSetting('#scatterX', 'scatterX');
  bindSetting('#scatterY', 'scatterY');
  bindSetting('#chartType', 'chartType');
  bindSetting('#chartMeasure', 'chartMeasure');
  bindSetting('#comboTitle', 'comboTitle');
  bindSetting('#optAutoRefresh', 'autoRefresh', v => v, true);
  $('#btnRefreshAll').addEventListener('click', () => refreshAll());
  bindSetting('#optShowDate', 'showDate');
  bindSetting('#optRelative', 'relative');
  bindSetting('#optHighlightMax', 'highlightMax');
  bindSetting('#optShowImage', 'showImage');
  bindSetting('#optShowBody', 'showBody');
  bindSetting('#titleLines', 'titleLines', v => +v);
  bindSetting('#slideTitle', 'slideTitle', v => v, true);
  bindSetting('#itemKind', 'itemKind', v => v, true);
  bindSetting('#cardStyle', 'cardStyle');
  $$('.view-btn[data-view]').forEach(btn => btn.addEventListener('click', () => {
    state.settings.view = btn.dataset.view;
    renderAll();
  }));
  bindSetting('#chartColorBy', 'chartColorBy');
  bindLive();
  bindSetting('#gifSpeed', 'gifSpeed', v => v, true);
  bindSetting('#videoMode', 'videoMode', v => v, true);

  $('#btnAutoRange').addEventListener('click', () => { state.settings.autoFit = true; state.settings.rangeMode = 'compact'; autoRange(); renderAll(); });
  $('#btnWholeDays').addEventListener('click', () => { applyWholeDays(); renderAll(); });
  $('#periodFrom').addEventListener('change', e => {
    const s = state.settings;
    s.periodFrom = e.target.value;
    if (!s.periodFrom) s.periodTo = '';
    else if (!s.periodTo || s.periodTo < s.periodFrom) s.periodTo = s.periodFrom;
    applyWholeDays();
    renderAll();
  });
  $('#periodTo').addEventListener('change', e => {
    const s = state.settings;
    s.periodTo = e.target.value;
    if (s.periodTo && (!s.periodFrom || s.periodFrom > s.periodTo)) s.periodFrom = s.periodTo;
    applyWholeDays();
    renderAll();
  });

  $('#btnRestore').addEventListener('click', () => { state.removed = []; renderAll(); toast('Verwijderde tegels zijn terug.'); });
  $('#btnZoomIn').addEventListener('click', () => { zoom = Math.min(1.5, (zoom ?? fitScale()) + .1); applyZoom(); });
  $('#btnZoomOut').addEventListener('click', () => { zoom = Math.max(.1, (zoom ?? fitScale()) - .1); applyZoom(); });
  $('#btnZoomFit').addEventListener('click', () => { zoom = null; applyZoom(); });
  window.addEventListener('resize', applyZoom);
  $('#cardLayer').addEventListener('click', (ev) => { if (ev.target === ev.currentTarget) selectPost(null); });
  document.addEventListener('keydown', (ev) => {
    const tgt = ev.target instanceof Element ? ev.target : document.body;
    if (selectedPostId === null || tgt.closest('input, textarea, select, [contenteditable]')) return;
    if (ev.key === 'Escape') { selectPost(null); return; }
    const dir = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[ev.key];
    // in het paneel blijven op en neer gewoon scrollen
    if (!dir || ev.altKey || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
    if (tgt.closest('.dp-body, summary') && /^Arrow(Up|Down)$/.test(ev.key)) return;
    ev.preventDefault();
    stepSelection(dir);
  });

  $('#btnExportCsv').addEventListener('click', exportCsv);

  $('#btnExportPng').addEventListener('click', async () => {
    try {
      $('#btnExportPng').disabled = true;
      await downloadPng();
    } catch (err) {
      console.error(err);
      toast('Export mislukt: ' + err.message);
    } finally {
      syncControls();
    }
  });

  $('#btnExportVideo').addEventListener('click', async () => {
    try {
      $('#btnExportVideo').disabled = true;
      await downloadVideo();
    } catch (err) {
      console.error(err);
      toast('Video maken mislukt: ' + err.message);
    } finally {
      syncControls();
    }
  });

  $('#btnExportGif').addEventListener('click', async () => {
    try {
      $('#btnExportGif').disabled = true;
      await downloadGif();
    } catch (err) {
      console.error(err);
      toast('GIF maken mislukt: ' + err.message);
    } finally {
      syncControls();
    }
  });

  $('#btnCopy').addEventListener('click', async () => {
    try {
      $('#btnCopy').disabled = true;
      await copyPng();
    } catch (err) {
      console.error(err);
      toast('Kopiëren mislukt: ' + err.message);
    } finally {
      syncControls();
    }
  });
  $('#btnReset').addEventListener('click', () => {
    if (!confirm('Alles leegmaken en opnieuw beginnen?')) return;
    state = defaultState();
    $('#pasteArea').value = '';
    localStorage.removeItem(STORAGE_KEY);
    LEGACY_STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
    renderAll();
  });
}

/* ============================================================
   Voorbeelddata
   ============================================================ */
const SAMPLE = `merk;tijd;titel;premium;opens;ctr
NU.nl;2026-11-11 05:59;Democraten heroveren Senaat en Huis van Afgevaardigden, Trump erkent verlies;nee;67099;8,63%
De Morgen;2026-11-11 06:01;Democraten krijgen meerderheid in zowel Huis als Senaat na historische zeges in dieprode staten • President Trump 'zal uitslag aanvaarden' - volg live updates;ja;1333;1,01%
HLN;2026-11-11 06:03;LIVE. Democraten veroveren na Huis van Afgevaardigden ook meerderheid in Senaat: Trump zegt dat hij verkiezingsuitslag zal aanvaarden;nee;8581;1,39%
AD;2026-11-11 06:07;Democraten pakken meerderheid Senaat en waarschijnlijk ook Huis, zelfs in Texas verliezen Republikeinen;nee;6445;1,20%
de Volkskrant;2026-11-11 06:12;Amerikanen rekenen af met Trump: Democraten stevenen af op monsterzege in het Congres;ja;4543;0,94%`;

/* ============================================================
   Start
   ============================================================ */
// Ingang voor de Chrome-extensie (extension/): krijgt de volledige HTML van de liveblogpagina.
window.reconstructImport = ({ html, url, tickaroo } = {}) => {
  if (!html) return false;
  tickarooSeed = tickaroo || null;
  loadData(String(html), false, { sourceUrl: url });
  return true;
};

try { bind(); } catch (err) { console.error('bind() crashed:', err); }
try { restore(); } catch (err) { console.error('restore() crashed:', err); }
renderAll();
