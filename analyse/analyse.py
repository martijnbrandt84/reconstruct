"""Tekstanalyse van breaking-news-liveblogs uit een Reconstruct-export.

Voorbeelden:
  python analyse.py reconstruct-posts.csv --config configs/midterms.json --template "Cross-brand leesgedrag tijdens midterms.pptx"
  python analyse.py export.csv --config configs/breaking.json --event "Aanslag Brussel" --slides overzicht eerste bronnen
  python analyse.py export.csv --tabel            (alleen de cijfers in de terminal)
"""
import argparse
import re
import sys
from pathlib import Path
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from liveblogs.analysis import run, load_config
from liveblogs.slides import build, SLIDES

HERE = Path(__file__).parent


def table(res):
    o = res['order']
    P, C, S, L = res['profile'], res['chains'], res['sources']['share'], res['lang']
    df = pd.DataFrame({t: {
        'type': res['types'][t], 'posts': P[t]['posts'], 'per uur': round(P[t]['perHour'], 1), 'woorden': P[t]['medianWords'],
        'verrijking': f"{round(P[t]['enriched'] * 100)}%",
        'eerste': f"{C['first'][t]}/{C['clusters']}", 'achterstand': round(C['medianLag'][t]), 'dekking': f"{round(C['coverage'][t] * 100)}%",
        'bron': f"{round(S[t]['any'] * 100)}%", 'citaat kop': f"{round(L[t]['headQuote'] * 100)}%"} for t in o}).T
    pd.set_option('display.width', 200)
    print(df.to_string())
    print(f"\n{C['clusters']} gedeelde nieuwsmomenten, {C['big']} grote (≥ {C['bigN']} titels). Afgekapte teksten: {', '.join(res['truncated']) or 'geen'}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('csv', help='posts-export uit Reconstruct (CSV-knop in de weergave Tijdlijn)')
    ap.add_argument('--config', default=str(HERE / 'configs' / 'breaking.json'), help='woordenlijsten en instellingen per gebeurtenis')
    ap.add_argument('--event', help='naam van de gebeurtenis (overschrijft de config)')
    ap.add_argument('--persoon', help="persoon voor de kolom 'in de kop' bij wie aan het woord komt (leeg = weglaten)")
    ap.add_argument('--slides', nargs='*', choices=SLIDES, help='alleen deze slides maken')
    ap.add_argument('--template', help='bestaande PowerPoint als sjabloon (de slides daarin worden niet overgenomen)')
    ap.add_argument('--out', help='uitvoermap (standaard output/<event>)')
    ap.add_argument('--tabel', action='store_true', help='alleen de kerncijfers tonen, geen slides')
    a = ap.parse_args()

    cfg = load_config(a.config)
    if a.event:
        cfg['event'] = a.event
    if a.persoon is not None:
        cfg['persoon'] = a.persoon
    res, df = run(a.csv, cfg)
    table(res)
    if a.tabel:
        return
    out = Path(a.out) if a.out else HERE / 'output' / re.sub(r'[^\w\-]+', '-', cfg['event'].lower()).strip('-')
    html_f, pptx_f = build(res, df, cfg, out, a.slides, a.template)
    print('\nklaar:\n ', html_f, '\n ', pptx_f)


if __name__ == '__main__':
    main()
