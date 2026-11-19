import sys
sys.path.insert(0, r'C:\Users\BRANDT000\Scripts\reconstruct\analyse')
from midterms_prep import load, clusters

df = load()
print(df.loc[df['Titel'] == 'NU.nl', 'Kop'].head(8).tolist())
thr = float(sys.argv[1]) if len(sys.argv) > 1 else 0.32
c, S = clusters(df, thr)
g = c[c['cluster'] >= 0].groupby('cluster')
print('clusters', g.ngroups, 'posts in clusters', (c['cluster'] >= 0).sum())
print(g['Titel'].nunique().value_counts().sort_index())
import random
random.seed(1)
for cid in random.sample(list(g.groups), 12):
    sub = g.get_group(cid).sort_values('t')
    print('---')
    for _, r in sub.iterrows():
        print(f"  {r['t']:%H:%M} {r['Titel']:<14} {r['Kop'][:90]}")
