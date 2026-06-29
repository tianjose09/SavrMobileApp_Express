"""
Fix all mojibake / garbled characters across every .tsx/.ts file.
Reads as UTF-8, replaces known bad sequences, writes back as UTF-8.
"""
import os, sys

BASE = r'c:\Users\All User\Documents\SAVRMobileApp\SAVR_frontend'

# Ordered from longest to shortest to avoid partial matches
REPLACEMENTS = [
    # â€" = em dash / en dash (most common)
    ('â€”', '–'),   # â€" → –
    ('â€“', '—'),   # â€" → —  (alt mapping)
    # â€™ = right single quote / apostrophe
    ('â€™', "'"),        # â€™ → '
    # â€˜ = left single quote
    ('â€˜', '‘'),   # â€˜ → '
    # â€œ = left double quote
    ('â€œ', '“'),   # â€œ → "
    # â€ = right double quote
    ('â€\x9d', '”'),     # â€ → "
    # â€¦ = ellipsis
    ('â€\xa6', '…'),     # â€¦ → …
    # â‚± = peso sign
    ('â‚\xb1', '₱'),     # â‚± → ₱
    # â"€ = box drawing horizontal (in comments)
    ('â“€', '-'),        # â"€ → -
    # Â followed by space or nothing (non-breaking space artifact)
    ('\xc2\xa0', ' '),
    ('\xc2 ', ' '),
    # Bare Â
    ('\xc2', ''),
]

fixed_files = []

for root, dirs, files in os.walk(BASE):
    dirs[:] = [d for d in dirs if d != 'node_modules']
    for fname in files:
        if not (fname.endswith('.tsx') or fname.endswith('.ts')):
            continue
        path = os.path.join(root, fname)
        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            continue
        orig = content
        for bad, good in REPLACEMENTS:
            content = content.replace(bad, good)
        if content != orig:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            rel = os.path.relpath(path, BASE)
            fixed_files.append(rel)
            sys.stdout.buffer.write(('Fixed: ' + rel + '\n').encode('utf-8'))

sys.stdout.buffer.write(('Total files fixed: ' + str(len(fixed_files)) + '\n').encode('utf-8'))
