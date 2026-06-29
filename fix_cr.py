"""
Fix mojibake in CreateRequest.tsx and TrackMyRequest.tsx.
Reads file as Latin-1 (preserves every byte), does replacements,
writes back as UTF-8.
"""

files = [
    r'c:\Users\All User\Documents\SAVRMobileApp\SAVR_frontend\screens\Requests\CreateRequest.tsx',
    r'c:\Users\All User\Documents\SAVRMobileApp\SAVR_frontend\screens\Requests\TrackMyRequest.tsx',
]

# Each tuple: (bad bytes as latin-1 string, correct UTF-8 replacement string)
REPLACEMENTS = [
    # â‚± → ₱  (peso sign U+20B1, UTF-8: E2 82 B1, read as latin-1 = â ‚ ±)
    ('\xe2\x82\xb1', '₱'),
    # â€" → –  (en dash U+2013, UTF-8: E2 80 93, read as latin-1 = â € ")
    ('\xe2\x80\x93', '–'),
    # â€" → —  (em dash U+2014, UTF-8: E2 80 94, read as latin-1 = â € ")
    ('\xe2\x80\x94', '—'),
    # â€™ → '  (right single quote U+2019)
    ('\xe2\x80\x99', "'"),
    # â"€ → -   (box drawing ─ U+2500, UTF-8: E2 94 80)
    ('\xe2\x94\x80', '-'),
]

for path in files:
    # Read as latin-1 so every byte maps 1:1 to a character
    with open(path, 'r', encoding='latin-1') as f:
        content = f.read()
    orig = content
    count = 0
    for bad, good in REPLACEMENTS:
        if bad in content:
            n = content.count(bad)
            content = content.replace(bad, good)
            count += n
            print(f'  {repr(bad)} to {repr(good)} ({n}x)')
    if content != orig:
        # Write back as UTF-8
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Fixed ({count} replacements): {path.split(chr(92))[-1]}')
    else:
        print(f'No change: {path.split(chr(92))[-1]}')
