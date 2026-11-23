"""Makes the apartment's photo textures (assets/textures/*.webp, assigned by src/surfaces.js).

Each entry takes a CC0 colour map, sizes it, and scales its colour (in linear light, per channel) so its
average matches the drawn texture it replaces: the baked light's bounce was worked out with that colour, so
the bake still fits and nothing needs baking again. Credit each source in README's Credits.

    pip install pillow
    python3 tools/textures.py                 # every entry
    python3 tools/textures.py floor-laminate  # one

The sources come from a CC0 mirror of Poly Haven on GitHub (polyhaven.com itself is blocked from the cloud
sandbox). `mean` is the drawn texture's average in linear light; read it in the game from the material's
map (draw its image to a canvas and average the sRGB-decoded pixels).
"""
import io
import sys
import urllib.request
from pathlib import Path

from PIL import Image

MIRROR = 'https://raw.githubusercontent.com/zuujis-cc0'
TEXTURES = [
    # the floor in every room (drawn: tools/apartment-source.html floorTex)
    dict(out='floor-laminate', src=f'{MIRROR}/polyhaven-textures-wood-2/main/laminate_floor_02/1k/laminate_floor_02_diff_1k.jpg',
         size=1024, mean=(0.492, 0.4257, 0.36), quality=82),
]

OUT = Path(__file__).resolve().parent.parent / 'assets' / 'textures'


def to_linear(v):
    v = v / 255
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def to_srgb(v):
    v = min(max(v, 0.0), 1.0)
    return round(255 * (v * 12.92 if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055))


def make(t):
    with urllib.request.urlopen(t['src'], timeout=60) as r:
        im = Image.open(io.BytesIO(r.read())).convert('RGB')
    im = im.resize((t['size'], t['size']), Image.LANCZOS)
    lin = [[to_linear(i)] for i in range(256)]
    hist = im.histogram()
    bands = []
    for c in range(3):
        counts = hist[c * 256:(c + 1) * 256]
        mean = sum(n * lin[i][0] for i, n in enumerate(counts)) / sum(counts)
        k = t['mean'][c] / mean
        bands.append(im.getchannel(c).point([to_srgb(lin[i][0] * k) for i in range(256)]))
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{t['out']}.webp"
    Image.merge('RGB', bands).save(path, 'WEBP', quality=t['quality'], method=6)
    print(f"{path.relative_to(OUT.parent.parent)}  {path.stat().st_size // 1024} KB")


if __name__ == '__main__':
    only = sys.argv[1:]
    for t in TEXTURES:
        if not only or t['out'] in only:
            make(t)
