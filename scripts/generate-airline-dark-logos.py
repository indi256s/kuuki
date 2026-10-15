"""Generate reviewed dark-theme logo derivatives. Requires Python 3 and Pillow.

Run from the workspace root. Originals and alpha channels stay intact; bright
brand colors are preserved. Review sheets and selection metrics go to .scratch.
"""

import colorsys
import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'packages/data/src/airlines.json'
ASSETS = ROOT / 'apps/next/public/airlines'
REVIEW = ROOT / '.scratch/airline-logos'
INK = (241, 239, 235)  # styles.css dark --text


def strength(rgb):
    r, g, b = (v / 255 for v in rgb)
    hue, lightness, saturation = colorsys.rgb_to_hls(r, g, b)
    neutral = saturation < 0.22
    navy = 205 <= hue * 360 <= 275
    if not (neutral or navy):
        return 0
    # Fade out through gray/navy highlights instead of cutting antialiased edges.
    ceiling = 0.64 if neutral else 0.40
    return max(0, min(1, (ceiling - lightness) / 0.15))


def main():
    rows = json.loads(CATALOG.read_text())
    selected = []
    REVIEW.mkdir(parents=True, exist_ok=True)
    for sheet in REVIEW.glob('dark-sheet-*.png'):
        sheet.unlink()
    for row in rows:
        previous = row.pop('logoDarkUrl', None)
        if previous:
            (ASSETS / Path(previous).name).unlink(missing_ok=True)
        if not row.get('logoUrl'):
            continue
        # Reviewed backings, outlines and noisy gradients lose internal contrast.
        if row['iata'] in {'BI', 'MI', 'RO', 'SX', 'VU', 'W6', 'W4',
                           'F3', 'HA', 'HW', 'P4', 'PG', 'PR', 'W3', 'WB',
                           '8M', 'E8', 'GE', 'QA', 'SY'}:
            continue
        source = ASSETS / Path(row['logoUrl']).name
        original = Image.open(source).convert('RGBA')
        pixels = list(original.getdata())
        weight = sum(p[3] / 255 for p in pixels)
        changed = sum(p[3] / 255 * strength(p[:3]) for p in pixels)
        # Opaque header backings already support their white wordmarks.
        corners = [original.getpixel(p) for p in
                   [(0, 0), (original.width - 1, 0),
                    (0, original.height - 1), (original.width - 1, original.height - 1)]]
        backed = all(p[3] > 240 for p in corners)
        if backed or not weight or changed / weight < 0.18:
            continue
        adapted = original.copy()
        adapted.putdata([
            tuple(round(v + (target - v) * strength(p[:3]))
                  for v, target in zip(p[:3], INK)) + (p[3],)
            for p in pixels
        ])
        assert adapted.getchannel('A').tobytes() == original.getchannel('A').tobytes()
        for before, after in zip(pixels, adapted.getdata()):
            if strength(before[:3]) == 0:
                assert before == after
        filename = f"{row['iata']}.dark.png"
        adapted.save(ASSETS / filename, optimize=True)
        row['logoDarkUrl'] = f'/airlines/{filename}'
        selected.append({'iata': row['iata'], 'name': row['name'],
                         'adaptedInkFraction': round(changed / weight, 3)})

    CATALOG.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n')
    REVIEW.mkdir(parents=True, exist_ok=True)
    (REVIEW / 'dark-selection.json').write_text(json.dumps(selected, indent=2) + '\n')
    for start in range(0, len(selected), 24):
        batch = selected[start:start + 24]
        sheet = Image.new('RGB', (1040, ((len(batch) + 3) // 4) * 110), '#282828')
        draw = ImageDraw.Draw(sheet)
        for index, row in enumerate(batch):
            x, y = index % 4 * 260, index // 4 * 110
            draw.text((x + 8, y + 4), f"{row['iata']} {row['name']}"[:35], fill='#f1efeb')
            for col, suffix in enumerate(['', '.dark']):
                logo = Image.open(ASSETS / f"{row['iata']}{suffix}.png").convert('RGBA')
                logo.thumbnail((116, 58))
                sheet.paste(logo, (x + col * 130 + (130 - logo.width) // 2, y + 27), logo)
                draw.text((x + col * 130 + 8, y + 90), 'Before' if col == 0 else 'After', fill='#aaa49c')
        sheet.save(REVIEW / f'dark-sheet-{start // 24}.png')
    print(f'{len(selected)} dark variants; alpha and untouched-color checks passed')


if __name__ == '__main__':
    main()
