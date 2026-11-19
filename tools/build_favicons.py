"""Bouwt favicons.js: een ingebouwde bibliotheek met favicons (128px, als data-URL) per domein.

Opnieuw draaien na het toevoegen van een domein aan HOSTS:
    python tools/build_favicons.py
"""
import base64
import json
import pathlib
import urllib.request

HOSTS = [
    'nu.nl', 'nos.nl', 'nrc.nl', 'telegraaf.nl', 'rtl.nl', 'rtlnieuws.nl',
    'ad.nl', 'volkskrant.nl', 'trouw.nl', 'parool.nl', 'demorgen.be', 'hln.be', '7sur7.be', 'humo.be',
    'bd.nl', 'bndestem.nl', 'gelderlander.nl', 'ed.nl', 'pzc.nl', 'destentor.nl', 'tubantia.nl',
    'fd.nl', 'nltimes.nl', 'hartvannederland.nl', 'linda.nl', 'libelle.nl', 'margriet.nl', 'indebuurt.nl',
]

OUT = pathlib.Path(__file__).resolve().parent.parent / 'favicons.js'


def fetch(host):
    url = f'https://www.google.com/s2/favicons?domain_url=https://www.{host}&sz=128'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=20) as r:
        data = r.read()
        mime = r.headers.get_content_type() or 'image/png'
    return f'data:{mime};base64,{base64.b64encode(data).decode()}'


def main():
    lib = {}
    for host in HOSTS:
        try:
            lib[host] = fetch(host)
            print('ok  ', host)
        except Exception as exc:  # een ontbrekend icoon mag de rest niet tegenhouden
            print('fout', host, exc)
    body = json.dumps(lib, indent=2)
    OUT.write_text(
        '/* Automatisch gegenereerd door tools/build_favicons.py — favicons per domein als data-URL. */\n'
        f'const FAVICONS = {body};\n',
        encoding='utf-8',
    )
    print(f'{len(lib)} favicons geschreven naar {OUT}')


if __name__ == '__main__':
    main()
