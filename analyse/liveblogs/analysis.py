"""Alle analyses op één Reconstruct-export; levert een dict met uitkomsten. Woordenlijsten komen uit een config (configs/*.json)."""
import json
import math
import re
from collections import Counter, defaultdict
from urllib.parse import urlparse
import numpy as np
from .prep import load, clusters, truncated_titles


def rx(words):
    return re.compile(r'(?<![\w])(' + '|'.join(words) + r')(?![\w])', re.I)


# zin met een uitspraak: aanhalingstekens of een spreekwerkwoord
SPEECH = re.compile(r'["“”„]|,,|‘[^’]{8,}’|(?<![\w])(zegt|zei|zeiden|zeggen|aldus|verklaar\w*|laat weten|liet weten|stelt|stelde|schrijft|schreef|reageer\w*|reageert|reageerde|benadruk\w*|waarschuw\w*|noemt|noemde|klinkt het|roept|riep|belooft|beloofde|eist|eiste|claimt|claimde|beweert|beweerde)(?![\w])', re.I)
QUOTED = re.compile(r'["\u201c\u201d\u201e][^"\u201c\u201d\u201e]{3,}["\u201c\u201d\u201e]|\u2018[^\u2019]{3,}\u2019|\'[^\']{8,}\'')


def site(u):
    h = (urlparse(str(u)).hostname or '').lower()
    return '.'.join(h.split('.')[-2:])


def sentences(text):
    return [s for s in re.split(r'(?<=[\.\!\?])\s+(?=[A-Z"\'‘“,])', str(text)) if len(s.split()) >= 3]


def load_config(path):
    cfg = json.loads(open(path, encoding='utf-8').read())
    cfg['_sources'] = {k: rx(v) for k, v in cfg['bronnen'].items()}
    cfg['_frames'] = {k: rx(v['woorden']) for k, v in cfg['frames'].items()}
    cfg['_own'] = rx(cfg['eigen_land'])
    cfg['_speakers'] = {k: rx(v) for k, v in cfg.get('sprekers', {}).items()}
    cfg['_urgency'] = {k: rx(v['woorden']) for k, v in cfg.get('urgentie', {}).items()}
    return cfg


