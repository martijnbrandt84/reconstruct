// Tekstmaten en gedeeld nieuws: ritme, regelmaat, lengte, kop/tekst-scheiding, tekstmaten en gedeelde momenten.
// Klassiek script (geen module): wordt vóór app.js geladen en gebruikt globals uit app.js pas bij aanroep.

/* ---------- ritme en lengte: frequentie, regelmaat en lengte als objectieve maten ---------- */
// langer dan dit zonder post telt als pauze (nacht, onderbreking), niet als actieve tijd
const PAUSE_MIN = 120;
const LENGTH_CLASSES = [['kort', 'Kort (<40 woorden)', 40], ['middel', 'Middel (40\u2013150)', 150], ['lang', 'Lang (>150)', Infinity]];

// lengte van een post: woorden in de tekst; de kop telt alleen mee als er geen tekst is (zo hangt lengte niet af van hoe een titel kop en tekst scheidt)
const postWords = (r) => {
  if (!state.mapping.title) return +r.woorden || 0;
  return wordCount(sentenceBody(r)) || wordCount(rowHead(r));
};
// kop en tekst samen, zonder dubbeltelling; bepaalt of een post groot genoeg is voor gedeeld nieuws
const allWords = (r) => state.mapping.title ? wordCount(fullPostText(r)) : (+r.woorden || 0);
const lengthClass = (words) => LENGTH_CLASSES.find(([, , max]) => words < max)[0];
// woorden per zin in de tekst van een post; zinnen korter dan 3 woorden (kreten, bijschriften) tellen niet mee
const splitSentences = (text) => String(text || '')
  .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý"'‘“,])/)
  .filter(s => s.split(/\s+/).filter(w => /\w/.test(w)).length >= 3);
const sentenceLengths = (r) => splitSentences(sentenceBody(r))
  .map(s => s.split(/\s+/).filter(w => /\w/.test(w)).length);

