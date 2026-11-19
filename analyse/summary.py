import sys, json
sys.path.insert(0, r'C:\Users\BRANDT000\Scripts\reconstruct\analyse')
import pandas as pd
from midterms_analysis import run, ORDER
pd.set_option('display.width', 250); pd.set_option('display.max_columns', 30)
r, df = run()
P = pd.DataFrame({t: {'posts': v['posts'], 'perHour': v['perHour'], 'gap': v['medianGap'], 'words': v['medianWords'],
                      **{'m_' + k: x for k, x in v['media'].items()}, **{'l_' + k: x for k, x in v['links'].items()}}
                  for t, v in r['profile'].items()}).T
print(P.round(2))
c = r['chains']
print('clusters', c['clusters'], c['postsInClusters'])
print(pd.DataFrame({'first': c['first'], 'follow': c['follow'], 'lag': c['medianLag'], 'exclusive': c['exclusive']}).round(2))
print(pd.DataFrame(c['matrix']).T)
for b in c['big'][:12]:
    print('--', b['start'], b['kop'][:80], [(p['title'], round(p['lag'])) for p in b['posts']])
print('copy pairs', r['copy']['pairs'][:15])
print('copy share', {k: round(v, 2) for k, v in r['copy']['share'].items()})
print(pd.DataFrame(r['sources']['share']).T.round(2))
print(pd.DataFrame(r['sources']['credit']).T.round(2))
print(r['sources']['top'])
print(pd.DataFrame(r['frames']).T.round(2))
print(pd.DataFrame(r['lang']).T.round(2))
for k, ex in r['examples'].items():
    print('==', k)
    for t, e in ex.items():
        print('  ', t, e['time'], e['kop'][:110])