def run(csv, cfg):
    df = load(csv)
    df = clusters(df, cfg['clusters']['drempel'], cfg['clusters']['venster'])
    order = list(df['Titel'].value_counts().index)
    real = df[~df['placeholder']]
    out = {'n': len(df), 'order': order, 'start': df['t'].min(), 'end': df['t'].max(),
           'truncated': truncated_titles(df),
           'hosts': {t: site(df.loc[df['Titel'] == t, 'Liveblog-URL'].mode().iloc[0]) for t in order}}

    # ---------- profiel per titel ----------
    prof = {}
    for t in order:
        d = df[df['Titel'] == t]
        gaps = d['t'].diff().dt.total_seconds().div(60).dropna()
        sess = gaps[gaps <= 120]   # langere pauzes tellen niet als actieve tijd
        active_h = sess.sum() / 60
        media = d['Media'].fillna('geen').replace('', 'geen').value_counts(normalize=True)
        prof[t] = {'posts': len(d), 'perHour': len(d) / active_h if active_h else 0.0,
                   'medianGap': float(sess.median()) if len(sess) else None,
                   'medianWords': float(d['Woorden'].median()),
                   # verrijking: foto, video, social embed of datavisualisatie (Reconstruct geeft elke post één rubriek)
                   'enriched': float(1 - media.get('geen', 0)),
                   'media': {k: float(media.get(k, 0)) for k in ['foto', 'video', 'social', 'dataviz']},
                   'first': d['t'].min(), 'last': d['t'].max()}
    out['profile'] = prof

    # ---------- gedeelde nieuwsmomenten: wie eerst, wie volgt ----------
    cl = df[df['cluster'] >= 0]
    first, follow, lags = Counter(), Counter(), defaultdict(list)
    moments = []
    for cid, g in cl.groupby('cluster'):
        g = g.sort_values('t')
        lead = g.iloc[0]
        first[lead['Titel']] += 1
        for _, r in g.iloc[1:].iterrows():
            follow[r['Titel']] += 1
            lags[r['Titel']].append((r['t'] - lead['t']).total_seconds() / 60)
        moments.append({'id': int(cid), 'start': lead['t'], 'kop': lead['Kop'], 'n': int(g['Titel'].nunique()),
                        'photos': int(g['Foto-URL'].astype(str).str.startswith('http').sum()),
                        'posts': [{'title': r['Titel'], 'lag': (r['t'] - lead['t']).total_seconds() / 60} for _, r in g.iterrows()]})
    moments.sort(key=lambda m: (-m['n'], -m['photos'], m['start']))
    # grote momenten: minstens de helft van de titels (en minstens vier)
    big_n = max(4, math.ceil(len(order) / 2))
    big = [m for m in moments if m['n'] >= big_n]
    covered = Counter(p['title'] for m in big for p in m['posts'])
    out['chains'] = {
        'clusters': len(moments), 'postsInClusters': int(len(cl)), 'moments': moments, 'bigN': big_n, 'big': len(big),
        'first': {t: first[t] for t in order}, 'follow': {t: follow[t] for t in order},
        'firstShare': {t: first[t] / max(1, first[t] + follow[t]) for t in order},
        # over alle gedeelde momenten: wie een moment niet brengt, kan er ook niet de eerste zijn
        'firstAll': {t: first[t] / max(1, len(moments)) for t in order},
        'followAll': {t: follow[t] / max(1, len(moments)) for t in order},
        'missedAll': {t: 1 - (first[t] + follow[t]) / max(1, len(moments)) for t in order},
        'medianLag': {t: (float(np.median(lags[t])) if lags[t] else 0.0) for t in order},
        'coverage': {t: covered[t] / max(1, len(big)) for t in order},
    }

    # ---------- bronnen ----------
    clean = lambda s: re.sub(r'\((?:foto|beeld)[^)]*\)|\((?:ANP|Belga|AP|AFP|Reuters|Redactie)[^)]*\)\s*$', ' ', str(s), flags=re.I)
    src, credit = {}, {}
    for t in order:
        d = real[real['Titel'] == t]
        txt = (d['Kop'] + ' ' + d['Tekst'].map(clean)).tolist() or ['']
        src[t] = {k: float(np.mean([bool(p.search(x)) for x in txt])) for k, p in cfg['_sources'].items()}
        src[t]['any'] = float(np.mean([any(p.search(x) for p in cfg['_sources'].values()) for x in txt]))
        tail = d['Tekst'].str.strip().str[-60:]
        credit[t] = {
            'bureau': float(tail.str.contains(r'\((?:ANP|Belga|AP|AFP|Reuters|ANP/[A-Z]+|Redactie)\)\s*$', regex=True).mean()),
            'naam': float(tail.str.contains(r'(?:\.|\)|")\s*(?:[A-Z][a-z]+ ){1,2}[A-Z][a-z]+(?: / ANP)?\s*$', regex=True).mean()),
        }
    names = Counter()
    for x in (real['Kop'] + ' ' + real['Tekst']):
        for k in cfg['bronnamen']:
            if re.search(r'(?<![\w])' + re.escape(k) + r'(?![\w])', x):
                names[k] += 1
    # per titel bij naam; ondertekening als (ANP) telt hier wel mee, fotobijschriften niet
    nophoto = lambda s: re.sub(r'\((?:foto|beeld)[^)]*\)', ' ', str(s), flags=re.I)
    pats = {k: re.compile(r'(?<![\w])' + re.escape(k) + r'(?![\w])') for k in cfg['bronnamen']}
    named = {}
    for t in order:
        d = real[real['Titel'] == t]
        txt = (d['Kop'] + ' ' + d['Tekst'].map(nophoto)).tolist() or ['']
        named[t] = {k: float(np.mean([bool(p.search(x)) for x in txt])) for k, p in pats.items()}
    out['sources'] = {'share': src, 'credit': credit, 'top': names.most_common(10), 'named': named}

    # ---------- wie komt aan het woord: groep in de zin buiten het citaat zelf (de spreker, niet wie geciteerd wordt) ----------
    spk, parties = {}, {}
    side = {p: [cfg['_speakers'][g] for g in gs] for p, gs in cfg.get('partijen', {}).items()}
    has = lambda s, p: any(x.search(s) for x in side[p])
    only = lambda s, p: has(s, p) and not any(has(s, q) for q in side if q != p)
    for t in order:
        d = real[real['Titel'] == t]
        sents = [s for x in d['Tekst'] for s in sentences(x)]
        said = [QUOTED.sub(' ', s) for s in sents if SPEECH.search(s)]
        spk[t] = {k: float(np.mean([bool(p.search(s)) for s in said])) if said else 0.0 for k, p in cfg['_speakers'].items()}
        spk[t]['_share'] = len(said) / max(1, len(sents))
        if side:
            per = {}
            for p in side:
                mine = [s for s in sents if only(s, p)]
                nw = max(1, sum(len(s.split()) for s in mine))
                per[p] = {'said': sum(only(s, p) for s in said),
                          'head': float(d['Kop'].map(lambda s: only(s, p)).mean()) if len(d) else 0.0,
                          'frames': {k: 1000 * sum(len(f.findall(s)) for s in mine) / nw for k, f in cfg['_frames'].items()}}
            tot = max(1, sum(v['said'] for v in per.values()))
            for v in per.values():
                v['saidShare'] = v['said'] / tot
            parties[t] = per
    out['speakers'], out['parties'] = spk, parties

    # ---------- urgentie (per 1.000 woorden) en koppen met urgentietaal ----------
    urg = {}
    for t in order:
        d = real[real['Titel'] == t]
        txt = (d['Kop'] + ' ' + d['Tekst']).tolist()
        nwords = max(1, sum(len(x.split()) for x in txt))
        urg[t] = {k: 1000 * sum(len(p.findall(x)) for x in txt) / nwords for k, p in cfg['_urgency'].items()}
        urg[t]['_total'] = sum(urg[t].values())
        urg[t]['_head'] = float(d['Kop'].map(lambda s: any(p.search(s) for p in cfg['_urgency'].values())).mean()) if len(d) else 0.0
    out['urgency'] = urg

    # ---------- framing (per 1.000 woorden, zodat lange posts niet vanzelf hoger scoren) ----------
    fr = {}
    persoon = cfg.get('persoon') or ''
    for t in order:
        d = real[real['Titel'] == t]
        txt = (d['Kop'] + ' ' + d['Tekst']).tolist()
        nwords = max(1, sum(len(x.split()) for x in txt))
        fr[t] = {k: 1000 * sum(len(p.findall(x)) for x in txt) / nwords for k, p in cfg['_frames'].items()}
        fr[t]['_own'] = 1000 * sum(len(cfg['_own'].findall(x)) for x in txt) / nwords
        fr[t]['_persoon'] = float(d['Kop'].str.contains(rf'\b{re.escape(persoon)}', regex=True).mean()) if persoon else 0.0
    out['frames'] = fr

    # ---------- taal en kopstijl ----------
    lang = {}
    for t in order:
        d = real[real['Titel'] == t]
        sents = [s for x in d['Tekst'] for s in sentences(x)]
        heads = d['Kop']
        lang[t] = {
            'wordsPerSentence': float(np.mean([len(s.split()) for s in sents])) if sents else 0.0,
            'headWords': float(heads.str.split().str.len().median()),
            'headColon': float(heads.str.contains(':').mean()),
            'headQuote': float(heads.str.contains(r'["“”‘’\']', regex=True).mean()),
            'quoteInText': float(d['Tekst'].str.contains(r'["“”]|,,|\B‘[^’]{8,}’', regex=True).mean()),
        }
    out['lang'] = lang
    out['types'] = typology(out)
    return out, df


