"""Slides uit de analyse: PNG per slide (stijl van Reconstruct), een HTML-presentatie en een PowerPoint (optioneel in een bestaand sjabloon)."""
import html
import math
import re
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import quote
from .icons import icons

HERE = Path(__file__).parent
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
FULL = (1920, 920)   # volle breedte onder de titel (20 x 9,58 inch)
SIDE = (1700, 961)   # rechts naast 'Wat zien we?' (14,43 x 8,16 inch)
CSS = (HERE / 'frame.css').read_text(encoding='utf-8')
DECK = (HERE / 'deck.html').read_text(encoding='utf-8')
MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']
DAYS = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag']
DISP = {'VRTNWS': 'VRT NWS'}
TYPE_ICON = {'Uitslagenticker': 'activity', 'Snelle citatenstroom': 'message-square-quote', 'Beschouwend liveblog': 'book-open',
             'Verdiepend liveblog': 'layers', 'Beeldgedreven samenvatter': 'image', 'Samenvattend liveblog': 'list',
             'Zakelijke nieuwsdienst': 'newspaper'}
PARTY_COLOR = ['#C62828', '#1565C0']

esc = lambda s: html.escape(str(s), quote=True)
dn = lambda t: DISP.get(t, t)
pct = lambda x: f"{round(x * 100)}%"
num = lambda x, d=1: f"{x:.{d}f}".replace('.', ',')


def ratio_words(x):
    """0,78 -> 'bijna 8 op de 10'."""
    n = x * 10
    r = round(n)
    lead = 'bijna ' if n < r - .15 else 'ruim ' if n > r + .15 else ''
    return f'{lead}{r} op de 10' if r else 'minder dan 1 op de 10'


def clip(s, n=36):
    s = str(s)
    return s if len(s) <= n else s[:n].rsplit(' ', 1)[0] + ' …'


