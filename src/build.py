#!/usr/bin/env python3
"""Construit admin.html et terrain.html (racine du dépôt) à partir des sources de src/.

Usage : python3 src/build.py          → régénère src/build/* puis copie à la racine
        python3 src/build.py --check  → échoue si les fichiers à la racine ne correspondent pas aux sources
"""
import os, shutil, subprocess, sys, filecmp

SRC = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SRC)
OUT = os.path.join(SRC, 'build')
DESIGN = os.path.join(SRC, 'design')


def extract():
    """Extrait le gabarit brut des fichiers Claude Design (ce que assemble.py attend en entrée)."""
    s = open(os.path.join(DESIGN, 'SA Admin.dc.html'), encoding='utf-8').read()
    a = s.index('<x-dc>\n') + len('<x-dc>\n')
    b = s.index('</x-dc>')
    open(os.path.join(OUT, 'admin_markup.txt'), 'w', encoding='utf-8').write(s[a:b])
    # Terrain : seulement le contenu du cadre iPhone (<x-import IOSDevice>), sans le panneau de démo autour.
    s = open(os.path.join(DESIGN, 'SA Terrain.dc.html'), encoding='utf-8').read()
    i = s.index('<x-import component-from-global-scope="IOSDevice"')
    a = s.index('\n', s.index('>', i) + 1) + 1
    b = s.index('\n  </x-import>')
    open(os.path.join(OUT, 'app_markup.txt'), 'w', encoding='utf-8').write(s[a:b])


def main():
    check = '--check' in sys.argv
    os.makedirs(OUT, exist_ok=True)
    for app in ('admin', 'terrain'):
        subprocess.run(['node', '--check', os.path.join(SRC, app, 'app.js')], check=True)
    extract()
    for app in ('admin', 'terrain'):
        subprocess.run([sys.executable, os.path.join(SRC, app, 'assemble.py')], check=True, cwd=OUT)
    bad = []
    for app in ('admin', 'terrain'):
        built, dest = os.path.join(OUT, app + '.html'), os.path.join(ROOT, app + '.html')
        if check:
            if not (os.path.exists(dest) and filecmp.cmp(built, dest, shallow=False)):
                bad.append(app + '.html')
        else:
            shutil.copyfile(built, dest)
            print('→', os.path.relpath(dest, ROOT))
    if bad:
        sys.exit('Désynchronisé des sources : ' + ', '.join(bad) + ' — lancer python3 src/build.py')


if __name__ == '__main__':
    main()
