"""
Replace UTF-8 mojibake sequences in all .tsx/.ts screen files.
These appear when UTF-8 smart quotes/dashes were saved as Latin-1.
"""
import os, re

BASE = r'c:\Users\All User\Documents\SAVRMobileApp\SAVR_frontend'

REPLACEMENTS = [
    # Smart apostrophe / right single quote
    ('â€™', "'"),
    # Em dash
    ('â€"', '—'),
    # En dash
    ('â€"', '–'),
    # Left double quote
    ('â€œ', '“'),
    # Right double quote
    ('â€\x9d', '”'),
    # Left single quote
    ('â€˜', '‘'),
    # Ellipsis
    ('â€¦', '…'),
    # Non-breaking space artifact
    ('Â\xa0', ' '),
    ('Â ', ' '),
    # Peso sign (already fixed but catch stragglers)
    ('\xc3\xa2\xe2\x80\x9a\xc2\xb1', '₱'),
    # Bare Â with nothing useful after
    ('Â', ''),
]

fixed_files = []
total_replacements = 0

for root, dirs, files in os.walk(BASE):
    # Skip node_modules
    dirs[:] = [d for d in dirs if d != 'node_modules']
    for fname in files:
        if not (fname.endswith('.tsx') or fname.endswith('.ts')):
            continue
        path = os.path.join(root, fname)
        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception:
            continue

        orig = content
        count = 0
        for bad, good in REPLACEMENTS:
            if bad in content:
                n = content.count(bad)
                content = content.replace(bad, good)
                count += n

        if content != orig:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            rel = os.path.relpath(path, BASE)
            fixed_files.append((rel, count))
            total_replacements += count
            print(f'Fixed ({count} replacements): {rel}')

print(f'\nTotal: {total_replacements} replacements in {len(fixed_files)} files')