TYPES = {
    'Uitslagenticker': 'Korte meldingen in het hoogste tempo. Elke ontwikkeling krijgt direct een eigen post, met weinig beeld of context eromheen.',
    'Snelle citatenstroom': 'Hoog tempo en vaak als eerste. Koppen draaien om wat iemand zegt: een citaat of een dubbele punt.',
    'Beschouwend liveblog': 'Weinig maar lange posts die het nieuws plaatsen, vaak met bron en de naam van de auteur.',
    'Verdiepend liveblog': 'Lager tempo en langere posts dan gemiddeld: minder meldingen, meer uitleg per post.',
    'Beeldgedreven samenvatter': 'Laag tempo en korte posts, maar vaak met foto of video. Volgt het nieuws eerder dan dat het voorop loopt.',
    'Samenvattend liveblog': 'Laag tempo, korte posts en weinig beeld. Vat het nieuws samen nadat het elders is gebracht.',
    'Zakelijke nieuwsdienst': 'Gemiddeld tempo en lengte, korte koppen zonder citaat. Feitelijk en overzichtelijk.',
}


def typology(res):
    """Indeling op tempo, lengte, verrijking, brongebruik en kopstijl, ten opzichte van de mediaan van alle titels."""
    P, L, SRC = res['profile'], res['lang'], res['sources']['share']
    order = res['order']
    med = lambda f: float(np.median([f(t) for t in order]))
    m_tempo, m_len, m_quote, m_src, m_rich = med(lambda t: P[t]['perHour']), med(lambda t: P[t]['medianWords']), \
        med(lambda t: L[t]['headQuote']), med(lambda t: SRC[t]['any']), med(lambda t: P[t]['enriched'])
    top_tempo = max(order, key=lambda t: P[t]['perHour'])
    top_len = max(order, key=lambda t: P[t]['medianWords'])
    out = {}
    for t in order:
        tempo, length, rich = P[t]['perHour'], P[t]['medianWords'], P[t]['enriched']
        if t == top_tempo and length < m_len and rich < m_rich:
            out[t] = 'Uitslagenticker'
        elif t == top_len and SRC[t]['any'] > m_src:
            out[t] = 'Beschouwend liveblog'
        elif tempo > m_tempo and L[t]['headQuote'] > m_quote:
            out[t] = 'Snelle citatenstroom'
        elif length > m_len and tempo < m_tempo:
            out[t] = 'Verdiepend liveblog'
        elif length < m_len and tempo < m_tempo:
            out[t] = 'Beeldgedreven samenvatter' if rich > m_rich else 'Samenvattend liveblog'
        else:
            out[t] = 'Zakelijke nieuwsdienst'
    return out
