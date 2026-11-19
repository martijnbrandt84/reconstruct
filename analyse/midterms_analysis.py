"""Midterms-liveblogs: alle analyses; levert één dict met uitkomsten (zie run())."""
import re
from collections import Counter, defaultdict
from urllib.parse import urlparse
import numpy as np
import pandas as pd
from midterms_prep import load, clusters

ORDER = ['HLN', 'VRTNWS', 'NU.nl', 'NOS.nl', 'AD', 'De Morgen', 'Trouw', 'RTL Nieuws', 'de Volkskrant']
BE = {'HLN', 'VRTNWS', 'De Morgen'}
DPG = {'HLN', 'AD', 'De Morgen', 'Trouw', 'de Volkskrant'}

def site(u):
    h = (urlparse(str(u)).hostname or '').lower()
    return '.'.join(h.split('.')[-2:])

def rx(words):
    return re.compile(r'(?<![\w])(' + '|'.join(words) + r')(?![\w])', re.I)

# ---------- bronnen: wie wordt als bron genoemd ----------
SOURCES = {
    'Persbureau': rx([r'ANP', r'AP', r'Associated Press', r'Reuters', r'AFP', r'Belga', r'Bloomberg', r'dpa']),
    'Amerikaanse tv': rx([r'CNN', r'NBC(?: News)?', r'CBS(?: News)?', r'ABC(?: News)?', r'Fox(?: News)?', r'MSNBC']),
    'Amerikaanse krant/site': rx([r'(?:The )?New York Times', r'NYT', r'(?:The )?Washington Post', r'Politico', r'Wall Street Journal',
                                  r'WSJ', r'Axios', r'(?:The )?Guardian', r'Texas Tribune', r'The Hill', r'USA Today']),
    'Data en peilers': rx([r'Decision Desk(?: HQ)?', r'VoteHub', r'exitpoll\w*', r'peiling\w*', r'Edison', r'projectie\w*']),
    'Social media van actoren': rx([r'Truth Social', r'op X', r'(?:via|op) Instagram', r'schreef (?:hij|zij|ze) op', r'Truth']),
    'Eigen correspondent of verslaggever': rx([r'correspondent\w*', r'verslaggever\w*', r'onze reporter', r'ter plaatse']),
}
# ---------- framing ----------
FRAMES = {
    'Wedstrijd': rx([r'wint', r'winnen', r'won', r'winst', r'verlies\w*', r'verliest', r'zege', r'overwinning\w*', r'voorsprong', r'achterstand',
                     r'nek-aan-nek\w*', r'race', r'races', r'verover\w*', r'kantel\w*', r'flip\w*', r'behoud\w*', r'verslaat', r'versloeg', r'toss-up']),
    'Conflict': rx([r'aanval\w*', r'haalt uit', r'uithaal', r'kritiek', r'woede\w*', r'woedend', r'ruzie', r'tier\w*', r'schandaal', r'schandalen',
                    r'afstraf\w*', r'botsing', r'beschuldig\w*', r'verwijt\w*', r'boos', r'aangevallen', r'vendetta', r'tegenstand']),
    'Dramatisering': rx([r'aardverschuiving', r'mokerslag', r'tsunami', r'blauwe golf', r'monsterzege', r'dreun', r'klap', r'verpletter\w*',
                         r'daverend\w*', r'schok\w*', r'verbijster\w*', r'enorm\w*', r'gigantisch\w*', r'historisch\w*', r'ongekend\w*', r'pijnlijk\w*']),
    'Onzekerheid en voorspelling': rx([r'voorspel\w*', r'lijkt', r'lijken', r'verwacht\w*', r'mogelijk', r'waarschijnlijk', r'voorlopig\w*',
                                       r'nog niet', r'onzeker\w*', r'projectie\w*', r'peiling\w*', r'te vroeg']),
    'Duiding': rx([r'waarom', r'wat betekent', r'betekent', r'analyse', r'uitleg', r'snel mee', r'dit weten we', r'waar moet je op letten',
                   r'om in het oog te houden', r'kanttekening', r'teken aan de wand', r'symbool', r'met andere woorden']),
    'Eigen land': rx([r'Nederland\w*', r'Belgi\w*', r'Vlaams\w*', r'Vlaming\w*', r'Leuven\w*', r'Brussel', r'Den Haag', r'Europ\w*', r'EU',
                      r'NAVO', r'Kallas', r'De Wever', r'Schoof', r'kabinet']),
}

def sentences(text):
    return [s for s in re.split(r'(?<=[\.\!\?])\s+(?=[A-Z"\'‘“,])', str(text)) if len(s.split()) >= 3]

