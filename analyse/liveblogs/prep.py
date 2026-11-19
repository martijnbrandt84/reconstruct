"""Laden en opschonen van een Reconstruct-export (posts-CSV) en het vinden van gedeelde nieuwsmomenten."""
import re
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer

STOP = set("""de het een en van in op te dat die is voor met zijn aan er om als bij ook niet maar door naar uit
heeft hebben was werd wordt worden zal zou kan al nog dan dit deze of over tot na hij zij ze we wij je u ik hun haar
hem meer veel nu wel geen toch zo daar hier waar wat wie hoe toen omdat terwijl volgens tegen onder sinds tussen
eerste twee drie vier vijf jaar uur procent maandag dinsdag woensdag donderdag vrijdag zaterdag zondag nacht avond
vannacht vanavond vanochtend vandaag ongeveer zegt zei the of and to in""".split())


def glued_headline(kop, tekst):
    """NU.nl plakt kop en eerste zin aan elkaar ('...oprakenOp sommige'); knip op de eerste overgang."""
    m = re.match(r"^(.{8,160}?[a-z\d\.\?!\)'’\"])([A-Z][a-z])", str(tekst or ''))
    if m:
        return m.group(1)
    m = re.match(r"^(.{15,160}?[a-z\d]) (?=(?:De|Het|In|Een|Op|Dat|Die|Met|Voor|Volgens|Ook|Bij|Na|Zo|Er|Hij|Zij|Ze|Daarmee|Nadat|Om|Hoewel|Inmiddels|Namens|Geen)\b)", str(tekst or ''))
    return m.group(1) if m else str(kop or '')


def load(csv):
    df = pd.read_csv(csv, sep=';', encoding='utf-8-sig')
    df['t'] = pd.to_datetime(df['Tijd'])
    for c in ['Kop', 'Tekst', 'Foto-URL', 'Links', 'Link naar premium', 'Liveblog-URL', 'Media']:
        if c not in df:
            df[c] = ''
    df['Kop'] = df['Kop'].fillna('')
    df['Tekst'] = df['Tekst'].fillna('')
    nu = df['Titel'].str.match(r'^NU\.nl$')
    df.loc[nu, 'Kop'] = [glued_headline(k, t).rstrip(' "\'“”‘’:') for k, t in zip(df.loc[nu, 'Kop'], df.loc[nu, 'Tekst'])]
    # lege posts (widget of video zonder tekst) krijgen in Reconstruct 'Liveblog update' als kop
    df['placeholder'] = df['Kop'].str.match(r'^Liveblog update( \d+)?$')
    df = df.sort_values('t').reset_index(drop=True)
    df['min'] = (df['t'] - df['t'].min()).dt.total_seconds() / 60
    return df


def truncated_titles(df, share=0.3):
    """Titels waarvan de tekst in de export vaak is afgekapt ('...'): lengtematen zijn daar ondergrenzen."""
    s = df.groupby('Titel')['Tekst'].apply(lambda x: x.str.rstrip().str.endswith('...').mean())
    return sorted(s[s >= share].index)


def clusters(df, thr=0.32, window=180):
    """Gedeelde nieuwsmomenten: posts van verschillende titels die binnen `window` minuten inhoudelijk op elkaar lijken."""
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
    # sterkste koppelingen eerst; per titel hooguit één post per moment
    pairs.sort(reverse=True)
    members = {i: {i} for i in range(n)}
    for s, i, j in pairs:
        a, b = find(i), find(j)
        if a == b:
            continue
        if {titles[k] for k in members[a]} & {titles[k] for k in members[b]}:
            continue
        # het hele moment blijft binnen het venster, zodat een later vervolg geen 'volger' wordt
        span = [mins[k] for k in members[a] | members[b]]
        if max(span) - min(span) > window:
            continue
        if np.mean([S[x, y] for x in members[a] for y in members[b]]) < thr * 0.75:
            continue
        parent[b] = a
        members[a] |= members.pop(b)
    df = df.copy()
    df['cluster'] = [find(i) for i in range(n)]
    size = df.groupby('cluster')['Titel'].transform('nunique')
    df.loc[size < 2, 'cluster'] = -1
    return df
