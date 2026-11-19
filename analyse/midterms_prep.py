"""Midterms-liveblogs: gedeelde voorbereiding (laden, opschonen, nieuwsclusters)."""
import re
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer

CSV = r'C:\Users\BRANDT000\Downloads\reconstruct-posts-2026-11-19.csv'

STOP = set("""de het een en van in op te dat die is voor met zijn aan er om als bij ook niet maar door naar uit
heeft hebben was werd wordt worden zal zou kan al nog dan dit deze of over tot na hij zij ze we wij je u ik hun haar
hem meer veel nu wel geen toch zo daar hier waar wat wie hoe toen omdat terwijl volgens tegen onder sinds tussen
eerste twee drie vier vijf jaar uur procent dinsdag woensdag nacht avond vannacht vanavond ongeveer zegt zei
the of and to in""".split())

def nu_headline(kop, tekst):
    """NU.nl plakt kop en eerste zin aan elkaar ('...oprakenOp sommige'); splits op de eerste kleine->hoofdletter-overgang."""
    m = re.match(r"^(.{8,160}?[a-z\d\.\?!\)'’\"])([A-Z][a-z])", str(tekst or ''))
    if m:
        return m.group(1)
    # soms met spatie: knip voor een typisch zinsbegin
    m = re.match(r"^(.{15,160}?[a-z\d]) (?=(?:De|Het|In|Een|Op|Dat|Die|Met|Voor|Volgens|Ook|Bij|Na|Zo|Er|Hij|Zij|Ze|Daarmee|Nadat|Om|Hoewel|Inmiddels|Namens|Geen)\b)", str(tekst or ''))
    return m.group(1) if m else str(kop or '')

def load():
    df = pd.read_csv(CSV, sep=';', encoding='utf-8-sig')
    df['t'] = pd.to_datetime(df['Tijd'])
    df['Kop'] = df['Kop'].fillna('')
    df['Tekst'] = df['Tekst'].fillna('')
    nu = df['Titel'] == 'NU.nl'
    df.loc[nu, 'Kop'] = [nu_headline(k, t) for k, t in zip(df.loc[nu, 'Kop'], df.loc[nu, 'Tekst'])]
    # lege NU-posts (widget/video zonder tekst) hebben 'Liveblog update' als kop
    df['placeholder'] = df['Kop'].str.match(r'^Liveblog update( \d+)?$')
    df['min'] = (df['t'] - df['t'].dt.normalize()).dt.total_seconds() / 60
    df = df.sort_values('t').reset_index(drop=True)
    return df

def clusters(df, thr=0.32, window=180):
    """Nieuwsclusters: posts van verschillende titels die binnen `window` minuten inhoudelijk op elkaar lijken."""
    text = (df['Kop'] + ' ' + df['Kop'] + ' ' + df['Tekst'].str.slice(0, 400)).str.lower()
    vec = TfidfVectorizer(stop_words=list(STOP), ngram_range=(1, 2), min_df=2, sublinear_tf=True,
                          token_pattern=r"(?u)\b[a-zà-ÿ][a-zà-ÿ\-']{2,}\b")
    X = vec.fit_transform(text)
    S = (X @ X.T).toarray()
    n = len(df)
    parent = list(range(n))
    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a
    titles = df['Titel'].values
    mins = df['min'].values
    ok = ~df['placeholder'].values & (df['Woorden'].values >= 8)
    pairs = []
    for i in range(n):
        if not ok[i]:
            continue
        for j in range(i + 1, n):
            if mins[j] - mins[i] > window:
                break
            if ok[j] and titles[i] != titles[j] and S[i, j] >= thr:
                pairs.append((S[i, j], i, j))
    # sterkste koppelingen eerst; per titel maximaal één post per cluster (voorkomt ketens)
    pairs.sort(reverse=True)
    members = {i: {i} for i in range(n)}
    for s, i, j in pairs:
        a, b = find(i), find(j)
        if a == b:
            continue
        ta = {titles[k] for k in members[a]}
        tb = {titles[k] for k in members[b]}
        if ta & tb:
            continue
        # het hele cluster blijft binnen het tijdvenster, zodat een later vervolg geen 'volger' wordt
        span = [mins[k] for k in members[a] | members[b]]
        if max(span) - min(span) > window:
            continue
        # complete-linkage light: gemiddelde gelijkenis tussen beide groepen moet hoog genoeg blijven
        avg = np.mean([S[x, y] for x in members[a] for y in members[b]])
        if avg < thr * 0.75:
            continue
        parent[b] = a
        members[a] |= members.pop(b)
    df = df.copy()
    df['cluster'] = [find(i) for i in range(n)]
    size = df.groupby('cluster')['Titel'].transform('nunique')
    df.loc[size < 2, 'cluster'] = -1
    return df, S