/* ---------- tekstanalyse: maten die voor elke Nederlandstalige liveblog werken, los van onderwerp of gebeurtenis ---------- */
const PLACEHOLDER_HEAD = /^Liveblog update( \d+)?$/;
// begint de tekst met de kop (op leestekens na), dan staat de kop er al in
const startsWithHead = (h, b) => { const x = h.replace(/[\s.:;\u2026"'\u201c\u201d\u2018\u2019]+$/, ''); return x.length >= 8 && b.startsWith(x); };
/** Kop van een post. NU.nl plakt de eerste zin aan de kop ('KentuckyEr valt'); die kop staat ook vooraan de tekst,
 *  en de echte kop eindigt bij de overgang van kleine letter naar hoofdletter. */
function headOf(r) {
  const m = state.mapping;
  const h = String(r[m.title] ?? '').trim();
  if (!h || !m.body) return h;
  if (startsWithHead(h, String(r[m.body] ?? '').trim())) {
    const g = h.match(/^(.{8,160}?[a-z\d.?!)'\u2019"])([A-Z][a-z])/);
    if (g) return g[1].trim();
  }
  // NU.nl zonder hoofdletter op de plek van de overgang: kop eindigt voor een zin die met een lidwoord of voegwoord begint
  if (m.brand && /^NU\.nl$/.test(String(r[m.brand] ?? '').trim())) {
    const g = String(r[m.body] ?? '').trim().match(/^(.{15,160}?[a-z\d]) (?=(?:De|Het|In|Een|Op|Dat|Die|Met|Voor|Volgens|Ook|Bij|Na|Zo|Er|Hij|Zij|Ze|Daarmee|Nadat|Om|Hoewel|Inmiddels|Namens|Geen)\b)/);
    if (g) return g[1].replace(/[\s"'\u2018\u2019\u201c\u201d:]+$/, '');
  }
  return h;
}
// kop en tekst als één tekst, zonder de kop dubbel te nemen als de tekst ermee begint; placeholderkoppen tellen niet
const fullPostText = (r) => {
  const h = PLACEHOLDER_HEAD.test(headOf(r)) ? '' : fullText(headOf(r));
  const b = h ? bodyOnly(r) : fullText(state.mapping.body ? r[state.mapping.body] : '');
  return `${h} ${b}`.trim();
};
const wordsRe = (words, flags = 'iu') => new RegExp(`(?<![\\p{L}\\d])(?:${words.join('|')})(?![\\p{L}\\d])`, flags);
// aanhalingstekens; een los apostrof-s ('s nachts, Trump's) telt niet
const QUOTE_RE = /["“”„]|,,|‘[^’]{3,}’|'[^'\s][^']{2,}'/;
const SPEECH_WORDS = ['zegt', 'zei', 'zeiden', 'zeggen', 'aldus', 'verklaar\\p{L}*', 'laat weten', 'liet weten', 'stelt', 'stelde', 'schrijft', 'schreef',
  'reageer\\p{L}*', 'reageert', 'reageerde', 'benadruk\\p{L}*', 'waarschuw\\p{L}*', 'noemt', 'noemde', 'klinkt het', 'roept', 'riep', 'belooft', 'beloofde',
  'eist', 'eiste', 'claimt', 'claimde', 'beweert', 'beweerde'];
const SPEECH_RE = wordsRe(SPEECH_WORDS);
const AGENCY_RE = wordsRe(['ANP', 'AP', 'Associated Press', 'Reuters', 'AFP', 'Belga', 'dpa', 'Bloomberg'], 'u');
const ATTRIB_RE = wordsRe(['volgens', 'meldt', 'melden', 'meldde', 'berichtt?en', 'berichtte', 'laat weten', 'liet weten', 'bevestigt', 'bevestigde', 'aldus', 'schrijft', 'schreef']);
// alledaagse woorden als 'nu' (in 1 op de 4 posts) en 'momenteel' zeggen niets over urgentie en staan er bewust niet in
const URGENCY_WORDS = ['zojuist', 'zonet', 'zopas', 'zo-even', 'net bekend\\p{L}*', 'net binnen', 'breaking',
  'nog maar net', 'spann\\p{L}*', 'spanning\\p{L}*', 'nek-aan-nek\\p{L}*', 'nagelbijt\\p{L}*', 'cruciaal', 'cruciale', 'beslissend\\p{L}*', 'doorslaggevend\\p{L}*', 'op het spel',
  'kantelmoment', 'adem in'];
// eigen land: Nederland voor Nederlandse titels, België voor Belgische titels (geen Europa of NAVO)
const OWN_ANGLE_WORDS = {
  NL: ['Nederland\\p{L}*', 'Den Haag', 'Haags\\p{L}*'],
  BE: ['Belgi\\p{L}*', 'Belg(?:en)?', 'Vlaams\\p{L}*', 'Vlaming\\p{L}*', 'Vlaanderen']
};
const BELGIAN_TITLES = /^(HLN|VRT(?:\s?NWS)?|De Morgen|De Standaard|(?:Het )?Nieuwsblad|Het Laatste Nieuws|Gazet van Antwerpen|GVA|Knack|Bruzz)$/i;
const URGENCY_RE = wordsRe(URGENCY_WORDS, 'giu');
const OWN_ANGLE_RE = { NL: wordsRe(OWN_ANGLE_WORDS.NL, 'giu'), BE: wordsRe(OWN_ANGLE_WORDS.BE, 'giu') };
const ownAngleRe = (r) => OWN_ANGLE_RE[state.mapping.brand && BELGIAN_TITLES.test(String(r[state.mapping.brand] ?? '').trim()) ? 'BE' : 'NL'];
// fotobijschriften en ondertekening als (ANP) zijn geen bronvermelding in de tekst
const stripCredits = (s) => String(s).replace(/\((?:foto|beeld)[^)]*\)/gi, ' ').replace(/\((?:ANP|Belga|AP|AFP|Reuters|Redactie)[^)]*\)\s*$/i, ' ');

/** Tekstmaten per titel: kopstijl, citaten, bronvermelding en woordgebruik. */
function textStats(rows) {
  const m = state.mapping;
  if (!m.title) return {};
  const heads = rows.map(headOf).filter(h => h && !PLACEHOLDER_HEAD.test(h));
  const bodies = m.body ? rows.map(sentenceBody).map(s => s.trim()).filter(Boolean) : [];
  const all = rows.map(fullPostText);
  const share = (arr, f) => arr.length ? arr.filter(f).length / arr.length : null;
  const sents = bodies.flatMap(splitSentences);
  const words = all.reduce((a, x) => a + x.split(/\s+/).filter(w => /\p{L}/u.test(w)).length, 0);
  const per1000 = (re) => words ? 1000 * all.reduce((a, x) => a + (x.match(re) || []).length, 0) / words : null;
  const own = words ? 1000 * all.reduce((a, x, i) => a + (x.match(ownAngleRe(rows[i])) || []).length, 0) / words : null;
  return {
    headQuote: share(heads, h => QUOTE_RE.test(h)),
    statements: sents.length ? sents.filter(s => QUOTE_RE.test(s) || SPEECH_RE.test(s)).length / sents.length : null,
    sourced: share(all, x => { const c = stripCredits(x); return AGENCY_RE.test(c) || ATTRIB_RE.test(c); }),
    urgency: per1000(URGENCY_RE),
    ownAngle: own
  };
}

const rowHead = (r) => { const h = headOf(r); return PLACEHOLDER_HEAD.test(h) ? '' : h; };
const rowText = fullPostText;
// tekst van de post zonder de kop die er soms vooraan in staat; leeg = alleen kop, beeld of embed
const bodyOnly = (r) => {
  const b = fullText(state.mapping.body ? r[state.mapping.body] : '');
  const h = fullText(headOf(r)).replace(/[\s.:;\u2026"'\u201c\u201d\u2018\u2019]+$/, '');
  if (!startsWithHead(h, b)) return b;
  let rest = b.slice(h.length);
  // kop afgekapt midden in een woord: het restant van dat woord hoort er niet meer bij
  if (/[\p{L}\d]$/u.test(h) && /^\p{Ll}/u.test(rest)) rest = rest.replace(/^\S*\s*/, '');
  return rest.replace(/^[\s.:;\u2026"'\u201c\u201d\u2018\u2019]+/, '');
};
// tekst voor zinsmaten: bij NU.nl zonder de aan de kop geplakte zin
const sentenceBody = (r) => {
  const raw = state.mapping.body ? String(r[state.mapping.body] ?? '') : '';
  return state.mapping.title && headOf(r) !== String(r[state.mapping.title] ?? '').trim() ? bodyOnly(r) : raw;
};
const hasMatch = (re, s) => (String(s).match(re) || []).length > 0;
/** Tekstmaten per uur. test(it): telt een post mee in de staafgrafiek; key: maat uit textStats voor lijn en heatmap, of value(items).
 *  moments: rol bij gedeeld nieuws nodig (chartRole); bars: false = niet als staaf. */
let chartRole = () => null;
let chartMoments = null;
/** Gedeeld nieuws per titel en uur: momenten die in dat uur beginnen. Achterstand telt alleen momenten die de titel bracht; niet brengen is dekking, geen snelheid. */
function momentCell(name, from, to, kind) {
  const ms = (chartMoments?.list || []).filter(mo => mo.start >= from && mo.start < to);
  if (ms.length < 3) return null;
  if (kind === 'first') return 100 * ms.filter(mo => mo.first === name).length / ms.length;
  const lags = ms.filter(mo => mo.who.has(name)).map(mo => mo.who.get(name));
  return lags.length >= 2 ? medianOf(lags) : null;
}
const TEXT_MEASURES = {
  __tfirst: { axis: 'speed', post: 'als eerste bij gedeeld nieuws', rate: 'Als eerste bij gedeeld nieuws (%)', moments: true,
    test: it => !!chartRole(it)?.first,
    cell: (name, from, to) => momentCell(name, from, to, 'first') },
  __tlag: { axis: 'speed', rate: 'Achterstand bij gebracht nieuws (mediaan min)', moments: true, bars: false,
    cell: (name, from, to) => momentCell(name, from, to, 'lag') },
  __tquote: { axis: 'content', post: 'citaat in de kop', rate: 'Koppen met citaat (%)', key: 'headQuote', pct: true, test: it => QUOTE_RE.test(rowHead(it.row)) },
  __tstate: { axis: 'content', post: 'een uitspraak', rate: 'Zinnen met een uitspraak (%)', key: 'statements', pct: true,
    test: it => splitSentences(sentenceBody(it.row)).some(s => QUOTE_RE.test(s) || SPEECH_RE.test(s)) },
  __tsource: { axis: 'content', post: 'bronvermelding', rate: 'Posts met bronvermelding (%)', key: 'sourced', pct: true,
    test: it => { const c = stripCredits(rowText(it.row)); return AGENCY_RE.test(c) || ATTRIB_RE.test(c); } },
  __turgency: { axis: 'content', post: 'urgentietaal', rate: 'Urgentietaal per 1.000 woorden', key: 'urgency', test: it => hasMatch(URGENCY_RE, rowText(it.row)) },
  __town: { axis: 'content', post: 'het eigen land', rate: 'Eigen land (NL of BE) per 1.000 woorden', key: 'ownAngle', test: it => hasMatch(ownAngleRe(it.row), rowText(it.row)) }
};
// per uur pas vanaf 3 posts; daaronder springt een aandeel van 0 naar 100%
const textValue = (tm, its) => {
  if (tm.value) return tm.value(its);
  if (its.length < 3) return null;
  const v = textStats(its.map(it => it.row))[tm.key];
  return v === null || v === undefined ? null : tm.pct ? v * 100 : v;
};

const STOP_NL = new Set(`de het een en van in op te dat die is voor met zijn aan er om als bij ook niet maar door naar uit
heeft hebben was werd wordt worden zal zou kan al nog dan dit deze of over tot na hij zij ze we wij je u ik hun haar
hem meer veel nu wel geen toch zo daar hier waar wat wie hoe toen omdat terwijl volgens tegen onder sinds tussen
eerste twee drie vier vijf jaar uur procent maandag dinsdag woensdag donderdag vrijdag zaterdag zondag nacht avond
vannacht vanavond vanochtend vandaag ongeveer zegt zei the and to`.split(/\s+/));
let momentsCache = { key: '', value: null };

/** Gedeelde nieuwsmomenten: posts van verschillende titels die binnen `windowMin` minuten inhoudelijk op elkaar lijken
 *  (tf-idf op kop en begin van de tekst). Per titel: hoe vaak eerste, hoe vaak volger en de achterstand in minuten. */
function sharedMoments(items, keyOf, thr = 0.25, windowMin = 180, mergeMin = 0.24) {
  const m = state.mapping;
  const list = items.slice().sort((a, b) => a.minutes - b.minutes);
  const cacheKey = `${m.title}|${m.body}|` + list.map(it => momentKey(it, keyOf)).join('|');
  if (momentsCache.key === cacheKey) return momentsCache.value;
  const n = list.length;
  const tfs = list.map(it => {
    const head = headOf(it.row), body = m.body ? bodyOnly(it.row).slice(0, 400) : '';
    // NU.nl plakt kop en eerste zin aan elkaar ('FloridaGeen verrassing')
    const toks = (`${head} ${head} ${body}`.replace(/([a-zà-ÿ])([A-ZÀ-Þ])/g, '$1 $2').toLowerCase().match(/[a-zà-ÿ][a-zà-ÿ'-]{2,}/g) || []).filter(w => !STOP_NL.has(w));
    const tf = new Map();
    toks.forEach((w, i) => {
      tf.set(w, (tf.get(w) || 0) + 1);
      if (i) tf.set(`${toks[i - 1]} ${w}`, (tf.get(`${toks[i - 1]} ${w}`) || 0) + 1);
    });
    return tf;
  });
  const df = new Map();
  tfs.forEach(tf => tf.forEach((_, t) => df.set(t, (df.get(t) || 0) + 1)));
  const vecs = tfs.map(tf => {
    const v = new Map();
    let norm = 0;
    tf.forEach((c, t) => {
      const d = df.get(t);
      if (d < 2) return;
      const w = (1 + Math.log(c)) * (Math.log((1 + n) / (1 + d)) + 1);
      v.set(t, w);
      norm += w * w;
    });
    norm = Math.sqrt(norm) || 1;
    v.forEach((w, t) => v.set(t, w / norm));
    return v;
  });
  const sim = (i, j) => {
    let [a, b] = vecs[i].size < vecs[j].size ? [vecs[i], vecs[j]] : [vecs[j], vecs[i]];
    let s = 0;
    a.forEach((w, t) => { const x = b.get(t); if (x) s += w * x; });
    return s;
  };
  const keys = list.map(keyOf);
  const ok = list.map(it => !PLACEHOLDER_HEAD.test(String(it.row[m.title] ?? '').trim()) && allWords(it.row) >= 8);
  const pairs = [];
  for (let i = 0; i < n; i++) {
    if (!ok[i]) continue;
    for (let j = i + 1; j < n && list[j].minutes - list[i].minutes <= windowMin; j++) {
      if (!ok[j] || keys[i] === keys[j]) continue;
      const s = sim(i, j);
      if (s >= thr) pairs.push([s, i, j]);
    }
  }
  // sterkste koppelingen eerst; per titel hooguit één post per moment en het hele moment binnen het venster
  pairs.sort((a, b) => b[0] - a[0]);
  const parent = list.map((_, i) => i);
  const find = (a) => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a; };
  const members = new Map(list.map((_, i) => [i, [i]]));
  pairs.forEach(([, i, j]) => {
    const a = find(i), b = find(j);
    if (a === b) return;
    const A = members.get(a), B = members.get(b);
    const titlesA = new Set(A.map(k => keys[k]));
    if (B.some(k => titlesA.has(keys[k]))) return;
    const span = [...A, ...B].map(k => list[k].minutes);
    if (Math.max(...span) - Math.min(...span) > windowMin) return;
    let total = 0;
    A.forEach(x => B.forEach(y => { total += sim(x, y); }));
    if (total / (A.length * B.length) < mergeMin) return;
    parent[b] = a;
    members.set(a, A.concat(B));
    members.delete(b);
  });
  const per = new Map();
  const roles = new Map();
  const moments_ = [];
  const byId = new Map();
  const slot = (k) => per.get(k) || per.set(k, { first: 0, follow: 0, lags: [] }).get(k);
  let moments = 0;
  members.forEach(idx => {
    if (idx.length < 2) return;
    moments++;
    idx.sort((a, b) => list[a].minutes - list[b].minutes);
    const t0 = list[idx[0]].minutes;
    slot(keys[idx[0]]).first++;
    roles.set(momentKey(list[idx[0]], keyOf), { first: true, lag: 0 });
    const who = new Map([[keys[idx[0]], 0]]);
    idx.slice(1).forEach(k => {
      const p = slot(keys[k]);
      p.follow++;
      p.lags.push(list[k].minutes - t0);
      who.set(keys[k], list[k].minutes - t0);
      roles.set(momentKey(list[k], keyOf), { first: false, lag: list[k].minutes - t0 });
    });
    // gelijkenis van elke post met de rest van het moment, voor het zijpaneel
    const avgSim = (k) => idx.filter(x => x !== k).reduce((a, x) => a + sim(k, x), 0) / (idx.length - 1);
    const posts = idx.map(k => ({ id: list[k].row.__id, row: list[k].row, key: keys[k], minutes: list[k].minutes, lag: list[k].minutes - t0, sim: avgSim(k) }));
    const mo = { start: t0, first: keys[idx[0]], who, posts, window: windowMin };
    moments_.push(mo);
    posts.forEach(p => byId.set(p.id, mo));
  });
  momentsCache = { key: cacheKey, value: { moments, per, roles, list: moments_, byId, window: windowMin } };
  return momentsCache.value;
}
// sleutel per post, ook als visibleItems() nieuwe objecten maakt
const momentKey = (it, keyOf) => `${keyOf(it)}@${it.minutes}@${String(it.row[state.mapping.title] ?? '').slice(0, 30)}`;

/** Sessies (pauzes > PAUSE_MIN eruit): actieve minuten en de tussentijden binnen sessies. */
function rhythmOf(sortedMinutes) {
  let active = 0;
  const gaps = [];
  for (let i = 1; i < sortedMinutes.length; i++) {
    const g = sortedMinutes[i] - sortedMinutes[i - 1];
    if (g <= PAUSE_MIN) { active += g; gaps.push(g); }
  }
  return { activeMinutes: active, gaps };
}

/** Regelmaat 0\u2013100 uit de burstiness B = (\u03c3\u2212\u03bc)/(\u03c3+\u03bc): 100 = strak ritme, 50 = willekeurig, 0 = alles in uitbarstingen. */
function regularityScore(gaps, minGaps = 19) {
  if (gaps.length < minGaps) return null;
  const mu = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  if (!mu) return null;
  const sd = Math.sqrt(gaps.reduce((a, g) => a + (g - mu) ** 2, 0) / gaps.length);
  return 50 * (1 - (sd - mu) / (sd + mu));
}

const medianOf = (arr) => {
  if (!arr.length) return null;
  const a = [...arr].sort((x, y) => x - y), mid = a.length >> 1;
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
};

/* ---------- bijna-kopieën: dezelfde woorden in dezelfde volgorde ---------- */
// near: samen 80% of meer dezelfde woorden in dezelfde volgorde (langste gemeenschappelijke woordreeks), ook met kleine wijzigingen
// short: de kortste post staat voor 80% of meer in de langere (ingekorte kopie); part: 50% of meer dezelfde woordreeksen van 3 woorden
const COPY_NEAR = 0.8, COPY_PARTLY = 0.5, COPY_SHORT_MIN_WORDS = 20, COPY_SHORT_MIN_RATIO = 0.4;
const gramCache = new WeakMap();
function textGrams(r) {
  const key = `${state.mapping.title}|${state.mapping.body}`;
  const hit = gramCache.get(r);
  if (hit && hit.key === key) return hit;
  const toks = fullPostText(r).toLowerCase().match(/[\p{L}\d]+/gu) || [];
  let set = null;
  if (toks.length >= 6) {
    set = new Set();
    for (let i = 0; i + 3 <= toks.length; i++) set.add(toks.slice(i, i + 3).join(' '));
  }
  const val = { key, toks, set };
  gramCache.set(r, val);
  return val;
}
function lcsLength(a, b) {
  let prev = new Uint16Array(b.length + 1), cur = new Uint16Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}
/** Overlap van twee posts als { s: 0-1, kind: 'near' | 'short' | 'part' }, of null bij te weinig tekst (minder dan 6 woorden) of te weinig overlap. */
function copyMatch(a, b) {
  const A = textGrams(a), B = textGrams(b);
  if (!A.set || !B.set) return null;
  const [small, large] = A.set.size <= B.set.size ? [A.set, B.set] : [B.set, A.set];
  let inter = 0;
  small.forEach(s => { if (large.has(s)) inter++; });
  if (inter / small.size < 0.2) return null;
  const jac = inter / (A.set.size + B.set.size - inter);
  const nA = A.toks.length, nB = B.toks.length, nMin = Math.min(nA, nB), nMax = Math.max(nA, nB);
  const l = lcsLength(A.toks, B.toks);
  const dice = 2 * l / (nA + nB);
  if (dice >= COPY_NEAR) return { s: dice, kind: 'near' };
  if (nMin >= COPY_SHORT_MIN_WORDS && nMin / nMax >= COPY_SHORT_MIN_RATIO && l / nMin >= COPY_NEAR) return { s: l / nMin, kind: 'short' };
  if (jac >= COPY_PARTLY) return { s: jac, kind: 'part' };
  return null;
}
/** Posts uit `all` binnen `windowMin` minuten met minstens `minScore` overlap met `item`, sterkste eerst. */
function nearCopies(item, all, minScore = COPY_PARTLY, windowMin = 1440) {
  return all
    .filter(o => o.row !== item.row && Math.abs(o.minutes - item.minutes) <= windowMin)
    .map(o => ({ o, ...copyMatch(item.row, o.row) }))
    .filter(x => x.s !== undefined && x.s >= minScore)
    .sort((x, y) => y.s - x.s);
}