class Deck:
    def __init__(self, res, df, cfg, out):
        self.r, self.df, self.cfg, self.out = res, df, cfg, Path(out)
        self.order = res['order']
        self.icon = icons(res['hosts'])
        self.real = df[~df['placeholder']]
        s = res['start']
        self.meta = f'{DAYS[s.weekday()]} {s.day} {MONTHS[s.month - 1]} {s.year}'
        if res['end'].date() != s.date():
            e = res['end']
            self.meta += f' – {e.day} {MONTHS[e.month - 1]}'
        self.used = set()
        self.slides = []
        self.advice = {}

    # ------------------------------------------------ bouwstenen
    def ico(self, t, size=30):
        return f'<img class="ico" src="{self.icon[t]}" style="width:{size}px;height:{size}px" alt="">'

    def tname(self, t, size=30):
        return f'<span class="tname">{self.ico(t, size)}<span>{esc(dn(t))}</span></span>'

    @staticmethod
    def img_url(u):
        u = str(u or '').strip()
        # beeldbanken van DPG en andere titels weigeren hotlinks; via dezelfde proxy als Reconstruct
        return f'https://images.weserv.nl/?url={quote(u, safe="")}&w=720&h=405&fit=cover&output=jpg' if u.startswith('http') else ''

    @staticmethod
    def shade(v, vmax):
        t = 0 if vmax <= 0 else max(0, min(1, v / vmax))
        a, b = (0xF7, 0xF2, 0xFA), (0x4F, 0x37, 0x8B)
        c = tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
        return '#%02X%02X%02X' % c, ('#FFFFFF' if t > 0.55 else '#1D1B20')

    def hbars(self, rows, vals, fmt, maxv=None, sub=None, name_w=250, label=None):
        m = maxv or max(vals[r] for r in rows) or 1
        name = label or self.tname
        return '<div class="hbars">' + ''.join(
            f'''<div class="hb-row"><div class="hb-name" style="width:{name_w}px">{name(r)}</div>
            <div class="hb-track"><i style="width:{100 * vals[r] / m:.1f}%;background:#6750A4"></i></div>
            <div class="hb-val">{esc(fmt(vals[r]))}{f'<small>{esc(sub[r])}</small>' if sub else ''}</div></div>''' for r in rows) + '</div>'

    def heatmap(self, rows, cols, val, fmt, col_labels, group=lambda c: c):
        """Kleur per kolom; kolommen met dezelfde group() delen een schaal."""
        gmax = {}
        for c in cols:
            gmax[group(c)] = max(gmax.get(group(c), 0), max(val(r, c) for r in rows))
        maxes = {c: gmax[group(c)] for c in cols}
        body = ''
        for r in rows:
            cells = ''
            for c in cols:
                bg, fg = self.shade(val(r, c), maxes[c])
                f = fmt[c] if isinstance(fmt, dict) else fmt
                cells += f'<td style="background:{bg};color:{fg}">{esc(f(val(r, c)))}</td>'
            body += f'<tr><th class="rowh" style="width:300px">{self.tname(r)}</th>{cells}</tr>'
        head = ''.join(f'<th>{col_labels[c]}</th>' for c in cols)
        return f'<table class="heat"><thead><tr><th style="width:300px"></th>{head}</tr></thead><tbody>{body}</tbody></table>'

    def card(self, r, lag=None, snippet=220, big=False):
        body = re.sub(r'\s+', ' ', str(r['Tekst'] or '')).strip()
        if body.startswith(str(r['Kop'])):
            body = body[len(str(r['Kop'])):].strip()
        body = (body[:snippet].rsplit(' ', 1)[0] + ' …') if len(body) > snippet else body
        src = self.img_url(r['Foto-URL'])
        pic = f'<div class="pic" style="background-image:url(\'{src}\')"></div>' if src else f'<div class="pic none">{self.ico(r["Titel"], 64)}</div>'
        lag_s = '' if lag is None else ('<span class="lag first">eerste</span>' if lag < .5 else f'<span class="lag">+{int(round(lag))} min</span>')
        return f'''<div class="card{' big' if big else ''}">{pic}
          <div class="card-head">{self.tname(r['Titel'], 26)}<span class="time">{r['t']:%H:%M}</span>{lag_s}</div>
          <h3>{esc(r['Kop'])}</h3><p>{esc(body)}</p><div class="foot">{int(r['Woorden'])} woorden</div></div>'''

    def frame(self, size, title, meta, body):
        meta_html = '<span class="sep">·</span>'.join(f'<span>{esc(m)}</span>' for m in [self.meta, *meta])
        return f'''<!doctype html><html lang="nl"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
<style>{CSS}</style></head><body style="width:{size[0]}px;height:{size[1]}px">
<div class="kicker">{esc(self.cfg['event'])}</div><h1>{esc(title)}</h1><div class="meta">{meta_html}</div>
<div class="content">{body}</div>
<script src="https://unpkg.com/lucide@latest"></script><script>window.lucide && lucide.createIcons();</script></body></html>'''

    @staticmethod
    def lucide(name, size=32):
        return f'<i data-lucide="{name}" class="lc" style="width:{size}px;height:{size}px"></i>'

    def type_label(self, name, size=26):
        return f'<span class="type-label">{self.lucide(TYPE_ICON.get(name, "circle"), size)}<span>{esc(name)}</span></span>'

    def mini(self, r):
        """Compacte postkaart: beeld links, kop en begin van de tekst rechts."""
        src = self.img_url(r['Foto-URL'])
        pic = f'<div class="mpic" style="background-image:url(\'{src}\')"></div>' if src else f'<div class="mpic none">{self.ico(r["Titel"], 44)}</div>'
        body = re.sub(r'\s+', ' ', str(r['Tekst'] or '')).strip()
        if body.startswith(str(r['Kop'])):
            body = body[len(str(r['Kop'])):].strip()
        return f'''<div class="mini">{pic}<div class="mtxt"><div class="card-head" style="padding:0">{self.tname(r['Titel'], 24)}<span class="time">{r['t']:%H:%M}</span></div>
          <h3>{esc(r['Kop'])}</h3><p>{esc(clip(body, 150))}</p></div></div>'''

    def moment(self, skip_used=True, min_photos=0):
        """Volgende ongebruikte grote nieuwsmoment (meeste titels eerst)."""
        for m in self.r['chains']['moments']:
            if (skip_used and m['id'] in self.used) or m['photos'] < min_photos:
                continue
            self.used.add(m['id'])
            return m
        return None

    def posts_of(self, m):
        g = self.df[self.df['cluster'] == m['id']].sort_values('t')
        return g, g['t'].iloc[0]

    def add(self, name, title, size, body_title, meta, body, text=None, note=None, advice=None):
        """advice = (icoon, kop, tekst): komt alleen op de adviesslide, met verwijzing naar deze slide.
        Een config kan per slide de kop ('koppen') en het advies ('advies') vervangen."""
        key = name.split('-', 1)[1].replace('-', '_')
        own = (self.cfg.get('advies') or {}).get(key)
        if own:
            advice = (own.get('icoon', advice[0] if advice else 'lightbulb'), own['kop'], own['tekst'])
        if advice:
            self.advice[key] = dict(zip(('icoon', 'kop', 'tekst'), advice), slide=name, body_title=body_title)
        title = (self.cfg.get('koppen') or {}).get(key, title)
        title = title[:1].upper() + title[1:]
        self.slides.append({'name': name, 'title': title, 'size': size, 'text': text, 'note': note,
                            'html': self.frame(size, body_title, meta, body)})

    def extremes(self, f):
        rows = sorted(self.order, key=f)
        return rows[-1], rows[0]

    def leaders(self, f):
        """Namen van alle titels die de hoogste waarde delen ('VRT NWS en HLN')."""
        top = max(f(t) for t in self.order)
        names = [dn(t) for t in self.order if f(t) == top]
        return ' en '.join([', '.join(names[:-1]), names[-1]] if len(names) > 1 else names), len(names) > 1

    # ------------------------------------------------ slides
    def s_overzicht(self):
        r, C, P, SRC, L, F = self.r, self.r['chains'], self.r['profile'], self.r['sources']['share'], self.r['lang'], self.r['frames']
        fast, _ = self.extremes(lambda t: C['firstAll'][t])
        fast_names, fast_many = self.leaders(lambda t: C['first'][t])
        fast_set = [t for t in self.order if C['first'][t] == C['first'][fast]]
        slow, _ = self.extremes(lambda t: C['medianLag'][t])
        tempo, _ = self.extremes(lambda t: P[t]['perHour'])
        longest, shortest = self.extremes(lambda t: P[t]['medianWords'])
        most_src, least_src = self.extremes(lambda t: SRC[t]['any'])
        quote_, _ = self.extremes(lambda t: L[t]['headQuote'])
        cov_hi, cov_lo = self.extremes(lambda t: C['coverage'][t])
        types = r['types']
        ty_line = '; '.join(f'{dn(t)}: {types[t].lower()}' for t in [tempo, longest, fast] if t in types)
        cap = lambda s: re.sub(r'(^|\. )([a-z])', lambda m: m.group(1) + m.group(2).upper(), s)
        top_src = ' en '.join(n for n, _ in r['sources']['top'][:2])
        auto = {
            'eerste': ('zap', f'{fast_names} vaakst als eerste in het liveblog', [*fast_set, slow],
                       f'{fast_names} {"zijn" if fast_many else "is"} elk bij {C["first"][fast]} van de {C["clusters"]} gedeelde nieuwsmomenten de eerste. {dn(slow)} sluit gemiddeld {int(round(C["medianLag"][slow]))} minuten later aan.'
                       if fast_many else
                       f'{dn(fast)} is bij {C["first"][fast]} van de {C["clusters"]} gedeelde nieuwsmomenten de eerste, vaker dan elke andere titel. {dn(slow)} sluit gemiddeld {int(round(C["medianLag"][slow]))} minuten later aan.'),
            'tempo': ('gauge', 'Tempo tegenover lengte', [tempo, longest],
                      f'{dn(tempo)} post {num(P[tempo]["perHour"])} keer per actief uur met {int(P[tempo]["medianWords"])} woorden; {dn(longest)} schrijft de langste posts ({int(P[longest]["medianWords"])} woorden).'),
            'dekking': ('radar', 'Dekking van grote momenten', [cov_hi, cov_lo],
                        f'{dn(cov_hi)} brengt {pct(C["coverage"][cov_hi])} van de {C["big"]} grootste nieuwsmomenten, {dn(cov_lo)} {pct(C["coverage"][cov_lo])}.'),
            'bronnen': ('quote', 'Brongebruik', [most_src, least_src],
                        f'{dn(most_src)} noemt in {pct(SRC[most_src]["any"])} van de posts een bron, {dn(least_src)} in {pct(SRC[least_src]["any"])}. Meest genoemd: {top_src}.'),
            'kopstijl': ('heading', 'Kopstijl', [quote_],
                         f'{dn(quote_)} zet in {pct(L[quote_]["headQuote"])} van de koppen een citaat.'),
            'typen': ('shapes', f'{len(set(types.values()))} typen liveblog', [tempo, longest, fast],
                      f'Op basis van tempo, lengte, verrijking, brongebruik en kopstijl. {ty_line}.'),
        }
        # een config kan eigen, overkoepelende inzichten geven (ook uit ander onderzoek); 'auto' vult een berekend inzicht in
        spec = self.cfg.get('inzichten') or [{'auto': k} for k in auto]
        items = []
        for it in spec[:6]:
            if 'auto' in it:
                ic, h, ts, p = auto[it['auto']]
                items.append((it.get('icoon', ic), it.get('kop', h), ts, p))
            else:
                items.append((it['icoon'], it['kop'], [t for t in it.get('titels', []) if t in self.icon], it['tekst']))
        cards = ''.join(f'''<div class="insight"><div class="ins-head"><span class="ins-icon">{self.lucide(ic, 34)}</span>
            <div class="icons">{"".join(self.ico(t, 30) for t in dict.fromkeys(ts))}</div></div>
            <h3>{esc(h)}</h3><p>{esc(cap(p))}</p></div>''' for ic, h, ts, p in items)
        self.add('00-overzicht', self.cfg.get('inzichten_titel', 'Belangrijkste inzichten uit de tekstanalyse van de liveblogs'), FULL, 'Inzichten op een rij',
                 [f'{r["n"]} posts', f'{len(self.order)} titels'], f'<div class="insights">{cards}</div>')

    def s_nieuwsmoment(self):
        m = self.moment(min_photos=3) or self.moment()
        g, t0 = self.posts_of(m)
        g = g.head(8)
        cards = ''.join(self.card(x, (x['t'] - t0).total_seconds() / 60, snippet=150) for _, x in g.iterrows())
        C = self.r['chains']
        first = g.iloc[0]
        self.add('01-nieuwsmoment', f'Zo meten we snelheid: {C["clusters"]} momenten waarop meerdere liveblogs hetzelfde nieuws brengen', SIDE,
                 'Voorbeeld van een gedeeld nieuwsmoment', [clip(first['Kop'], 50), f'{m["n"]} titels'],
                 f'<div class="cards compact" style="grid-template-columns:repeat(4, 1fr);grid-template-rows:1fr 1fr">{cards}</div>',
                 ['Wat zien we?',
                  f'Om {t0:%H:%M} brengt {dn(first["Titel"])} als eerste: “{clip(first["Kop"], 80)}”. Binnen {int(round(m["posts"][-1]["lag"]))} minuten volgen nog {m["n"] - 1} liveblogs met hetzelfde nieuws.',
                  'Zo’n reeks posts noemen we een gedeeld nieuwsmoment: posts van verschillende titels die binnen drie uur inhoudelijk op elkaar lijken (vergelijking van kop en begin van de tekst). Elke titel telt één keer per moment.',
                  f'In totaal vinden we {C["clusters"]} van zulke momenten met samen {C["postsInClusters"]} posts. De titel met de vroegste post is de eerste; de rest volgt met een achterstand in minuten.'])

    def s_eerste(self):
        C = self.r['chains']
        fa, lag = C['firstAll'], C['medianLag']
        n = C['clusters']
        parts = [('firstAll', 'Eerste', '#6750A4'), ('followAll', 'Volger', '#B69DF8'), ('missedAll', 'Niet in het liveblog', '#E6E0E9')]
        rows = ''
        for t in sorted(self.order, key=lambda t: (-fa[t], -C['followAll'][t])):
            segs = ''.join(f'<i style="width:{100 * C[k][t]:.2f}%;background:{c}">{pct(C[k][t]) if C[k][t] >= .08 else ""}</i>' for k, _, c in parts)
            rows += f'''<div class="hb-row"><div class="hb-name" style="width:230px">{self.tname(t)}</div><div class="hb-stack">{segs}</div>
              <div class="hb-val compact">{C['first'][t]}× eerste<small>{C['first'][t] + C['follow'][t]} van {n} gebracht</small></div></div>'''
        legend = '<div class="legend">' + ''.join(f'<span><i style="background:{c}"></i>{esc(l)}</span>' for _, l, c in parts) + '</div>'
        body = f'''<div class="duo" style="grid-template-columns:1.5fr 1fr">
          <div><h2>Rol bij alle gedeelde nieuwsmomenten</h2><p class="sub">Een moment dat een titel niet brengt, telt mee als gemist</p>{legend}
            <div class="hbars">{rows}</div></div>
          <div><h2>Achterstand als de titel volgt</h2><p class="sub">Mediaan aantal minuten na de eerste post</p>
            {self.hbars(sorted(self.order, key=lambda t: lag[t]), lag, lambda v: f'{int(round(v))} min', name_w=230)}</div></div>'''
        lead, many = self.leaders(lambda t: C['first'][t])
        lags = sorted(lag[t] for t in self.order if C['follow'][t])
        self.add('02-eerste', f'{lead} {"brengen" if many else "brengt"} gedeeld nieuws het vaakst als eerste in het liveblog', FULL,
                 'Wie brengt gedeeld nieuws als eerste', [f'{n} gedeelde nieuwsmomenten'], body,
                 note='Eerste in een liveblog is niet hetzelfde als eerste met het nieuws: pushberichten, artikelen en tv vallen hier buiten.',
                 advice=('timer', 'Minuten zijn klein, context is groot',
                         f'Een volger zit meestal {int(round(lags[0]))} tot {int(round(lags[-1]))} minuten achter de eerste. '
                         'Wie later is, kan het verschil maken met wat de melding betekent of wat er nu volgt.'))

    def s_ketens(self):
        C = self.r['chains']
        ms = sorted([m for m in C['moments'] if m['n'] >= 3][:5], key=lambda m: m['start'])
        if not ms:
            return
        w, h, cap = FULL[0] - 120, 660, 180
        label_w, pad_t, pad_b, pad_r = 470, 22, 52, 80
        rh = (h - pad_t - pad_b) / len(ms)
        pw = w - label_w - pad_r
        X = lambda v: label_w + pw * (min(v, cap) / cap) ** 0.5
        T = lambda x, y, s, size, fill, anchor='middle', weight=400: (
            f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" fill="{fill}" text-anchor="{anchor}" font-weight="{weight}" dominant-baseline="middle">{esc(s)}</text>')
        out = []
        for v in (0, 5, 15, 30, 60, 120, 180):
            out.append(f'<line x1="{X(v):.1f}" y1="{pad_t}" x2="{X(v):.1f}" y2="{h - pad_b}" stroke="#E6E0E9" stroke-width="1.5"/>')
            out.append(T(X(v), h - pad_b + 28, f'+{v} min' if v else 'eerste', 21, '#49454F'))
        for i, m in enumerate(ms):
            cy = pad_t + i * rh + rh / 2
            out.append(T(label_w - 34, cy - 15, clip(m['kop'], 34), 24, '#1D1B20', 'end', 500))
            out.append(T(label_w - 34, cy + 17, f"{m['start']:%H:%M} · {m['n']} titels", 20, '#49454F', 'end'))
            out.append(f'<line x1="{label_w}" y1="{cy:.1f}" x2="{label_w + pw}" y2="{cy:.1f}" stroke="#79747E" stroke-width="2"/>')
            placed = []
            for p in m['posts']:
                x = X(p['lag'])
                # eerst boven of onder de lijn uitwijken, daarna een stukje naar rechts
                while True:
                    lvl = next((l for l in (0, -1, 1) if not any(abs(x - px) < 44 and pl == l for px, pl in placed)), None)
                    if lvl is not None:
                        break
                    x += 22
                placed.append((x, lvl))
                yy = cy + lvl * 42
                out.append(f'<circle cx="{x:.1f}" cy="{yy:.1f}" r="21" fill="#FFFFFF" stroke="#CAC4D0" stroke-width="1.5"/>')
                out.append(f'<image href="{self.icon[p["title"]]}" x="{x - 14:.1f}" y="{yy - 14:.1f}" width="28" height="28"/>')
        svg = f'<svg viewBox="0 0 {w} {h}" width="{w}" height="{h}" font-family="Roboto, sans-serif">{"".join(out)}</svg>'
        quick = sum(1 for m in ms for p in m['posts'][1:] if p['lag'] <= 15) / max(1, sum(len(m['posts']) - 1 for m in ms))
        self.add('03-ketens', f'Bij de grootste momenten volgt {ratio_words(quick)} titels binnen een kwartier', FULL,
                 'Nieuwsketens bij grote momenten', ['minuten na de eerste post', 'tijdas op wortelschaal'], svg,
                 advice=('layers', 'Onderscheid zit in wat je toevoegt',
                         'Bij grote momenten brengt bijna iedereen binnen korte tijd dezelfde melding. Een eigen bron, beeld of uitleg maakt de post herkenbaar als die van jouw titel.'))

    def s_dekking(self):
        C = self.r['chains']
        if not C['big']:
            return
        cov = C['coverage']
        hi, lo = self.extremes(lambda t: cov[t])
        n = C['big']
        self.add('04-dekking', f'{dn(hi)} brengt {pct(cov[hi])} van de grootste nieuwsmomenten in het liveblog, {dn(lo)} {pct(cov[lo])}', FULL,
                 'Dekking van grote nieuwsmomenten', [f'{n} momenten bij minstens {C["bigN"]} titels'],
                 self.hbars(sorted(self.order, key=lambda t: -cov[t]), cov, pct, 1, sub={t: f'{round(cov[t] * n)} van {n}' for t in self.order}),
                 note='Een titel kan een moment ook in een artikel of push hebben gebracht; hier telt alleen het liveblog.',
                 advice=('list-checks', 'Leg verwachte momenten vooraf vast',
                         'Een lijst met momenten die zeker komen (persconferenties, officiële cijfers, toespraken) helpt om geen groot moment in het liveblog te missen.'))

    def s_tempo(self):
        P = self.r['profile']
        trunc = set(self.r['truncated'])
        w, h = FULL[0] - 120, 680
        pad = {'l': 110, 'r': 60, 't': 20, 'b': 90}
        pw, ph = w - pad['l'] - pad['r'], h - pad['t'] - pad['b']
        def nice(v):
            mag = 10 ** math.floor(math.log10(v / 5))
            step = next(f * mag for f in (1, 2, 2.5, 5, 10) if v / 5 <= f * mag)
            return step * math.ceil(v / step), step
        mx, sx = nice(max(P[t]['perHour'] for t in self.order) * 1.1)
        my, sy = nice(max(P[t]['medianWords'] for t in self.order) * 1.1)
        X = lambda v: pad['l'] + pw * v / mx
        Y = lambda v: pad['t'] + ph - ph * v / my
        T = lambda x, y, s, size, fill, anchor='middle', weight=400, extra='': (
            f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" fill="{fill}" text-anchor="{anchor}" font-weight="{weight}" dominant-baseline="middle" {extra}>{esc(s)}</text>')
        out = []
        k = 0
        while k * sx <= mx + 1e-9:
            out.append(f'<line x1="{X(k * sx):.1f}" y1="{pad["t"]}" x2="{X(k * sx):.1f}" y2="{pad["t"] + ph}" stroke="#E6E0E9"/>')
            out.append(T(X(k * sx), pad['t'] + ph + 28, num(k * sx, 0 if sx >= 1 else 1), 21, '#49454F'))
            k += 1
        k = 0
        while k * sy <= my + 1e-9:
            out.append(f'<line x1="{pad["l"]}" y1="{Y(k * sy):.1f}" x2="{pad["l"] + pw}" y2="{Y(k * sy):.1f}" stroke="#E6E0E9"/>')
            out.append(T(pad['l'] - 16, Y(k * sy), str(int(k * sy)), 21, '#49454F', 'end'))
            k += 1
        out.append(f'<line x1="{pad["l"]}" y1="{pad["t"] + ph}" x2="{pad["l"] + pw}" y2="{pad["t"] + ph}" stroke="#79747E" stroke-width="2"/>')
        out.append(T(pad['l'] + pw / 2, h - 18, 'Posts per actief uur', 22, '#1D1B20', 'middle', 500))
        out.append(T(26, pad['t'] + ph / 2, 'Woorden per post (mediaan)', 22, '#1D1B20', 'middle', 500, f'transform="rotate(-90 26 {pad["t"] + ph / 2})"'))
        pmax = max(P[t]['posts'] for t in self.order)
        pts = []
        for t in sorted(self.order, key=lambda t: -P[t]['posts']):
            r_ = 22 + 20 * (P[t]['posts'] / pmax) ** .5
            x, y = X(P[t]['perHour']), Y(P[t]['medianWords'])
            pts.append((t, x, y, r_))
            dash = ' stroke-dasharray="6 4"' if t in trunc else ''
            out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r_:.1f}" fill="#EADDFF" stroke="#6750A4" stroke-width="2"{dash}/>')
            out.append(f'<image href="{self.icon[t]}" x="{x - r_ * .55:.1f}" y="{y - r_ * .55:.1f}" width="{r_ * 1.1:.1f}" height="{r_ * 1.1:.1f}"/>')
        # label op de eerste plek (rechts, links, boven, onder) die geen bol of ander label raakt
        boxes = []
        hit = lambda b, c: b[0] < c[2] and c[0] < b[2] and b[1] < c[3] and c[1] < b[3]
        for t, x, y, r_ in pts:
            lab = dn(t) + (' *' if t in trunc else '')
            tw, th = 12.5 * len(lab), 30
            options = [('start', x + r_ + 10, y, (x + r_ + 6, y - th / 2, x + r_ + 14 + tw, y + th / 2)),
                       ('end', x - r_ - 10, y, (x - r_ - 14 - tw, y - th / 2, x - r_ - 6, y + th / 2)),
                       ('middle', x, y - r_ - 20, (x - tw / 2, y - r_ - 36, x + tw / 2, y - r_ - 4)),
                       ('middle', x, y + r_ + 20, (x - tw / 2, y + r_ + 4, x + tw / 2, y + r_ + 36))]
            bubbles = [(ox - orr, oy - orr, ox + orr, oy + orr) for o, ox, oy, orr in pts if o != t]
            anchor, lx, ly, box = next((o for o in options if not any(hit(o[3], b) for b in bubbles + boxes)), options[0])
            boxes.append(box)
            out.append(T(lx, ly, lab, 22, '#1D1B20', anchor, 500))
        svg = f'<svg viewBox="0 0 {w} {h}" width="{w}" height="{h}" font-family="Roboto, sans-serif">{"".join(out)}</svg>'
        tempo, _ = self.extremes(lambda t: P[t]['perHour'])
        longest, _ = self.extremes(lambda t: P[t]['medianWords'])
        note = (f'* {", ".join(dn(t) for t in sorted(trunc))}: tekst in de export afgekapt, de echte lengte ligt hoger. ' if trunc else '') + 'Grootte = aantal posts; pauzes van meer dan 2 uur tellen niet mee.'
        self.add('05-tempo', f'{dn(tempo)} post het vaakst en kort; {dn(longest)} kiest voor minder en langere posts', FULL,
                 'Tempo tegenover lengte', ['posts per actief uur en woorden per post'], svg, note=note,
                 advice=('list', 'Vat samen voor wie later instapt',
                         f'Bij {num(P[tempo]["perHour"])} posts per uur scrolt een nieuwe lezer door veel korte meldingen. Een vaste samenvattende post bovenaan helpt om snel bij te blijven.'))

    def s_invalshoek(self):
        F = self.r['frames']
        own = {t: F[t]['_own'] for t in self.order}
        pat = self.cfg['_own']
        picks = []
        for t in sorted(self.order, key=lambda t: -own[t])[:4]:
            d = self.real[(self.real['Titel'] == t) & self.real['Kop'].map(lambda s: bool(pat.search(s)))].copy()
            if len(d):
                d['foto'] = d['Foto-URL'].astype(str).str.startswith('http')
                picks.append(self.mini(d.sort_values(['foto', 't'], ascending=[False, True]).iloc[0]))
        hi, lo = self.extremes(lambda t: own[t])
        body = f'''<div class="split"><div style="display:flex;flex-direction:column"><div class="panel" style="margin:0 0 10px">Verwijzingen per 1.000 woorden</div>
          {self.hbars(sorted(self.order, key=lambda t: -own[t]), own, lambda v: num(v, 1), name_w=230)}</div>
          <div class="minis">{''.join(picks)}</div></div>'''
        self.add('16-invalshoek', f'{dn(hi)} legt het vaakst een link met eigen land of Europa, {dn(lo)} het minst', FULL,
                 'Eigen invalshoek', ['woorden als België, Nederland, Europa, EU, kabinet'], body,
                 advice=('map-pin', 'De eigen invalshoek heeft niemand anders',
                         'Persbureaus en buitenlandse media leveren de melding; wat het betekent voor lezers hier, moet de redactie zelf toevoegen. '
                         f'{dn(hi)} doet dat {num(own[hi])} keer per 1.000 woorden.'))

    def s_bronnen(self):
        SRC = self.r['sources']['share']
        keys = list(self.cfg['bronnen']) + ['any']
        labels = {k: k.replace(' ', '<br>', 1) for k in self.cfg['bronnen']}
        labels['any'] = 'Minstens<br>één bron'
        rows = sorted(self.order, key=lambda t: -SRC[t]['any'])
        hi = rows[0]
        # afgekapte teksten noemen minder bronnen dan er staan; niet als laagste in de kop zetten
        lo = next((t for t in reversed(rows) if t not in self.r['truncated']), rows[-1])
        self.add('09-bronnen', f'{dn(hi)} noemt in {ratio_words(SRC[hi]["any"])} posts een bron, {dn(lo)} in {ratio_words(SRC[lo]["any"])}', FULL,
                 'Brongebruik per titel', ['aandeel posts dat een bron noemt', 'kleur per kolom'],
                 self.heatmap(rows, keys, lambda t, k: SRC[t][k], pct, labels),
                 note='Fotobijschriften en ondertekening als (ANP) of (Belga) tellen niet mee.',
                 advice=('quote', 'Noem de bron in de melding',
                         'Een bron kost een paar woorden en maakt een melding controleerbaar, zeker bij cijfers en uitslagen die later nog kunnen veranderen.'))

    def s_bronnen_titel(self):
        N = self.r['sources']['named']
        cols = [n for n, c in self.r['sources']['top'][:9] if c]
        if len(cols) < 2:
            return
        fav = {t: max(cols, key=lambda k: N[t][k]) for t in self.order}
        lead = sorted((t for t in self.order if N[t][fav[t]] > 0), key=lambda t: -N[t][fav[t]])[:3]
        if len({fav[t] for t in lead}) > 1:
            title = 'Elke titel noemt eigen bronnen: ' + ', '.join(f'{dn(t)} vooral {fav[t]}' for t in lead)
        else:
            title = f'{cols[0]} is in bijna elk liveblog de meest genoemde bron'
        trunc = self.r['truncated']
        note = 'Aandeel posts waarin de bron bij naam voorkomt. Ondertekening als (ANP) telt mee, fotobijschriften niet.'
        if trunc:
            note += f' {", ".join(dn(t) for t in trunc)}: tekst afgekapt, aandelen zijn een ondergrens.'
        self.add('10-bronnen-titel', title, FULL, 'Meest genoemde bronnen per titel', ['aandeel posts', 'kleur per kolom'],
                 self.heatmap(self.order, cols, lambda t, k: N[t][k], pct, {k: esc(k) for k in cols}), note=note,
                 advice=('scale', 'Zet bronnen naast elkaar',
                         f'Wie bij uitslagen of cijfers twee bronnen noemt (bijvoorbeeld {cols[0]} én {cols[1]}), laat lezers zien hoe zeker een melding is en waar die vandaan komt.'))

    def s_framing(self):
        F = self.r['frames']
        keys = list(self.cfg['frames'])
        labels = {k: f'{esc(k)}<br><small>{esc(v["uitleg"])}</small>' for k, v in self.cfg['frames'].items()}
        mean = {k: sum(F[t][k] for t in self.order) / len(self.order) for k in keys}
        top, low = max(keys, key=mean.get), min(keys, key=mean.get)
        n_top = sum(1 for t in self.order if max(keys, key=lambda k: F[t][k]) == top)
        who = 'Alle liveblogs' if n_top == len(self.order) else f'{n_top} van de {len(self.order)} liveblogs'
        advice = None
        if 'Duiding' in keys:
            advice = ('lightbulb', 'Plan een duidingspost na elk groot moment',
                      f'Duidende woorden komen gemiddeld {num(mean["Duiding"])} keer per 1.000 woorden voor. Een korte post over wat een moment betekent, helpt lezers die later instappen.')
        self.add('14-framing', f'{who} kaderen het nieuws vooral als {top.lower()}; {low.lower()} komt het minst voor', FULL,
                 'Framing in kop en tekst', ['woorden per 1.000 woorden', 'kleur per kolom'],
                 self.heatmap(self.order, keys, lambda t, k: F[t][k], lambda v: num(v, 1), labels), advice=advice)

    def s_sprekers(self):
        S = self.r['speakers']
        groups = list(self.cfg.get('sprekers') or {})
        if not groups:
            return
        p = self.cfg.get('persoon')
        keys = ['_share'] + groups
        val = lambda t, k: S[t][k]
        labels = {g: esc(g).replace(' ', '<br>', 1) for g in groups}
        labels['_share'] = 'Zinnen met<br>een uitspraak'
        fm = {k: pct for k in keys}
        mean = {g: sum(S[t][g] for t in self.order) / len(self.order) for g in groups}
        ranked = sorted(groups, key=lambda g: -mean[g])
        low = ranked[-2:]
        small = lambda g: g if p and g.startswith(p) else g[0].lower() + g[1:]
        self.add('11-sprekers', f'{ranked[0]} en {ranked[1]} komen het vaakst aan het woord, {small(low[0])} en {small(low[1])} nauwelijks', FULL,
                 'Wie komt aan het woord', ['aandeel van de zinnen met een uitspraak', 'kleur per kolom'],
                 self.heatmap(self.order, keys, val, fm, labels),
                 note='Zin met een uitspraak: aanhalingstekens of een werkwoord als zegt, stelt of schrijft. Een zin kan bij meer groepen horen.',
                 advice=('users', 'Laat meer stemmen horen',
                         f'{low[0]}: gemiddeld {pct(mean[low[0]])} van de uitspraken; {small(low[1])}: {pct(mean[low[1]])}. '
                         'Een kenner die duidt of een stem van buiten de politiek onderscheidt het liveblog van de meldingen die elke titel heeft.'))

    def diverge(self, rows, vals, names, fmt):
        """Twee balken vanuit het midden: vals[t] = (links, rechts)."""
        m = max(max(vals[t]) for t in rows) or 1
        head = (f'<div class="dv-row dv-head"><div class="hb-name" style="width:230px"></div><div class="dv-l" style="color:{PARTY_COLOR[0]}">{esc(names[0])}</div>'
                f'<div class="dv-r" style="color:{PARTY_COLOR[1]}">{esc(names[1])}</div></div>')
        body = ''.join(
            f'''<div class="dv-row"><div class="hb-name" style="width:230px">{self.tname(t)}</div>
              <div class="dv-l"><span>{esc(fmt(vals[t][0]))}</span><i style="width:{80 * vals[t][0] / m:.1f}%;background:{PARTY_COLOR[0]}"></i></div>
              <div class="dv-r"><i style="width:{80 * vals[t][1] / m:.1f}%;background:{PARTY_COLOR[1]}"></i><span>{esc(fmt(vals[t][1]))}</span></div></div>''' for t in rows)
        return f'<div class="hbars">{head}{body}</div>'

    def s_partijen(self):
        Pa = self.r.get('parties') or {}
        if not Pa:
            return
        a, b = list(self.cfg['partijen'])
        said = {t: (Pa[t][a]['saidShare'], Pa[t][b]['saidShare']) for t in self.order}
        head = {t: (Pa[t][a]['head'], Pa[t][b]['head']) for t in self.order}
        rows = sorted(self.order, key=lambda t: said[t][1] - said[t][0])
        more_a = sum(said[t][0] > said[t][1] for t in self.order)
        head_b = sum(head[t][1] > head[t][0] for t in self.order)
        body = f'''<div class="duo">
          <div><h2>Wie krijgt het woord</h2><p class="sub">Aandeel van de uitspraken van een van beide kanten</p>{self.diverge(rows, said, (a, b), pct)}</div>
          <div><h2>Wie haalt de kop</h2><p class="sub">Aandeel koppen over alleen die kant</p>{self.diverge(rows, head, (a, b), pct)}</div></div>'''
        self.add('12-partijen', f'{b} halen in {head_b} van de {len(self.order)} liveblogs vaker de kop, maar {a} krijgen in {more_a} van de {len(self.order)} vaker het woord', FULL,
                 'Republikeinen en Democraten', [f'{a}: ook {", ".join(g for g in self.cfg["partijen"][a] if g != a)}'], body,
                 note='Uitspraak: de partij staat in de zin buiten het citaat zelf, dus bij de spreker. Zinnen die beide kanten noemen tellen niet mee.')

    def s_persoon(self):
        p = self.cfg.get('persoon')
        if not p:
            return
        F = self.r['frames']
        share = {t: F[t]['_persoon'] for t in self.order}
        hi, lo = self.extremes(lambda t: share[t])
        ex = []
        for t in sorted(self.order, key=lambda t: -share[t])[:4]:
            d = self.real[(self.real['Titel'] == t) & self.real['Kop'].str.contains(rf'\b{re.escape(p)}', regex=True)].copy()
            if len(d):
                d['foto'] = d['Foto-URL'].astype(str).str.startswith('http')
                ex.append(self.mini(d.sort_values(['foto', 't'], ascending=[False, True]).iloc[0]))
        body = f'''<div class="split"><div style="display:flex;flex-direction:column">{self.hbars(sorted(self.order, key=lambda t: -share[t]), share, pct, name_w=230)}</div>
          <div class="minis">{''.join(ex)}</div></div>'''
        self.add('13-persoon', f'{dn(hi)} zet {p} in {pct(share[hi])} van de koppen, {dn(lo)} in {pct(share[lo])}', FULL,
                 f'{p} in de kop', [f'aandeel koppen met {p}'], body)

    def s_framing_partij(self):
        Pa = self.r.get('parties') or {}
        if not Pa:
            return
        a, b = list(self.cfg['partijen'])
        mean = lambda p, k: sum(Pa[t][p]['frames'][k] for t in self.order) / len(self.order)
        # alleen frames die vaak genoeg voorkomen; bij een paar treffers is het verschil ruis
        gap = {k: (mean(a, k) - mean(b, k)) / (mean(a, k) + mean(b, k)) for k in self.cfg['frames'] if mean(a, k) + mean(b, k) >= 3}
        fa, fb = max(gap, key=gap.get), min(gap, key=gap.get)
        keys = [(k, p) for k in (fa, fb) for p in (a, b)]
        labels = {(k, p): f'{esc(k)}<br><small style="color:{PARTY_COLOR[(a, b).index(p)]}">over {esc(p)}</small>' for k, p in keys}
        # voorbeelden: posts waarin de kop over alleen die kant het frame draagt
        sp, fr = self.cfg['_speakers'], self.cfg['_frames']
        side = {p: [sp[g] for g in gs] for p, gs in self.cfg['partijen'].items()}
        only = lambda s, p: any(x.search(s) for x in side[p]) and not any(x.search(s) for q in side if q != p for x in side[q])
        picks, seen = [], set()
        for k, p in ((fa, a), (fb, b)):
            hits = self.real[self.real['Kop'].map(lambda s: only(s, p) and bool(fr[k].search(s)))].copy()
            hits['foto'] = hits['Foto-URL'].astype(str).str.startswith('http')
            n = 0
            for _, x in hits.sort_values(['foto', 't'], ascending=[False, True]).iterrows():
                if x['Titel'] not in seen and n < 2:
                    seen.add(x['Titel'])
                    picks.append(self.mini(x))
                    n += 1
        body = f'''<div class="split" style="grid-template-columns:1.15fr 1fr"><div style="display:flex;flex-direction:column;min-height:0">
          {self.heatmap(self.order, keys, lambda t, kp: Pa[t][kp[1]]['frames'][kp[0]], lambda v: num(v, 1), labels, group=lambda kp: kp[0])}</div>
          <div class="minis">{''.join(picks)}</div></div>'''
        self.add('15-framing-partij', f'{fa} kleeft aan {a}, {fb.lower()} aan {b}', FULL, 'Framing per partij',
                 ['woorden per 1.000 woorden in zinnen over alleen die kant', 'kleur per frame'], body)

    def s_urgentie(self):
        U = self.r['urgency']
        conf = self.cfg.get('urgentie') or {}
        if not conf:
            return
        groups = list(conf)
        keys = groups + ['_head']
        labels = {k: f'{esc(k)}<br><small>{esc(v["uitleg"])}</small>' for k, v in conf.items()}
        labels['_head'] = 'Kop met<br>urgentietaal'
        fm = {k: (lambda v: num(v, 1)) for k in groups}
        fm['_head'] = pct
        rows = sorted(self.order, key=lambda t: -U[t]['_total'])
        pats = list(self.cfg['_urgency'].values())
        # 'nu' is vaak een voegwoord; voorbeelden liever met spanning of vooruitblik
        strong = pats[1:] or pats
        picks = []
        for t in rows[:3]:
            d = self.real[self.real['Titel'] == t].copy()
            both = d['Kop'] + ' ' + d['Tekst']
            d['u'] = both.map(lambda s: sum(len(p.findall(s)) for p in pats))
            d['s'] = both.map(lambda s: sum(len(p.findall(s)) for p in strong))
            d['k'] = d['Kop'].map(lambda s: any(p.search(s) for p in strong))
            d['foto'] = d['Foto-URL'].astype(str).str.startswith('http')
            d = d[d['u'] > 0]
            if len(d):
                picks.append(self.mini(d.sort_values(['k', 's', 'foto'], ascending=False).iloc[0]))
        body = f'''<div class="split" style="grid-template-columns:1.15fr 1fr"><div style="display:flex;flex-direction:column;min-height:0">
          {self.heatmap(rows, keys, lambda t, k: U[t][k], fm, labels)}</div><div class="minis">{''.join(picks)}</div></div>'''
        title = f'{dn(rows[0])} en {dn(rows[1])} gebruiken de meeste urgentietaal'
        advice = None
        if 'Vooruitblik' in conf:
            ahead = max(U[t]['Vooruitblik'] for t in self.order)
            if ahead < 1:
                title += '; vooruitblikken op wat komt zijn zeldzaam'
            advice = ('calendar-clock', 'Zeg wat er nog komt',
                      f'Woorden als “straks” of “elk moment” komen hooguit {num(ahead)} keer per 1.000 woorden voor. '
                      'Lezers vertellen wanneer het volgende moment komt, geeft hun een reden om terug te komen.')
        self.add('07-urgentie', title, FULL, 'Urgentie in kop en tekst', ['woorden per 1.000 woorden', 'kleur per kolom'], body,
                 note='“Nu” telt ook in zinnen als “nu de stemmen geteld zijn”; vergelijk daarom vooral de titels onderling.',
                 advice=advice)

    def s_koppen(self):
        ms = [self.moment() for _ in range(2)]
        ms = [m for m in ms if m]
        if len(ms) < 2:
            return
        cols = ''
        for m in ms:
            g, _ = self.posts_of(m)
            rows = ''.join(f'<tr><td class="tm">{x["t"]:%H:%M}</td><td class="tt">{self.tname(x["Titel"], 26)}</td><td>{esc(x["Kop"])}</td></tr>' for _, x in g.iterrows())
            cols += f'<div><h2>{esc(clip(g.iloc[0]["Kop"], 60))}</h2><table class="heads">{rows}</table></div>'
        self.add('08-koppen', 'Zelfde nieuws, andere kop: zo kiest elke titel een eigen ingang', FULL, 'Zelfde nieuws, andere kop',
                 ['twee gedeelde nieuwsmomenten', 'kop per titel'], f'<div class="duo">{cols}</div>')

    def s_taal(self):
        L = self.r['lang']
        keys = ['headWords', 'headColon', 'headQuote', 'quoteInText', 'wordsPerSentence']
        labels = {'headWords': 'Woorden<br>in de kop', 'headColon': 'Dubbele punt<br>in de kop', 'headQuote': 'Citaat<br>in de kop',
                  'quoteInText': 'Citaat<br>in de tekst', 'wordsPerSentence': 'Woorden<br>per zin'}
        fm = {k: pct for k in keys}
        fm['headWords'] = lambda v: str(int(v))
        fm['wordsPerSentence'] = lambda v: num(v, 1)
        q, _ = self.extremes(lambda t: L[t]['headQuote'])
        _, short = self.extremes(lambda t: L[t]['headWords'])
        trunc = self.r['truncated']
        self.add('06-taal', f'{dn(q)} zet het vaakst een citaat in de kop; {dn(short)} houdt koppen het kortst', FULL,
                 'Taal en kopstijl', ['mediaan of aandeel per titel', 'kleur per kolom'],
                 self.heatmap(self.order, keys, lambda t, k: L[t][k], fm, labels),
                 note=f'{", ".join(dn(t) for t in trunc)}: tekst in de export afgekapt; woorden per zin is daar een ondergrens.' if trunc else None,
                 advice=('heading', 'Test een feitelijke kop naast een citaatkop',
                         f'Bij {dn(q)} staat in {pct(L[q]["headQuote"])} van de koppen een citaat. Dat valt op, maar neemt ook de woorden van de spreker over. '
                         'Een A/B-test laat zien welke kop lezers meer aanspreekt.'))

    def s_typen(self):
        r, P, L, SRC = self.r, self.r['profile'], self.r['lang'], self.r['sources']['share']
        from .analysis import TYPES
        groups = {}
        for t in self.order:
            groups.setdefault(r['types'][t], []).append(t)
        def rng(f, ts, fm):
            v = sorted(f(t) for t in ts)
            return fm(v[0]) if fm(v[0]) == fm(v[-1]) else f'{fm(v[0])}–{fm(v[-1])}'
        cards = ''
        for name in TYPES:
            ts = groups.get(name)
            if not ts:
                continue
            facts = (f"{rng(lambda t: P[t]['perHour'], ts, lambda v: num(v, 1))} posts per actief uur, "
                     f"{rng(lambda t: P[t]['medianWords'], ts, lambda v: str(int(v)))} woorden per post, "
                     f"{rng(lambda t: P[t]['enriched'], ts, pct)} met verrijking.")
            cards += f'''<div class="type"><h3>{self.type_label(name, 30)}</h3><div class="titles">{''.join(self.tname(t, 28) for t in ts)}</div>
              <p class="desc">{esc(TYPES[name])}</p><p class="facts">{esc(facts)}</p></div>'''
        fast = max(self.order, key=lambda t: P[t]['perHour'])
        deep = max(self.order, key=lambda t: P[t]['medianWords'])
        span = f', van {r["types"][fast].lower()} tot {r["types"][deep].lower()}' if r['types'][fast] != r['types'][deep] else ''
        self.add('17-typen', f'{len(groups)} typen liveblog{span}', FULL, 'Typen liveblog',
                 ['ten opzichte van de mediaan van alle titels', 'verrijking = foto, video, social embed of datavisualisatie'], f'<div class="types">{cards}</div>')

    def s_voorbeelden(self):
        types = self.r['types']
        best = None
        for m in self.r['chains']['moments']:
            present = {types[p['title']] for p in m['posts']}
            if best is None or len(present) > best[1]:
                best = (m, len(present))
        m = best[0]
        g, t0 = self.posts_of(m)
        seen, cols = set(), ''
        for _, x in g.iterrows():
            ty = types[x['Titel']]
            if ty in seen:
                continue
            seen.add(ty)
            cols += f'''<div style="display:flex;flex-direction:column;gap:8px;min-height:0;min-width:0"><div class="panel type-head">{self.type_label(ty, 24)}</div>
              {self.card(x, (x["t"] - t0).total_seconds() / 60, snippet=200, big=True)}</div>'''
        self.add('18-voorbeelden', f'Hetzelfde nieuws in {len(seen)} typen liveblog', FULL, 'Voorbeeldposts per type',
                 [clip(g.iloc[0]['Kop'], 60), f'eerste melding {t0:%H:%M}'],
                 f'<div class="cards narrow" style="grid-template-columns:repeat({len(seen)}, minmax(0, 1fr))">{cols}</div>')

    def s_advies(self):
        want = self.cfg.get('advies_volgorde') or ['tempo', 'ketens', 'urgentie', 'sprekers', 'framing', 'bronnen_titel']
        keys = [k for k in want if k in self.advice]
        keys += [k for k in self.advice if k not in keys]
        if not keys:
            return
        cards = ''.join(f'''<div class="insight"><div class="ins-head"><span class="ins-icon">{self.lucide(self.advice[k]["icoon"], 34)}</span>
            <span class="chapter">{esc(self.advice[k]["body_title"])}</span></div>
            <h3>{esc(self.advice[k]["kop"])}</h3><p>{esc(self.advice[k]["tekst"])}</p></div>''' for k in keys[:6])
        self.add('19-advies', 'Wat redacties kunnen testen bij het volgende grote nieuwsmoment', FULL, 'Om te testen',
                 ['afgeleid uit de tekstanalyse', 'zonder leescijfers per post: ideeën om te toetsen, geen bewezen effecten'],
                 f'<div class="insights">{cards}</div>')

    def s_aanpak(self):
        trunc = self.r['truncated']
        steps = [
            ('Data', f"{self.r['n']} posts van {len(self.order)} liveblogs, opgehaald met Reconstruct: tijd, kop, tekst, media en links."),
            ('Gedeelde nieuwsmomenten', f"Posts van verschillende titels die binnen {self.cfg['clusters']['venster']} minuten inhoudelijk op elkaar lijken (tf-idf op kop en begin van de tekst, cosinus ≥ {num(self.cfg['clusters']['drempel'], 2)})."),
            ('Bronnen, framing en taal', 'Geteld met vaste woordenlijsten per gebeurtenis, ook voor wie aan het woord komt en urgentie. Per 1.000 woorden of per zin, zodat lange posts niet vanzelf hoger scoren.'),
            ('Eerste is niet eerste overall', 'Alleen liveblogposts: pushberichten, artikelen, apps en tv vallen erbuiten.'),
            ('Eén gebeurtenis', 'Verschillen zijn indicaties, geen vaste patronen.'),
            ('Data-eigenaardigheden', (f'{", ".join(dn(t) for t in trunc)}: tekst afgekapt in de export. ' if trunc else '') + 'Bij NU.nl is de kop afgeleid uit de tekst.'),
        ]
        body = '<div class="steps">' + ''.join(f'<div class="step"><h3>{esc(h)}</h3><p>{esc(p)}</p></div>' for h, p in steps) + '</div>'
        self.add('20-aanpak', 'Aanpak en kanttekeningen bij de tekstanalyse', FULL, 'Aanpak en kanttekeningen', ['tekstanalyse in Python'], body)

    # ------------------------------------------------ uitvoer
    def render(self):
        img = self.out / 'slides'
        img.mkdir(parents=True, exist_ok=True)
        for old in img.glob('*'):
            old.unlink()
        for s in self.slides:
            page, png = img / f"{s['name']}.html", img / f"{s['name']}.png"
            page.write_text(s['html'], encoding='utf-8')
            # Edge headless crasht af en toe bij het afsluiten; opnieuw proberen tot er een PNG is
            for _ in range(4):
                png.unlink(missing_ok=True)
                with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as prof:
                    subprocess.run([EDGE, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
                                    f"--window-size={s['size'][0]},{s['size'][1]}", '--virtual-time-budget=12000', f'--user-data-dir={prof}',
                                    f'--screenshot={png}', page.resolve().as_uri()], capture_output=True, timeout=120)
                if png.exists() and png.stat().st_size > 10000:
                    break
            else:
                raise RuntimeError(f"geen screenshot voor {s['name']}")
            s['png'] = png
            print('  slide', s['name'])
        # pas aan het eind opruimen: Edge houdt de pagina soms nog even vast
        for page in img.glob('*.html'):
            try:
                page.unlink()
            except PermissionError:
                pass

    def write_html(self):
        S = 96
        parts = []
        for s in self.slides:
            if s['text']:
                txt = ''.join(f'<p{" class=first" if i == 0 else ""}>{esc(p)}</p>' for i, p in enumerate(s['text']))
                body = (f'<div class="txt" style="left:{.63 * S}px;top:{2.30 * S}px;width:{4.17 * S}px;height:{8.16 * S}px">{txt}</div>'
                        f'<img src="slides/{s["png"].name}" style="left:{4.96 * S}px;top:{2.30 * S}px;width:{14.43 * S}px">')
            else:
                body = f'<img src="slides/{s["png"].name}" style="left:0;top:{1.77 * S}px;width:{20 * S}px">'
            note = f'<div class="note" style="left:{.63 * S}px;top:{10.5 * S}px">{esc(s["note"])}</div>' if s['note'] else ''
            parts.append(f'<section class="slide"><h2 style="left:{.63 * S}px;top:{.63 * S}px;width:{18.77 * S}px">{esc(s["title"])}</h2>{body}{note}</section>')
        f = self.out / 'presentatie.html'
        f.write_text(DECK.replace('{{SLIDES}}', '\n'.join(parts)).replace('Midterms: tekstanalyse liveblogs', f"{self.cfg['event']}: tekstanalyse liveblogs"), encoding='utf-8')
        return f

    def write_pptx(self, template=None):
        from pptx import Presentation
        from pptx.util import Inches, Pt
        if template and Path(template).exists():
            prs = Presentation(template)
            ids = prs.slides._sldIdLst
            for sid in list(ids):   # bestaande slides weg; layouts, thema en lettertypes blijven
                prs.part.drop_rel(sid.rId)
                ids.remove(sid)
            layout = next((l for l in prs.slide_layouts if l.name == 'TITLE_ONLY_1_1'), prs.slide_layouts[0])
        else:
            prs = Presentation()
            prs.slide_width, prs.slide_height = Inches(20), Inches(11.358)
            layout = prs.slide_layouts[5]
        for s in self.slides:
            sl = prs.slides.add_slide(layout)
            for ph in list(sl.placeholders):
                if ph.placeholder_format.type != 1:
                    ph._element.getparent().remove(ph._element)
            title = sl.shapes.title
            title.left, title.top, title.width, title.height = Inches(.63), Inches(.63), Inches(18.77), Inches(1.47)
            title.text = s['title']
            for p in title.text_frame.paragraphs:
                for run in p.runs:
                    run.font.size = Pt(48)
            if s['text']:
                tf = sl.shapes.add_textbox(Inches(.63), Inches(2.30), Inches(4.17), Inches(8.16)).text_frame
                tf.word_wrap = True
                for i, para in enumerate(s['text']):
                    p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
                    p.space_after = Pt(10)
                    run = p.add_run()
                    run.text, run.font.name, run.font.size, run.font.bold = para, 'Inter', Pt(18), i == 0
                sl.shapes.add_picture(str(s['png']), Inches(4.96), Inches(2.30), width=Inches(14.43))
            else:
                sl.shapes.add_picture(str(s['png']), Inches(0), Inches(1.77), width=Inches(20))
            if s['note']:
                run = sl.shapes.add_textbox(Inches(.63), Inches(10.50), Inches(18.77), Inches(.47)).text_frame.paragraphs[0].add_run()
                run.text, run.font.name, run.font.size = 'Noot: ' + s['note'], 'Inter', Pt(16)
        f = self.out / f"{self.cfg['event']} - tekstanalyse liveblogs.pptx"
        prs.save(f)
        return f


SLIDES = ['overzicht', 'nieuwsmoment', 'eerste', 'ketens', 'dekking', 'tempo', 'taal', 'urgentie', 'koppen',
          'bronnen', 'bronnen_titel', 'sprekers', 'partijen', 'persoon', 'framing', 'framing_partij', 'invalshoek',
          'typen', 'voorbeelden', 'advies', 'aanpak']


def build(res, df, cfg, out, only=None, template=None):
    deck = Deck(res, df, cfg, out)
    # volgorde van berekenen: voorbeeldmomenten eerst kiezen, zodat koppen en ketens andere momenten tonen
    for key in SLIDES:
        if not only or key in only:
            getattr(deck, f's_{key}')()
    deck.slides.sort(key=lambda s: s['name'])
    deck.render()
    return deck.write_html(), deck.write_pptx(template)