def run():
    df = load()
    df, S = clusters(df)
    out = {'n': len(df), 'order': ORDER}
    real = df[~df['placeholder']]

    # ---------- profiel per titel ----------
    prof = {}
    for t in ORDER:
        d = df[df['Titel'] == t].sort_values('t')
        gaps = d['t'].diff().dt.total_seconds().div(60).dropna()
        sess = gaps[gaps <= 120]
        active_h = sess.sum() / 60
        media = d['Media'].value_counts(normalize=True)
        own = d['Liveblog-URL'].iloc[0]
        links = [u for s in d['Links'].dropna() for u in str(s).split() if u.startswith('http')]
        posts_links = d['Links'].fillna('').str.split()
        kinds = Counter()
        for (_, r), ls in zip(d.iterrows(), posts_links):
            ls = [u for u in ls if u.startswith('http')]
            if not ls:
                kinds['none'] += 1
                continue
            mine = [u for u in ls if site(u) == site(own)]
            if not mine:
                kinds['external'] += 1
            elif str(r['Link naar premium']).strip() == 'ja':
                kinds['premium'] += 1
            else:
                kinds['own'] += 1
        prof[t] = {
            'posts': len(d),
            'first': d['t'].min().strftime('%H:%M'), 'last': d['t'].max().strftime('%H:%M'),
            'perHour': len(d) / active_h if active_h else None,
            'medianGap': float(sess.median()),
            'medianWords': float(d['Woorden'].median()),
            'media': {k: float(media.get(k, 0)) for k in ['foto', 'video', 'social', 'dataviz', 'geen']},
            'links': {k: kinds[k] / len(d) for k in ['premium', 'own', 'external', 'none']},
            'nLinks': len(links),
            'hours': d['t'].dt.hour.value_counts().reindex(range(24), fill_value=0).tolist(),
        }
    out['profile'] = prof

    # ---------- nieuwsketens ----------
    cl = df[df['cluster'] >= 0]
    first, follow, lags = Counter(), Counter(), defaultdict(list)
    matrix = defaultdict(Counter)
    big = []
    for cid, g in cl.groupby('cluster'):
        g = g.sort_values('t')
        lead = g.iloc[0]
        first[lead['Titel']] += 1
        for _, r in g.iloc[1:].iterrows():
            follow[r['Titel']] += 1
            lag = (r['t'] - lead['t']).total_seconds() / 60
            lags[r['Titel']].append(lag)
            matrix[lead['Titel']][r['Titel']] += 1
        if g['Titel'].nunique() >= 6:
            big.append({'start': lead['t'].strftime('%H:%M'), 'kop': lead['Kop'],
                        'posts': [{'title': r['Titel'], 'lag': (r['t'] - lead['t']).total_seconds() / 60,
                                   'time': r['t'].strftime('%H:%M'), 'kop': r['Kop']} for _, r in g.iterrows()]})
    exclusive = {}
    for t in ORDER:
        d = real[(real['Titel'] == t) & (real['Woorden'] >= 8)]
        exclusive[t] = float((d['cluster'] < 0).mean())
    out['chains'] = {
        'clusters': int(cl['cluster'].nunique()), 'postsInClusters': int(len(cl)),
        'first': {t: first[t] for t in ORDER}, 'follow': {t: follow[t] for t in ORDER},
        'medianLag': {t: (float(np.median(lags[t])) if lags[t] else None) for t in ORDER},
        'matrix': {a: {b: matrix[a][b] for b in ORDER} for a in ORDER},
        'exclusive': exclusive, 'big': sorted(big, key=lambda b: -len(b['posts'])),
    }

    # ---------- (bijna) identieke tekst: gedeelde kopij ----------
    near = Counter()
    nearPosts = Counter()
    idx = df.index.values
    for i in range(len(df)):
        best = {}
        for j in range(len(df)):
            if i == j or df.at[i, 'Titel'] == df.at[j, 'Titel'] or df.at[i, 'Woorden'] < 25 or df.at[j, 'Woorden'] < 25:
                continue
            if abs(df.at[i, 'min'] - df.at[j, 'min']) > 360:
                continue
            if S[i, j] >= 0.6:
                best[df.at[j, 'Titel']] = True
        if best:
            nearPosts[df.at[i, 'Titel']] += 1
        for t2 in best:
            a, b = sorted([df.at[i, 'Titel'], t2])
            near[(a, b)] += 0.5
    out['copy'] = {
        'pairs': sorted([{'a': a, 'b': b, 'n': int(n)} for (a, b), n in near.items() if n >= 1], key=lambda x: -x['n']),
        'share': {t: nearPosts[t] / max(1, len(real[(real['Titel'] == t) & (real['Woorden'] >= 25)])) for t in ORDER},
    }

    # ---------- bronnen ----------
    src = {}
    credit = {}
    # fotobijschriften en bylines horen niet bij de bronvermelding in de tekst
    clean = lambda s: re.sub(r'\((?:foto|beeld)[^)]*\)|\((?:ANP|Belga|AP|AFP|Reuters|Redactie)[^)]*\)\s*$', ' ', str(s), flags=re.I)
    for t in ORDER:
        d = real[real['Titel'] == t]
        txt = (d['Kop'] + ' ' + d['Tekst'].map(clean)).tolist()
        src[t] = {k: float(np.mean([bool(p.search(x)) for x in txt])) for k, p in SOURCES.items()}
        src[t]['any'] = float(np.mean([any(p.search(x) for p in SOURCES.values()) for x in txt]))
        tail = d['Tekst'].str.strip().str[-60:]
        credit[t] = {
            'bureau': float(tail.str.contains(r'\((?:ANP|Belga|AP|AFP|Reuters|ANP/[A-Z]+|Redactie)\)\s*$|\(Belga\)$', regex=True).mean()),
            'naam': float(tail.str.contains(r'(?:\.|\)|")\s*(?:[A-Z][a-z]+ ){1,2}[A-Z][a-z]+(?: / ANP)?\s*$', regex=True).mean()),
        }
    # meest genoemde losse bronnen over alle titels
    names = Counter()
    for x in (real['Kop'] + ' ' + real['Tekst']):
        for k in ['CNN', 'NBC', 'CBS', 'ABC', 'Fox News', 'New York Times', 'Washington Post', 'Decision Desk', 'AP', 'ANP', 'Reuters',
                  'Belga', 'AFP', 'Truth Social', 'Politico', 'Guardian', 'VoteHub', 'Bloomberg', 'Wall Street Journal']:
            if re.search(r'(?<![\w])' + re.escape(k) + r'(?![\w])', x):
                names[k] += 1
    out['sources'] = {'share': src, 'credit': credit, 'top': names.most_common(12)}

    # ---------- framing ----------
    fr = {}
    for t in ORDER:
        d = real[real['Titel'] == t]
        txt = (d['Kop'] + ' ' + d['Tekst']).tolist()
        nwords = sum(len(x.split()) for x in txt)
        # per 1000 woorden, zodat lange posts niet vanzelf meer framing 'hebben'
        fr[t] = {k: 1000 * sum(len(p.findall(x)) for x in txt) / nwords for k, p in FRAMES.items()}
        fr[t]['Trump in kop'] = float(d['Kop'].str.contains(r'\bTrump', regex=True).mean())
    out['frames'] = fr

    # ---------- taal ----------
    lang = {}
    for t in ORDER:
        d = real[real['Titel'] == t]
        sents = [s for x in d['Tekst'] for s in sentences(x)]
        wps = np.mean([len(s.split()) for s in sents]) if sents else None
        words = [w for x in d['Tekst'] for w in re.findall(r"[A-Za-zÀ-ÿ\-]+", x)]
        heads = d['Kop']
        lang[t] = {
            'wordsPerSentence': float(wps),
            'longWords': float(np.mean([len(w) >= 13 for w in words])),
            'headWords': float(heads.str.split().str.len().median()),
            'headColon': float(heads.str.contains(':').mean()),
            'headQuote': float(heads.str.contains(r'["“”‘’\']', regex=True).mean()),
            'headQuestion': float(heads.str.contains(r'\?').mean()),
            'quoteInText': float(d['Tekst'].str.contains(r'["“”]|,,|\B‘[^’]{8,}’', regex=True).mean()),
            'firstPerson': float(d['Tekst'].str.contains(r'\b(?:ik|we|wij|ons|onze)\b(?![^"“”]*["”])', regex=True, case=False).mean()),
        }
    out['lang'] = lang

    # voorbeeldkoppen voor één nieuwsmoment per titel (framingvergelijking)
    out['examples'] = {}
    for key, pat in {'texas': r'Talarico|Texas', 'trump': r'stembiljet', 'bottoms': r'Bottoms'}.items():
        ex = {}
        for t in ORDER:
            d = real[(real['Titel'] == t) & real['Kop'].str.contains(pat, regex=True)].sort_values('t')
            if len(d):
                ex[t] = {'time': d.iloc[0]['t'].strftime('%H:%M'), 'kop': d.iloc[0]['Kop']}
        out['examples'][key] = ex
    return out, df

if __name__ == '__main__':
    import json
    res, _ = run()
    print(json.dumps(res, ensure_ascii=False, indent=1, default=str)[:20000])
