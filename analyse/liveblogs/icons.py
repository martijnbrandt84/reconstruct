"""Titeliconen zoals in Reconstruct: eerst de ingebouwde favicons, anders eenmalig ophalen en lokaal bewaren."""
import base64
import re
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[2]
CACHE = Path(__file__).resolve().parents[1] / 'icons'


def _library():
    s = (ROOT / 'favicons.js').read_text(encoding='utf8')
    return dict(re.findall(r'"([\w.\-]+)":\s*"(data:image/[^"]+)"', s))


def icons(hosts):
    """hosts: {titel: domein}. Geeft per titel een data-URL, of de favicon-URL als ophalen niet lukt."""
    lib = _library()
    out = {}
    CACHE.mkdir(exist_ok=True)
    for title, host in hosts.items():
        if host in lib:
            out[title] = lib[host]
            continue
        f = CACHE / f'{host}.png'
        url = f'https://www.google.com/s2/favicons?domain={host}&sz=128'
        if not f.exists():
            try:
                r = requests.get(url, timeout=20)
                r.raise_for_status()
                f.write_bytes(r.content)
            except requests.RequestException:
                # bedrijfsproxy breekt de TLS-controle van Python; de browser laadt de URL dan zelf
                out[title] = url
                continue
        out[title] = 'data:image/png;base64,' + base64.b64encode(f.read_bytes()).decode()
    return out
