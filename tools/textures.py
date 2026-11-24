"""Makes the apartment's photo textures (assets/textures/*.webp, assigned by src/surfaces.js).

Each entry takes a CC0 colour map, sizes it, and scales its colour (in linear light, per channel) so its
average matches the drawn texture it replaces: the baked light's bounce was worked out with that colour, so
the bake still fits and nothing needs baking again. Credit each source in README's Credits.

    pip install pillow numpy
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

import numpy as np
from PIL import Image

MIRROR = 'https://raw.githubusercontent.com/zuujis-cc0'


def corduroy(size=512, wales=16, seed=5):
    """Corduroy drawn in code (no CC0 fabric set is reachable from the sandbox): round ridges with a
    shadowed groove between them, a little brightness drift from ridge to ridge, and fibre noise that
    runs along the ridges. The same 16 ridges per tile as the drawn sofa, so its repeat is unchanged."""
    rng = np.random.default_rng(seed)
    x = np.arange(size) / size * wales
    ridge = (1 - np.cos(2 * np.pi * x)) / 2                      # 0 in the groove, 1 on the crest
    shade = 0.42 + 0.58 * ridge ** 0.6
    shade = shade * (1 + 0.05 * rng.standard_normal(wales)[x.astype(int) % wales])
    fibre = rng.standard_normal((size, size))
    for _ in range(2):   # smear the noise along the ridges (down the picture), wrapping so the tile repeats
        fibre = (fibre + np.roll(fibre, 1, 0) + np.roll(fibre, -1, 0) + np.roll(fibre, 2, 0) + np.roll(fibre, -2, 0)) / 5
    fibre = fibre / fibre.std()
    img = shade[None, :] * (1 + 0.09 * fibre) * (1 + 0.03 * rng.standard_normal((size, size)))
    g = np.clip(img / 1.15 * 255, 0, 255).astype(np.uint8)
    return Image.fromarray(g, 'L').convert('RGB')


TEXTURES = [
    # the floor in every room (drawn: tools/apartment-source.html floorTex)
    dict(out='floor-laminate', src=f'{MIRROR}/polyhaven-textures-wood-2/main/laminate_floor_02/1k/laminate_floor_02_diff_1k.jpg',
         size=1024, mean=(0.492, 0.4257, 0.36), quality=82),
    # the sofa (drawn: apartment-source.html cordTex, 7 by 7 repeats of 16 ridges)
    dict(out='sofa-corduroy', src=corduroy, size=512, mean=(0.2585, 0.061, 0.0222), quality=80),
    # wood furniture (drawn: woodTex kitT, oakT, walnutT)
    dict(out='veneer-kitchen', src=f'{MIRROR}/polyhaven-textures-wood-2/main/oak_veneer_03/1k/oak_veneer_03_diff_1k.jpg',
         size=512, mean=(0.3787, 0.2613, 0.1768), quality=80),
    dict(out='veneer-oak', src=f'{MIRROR}/polyhaven-textures-wood-2/main/oak_veneer_01/1k/oak_veneer_01_diff_1k.jpg',
         size=512, mean=(0.499, 0.2893, 0.1216), quality=80, turn=True),
    dict(out='veneer-walnut', src=f'{MIRROR}/polyhaven-textures-wood-2/main/natural_walnut_veneer/1k/natural_walnut_veneer_diff_1k.jpg',
         size=512, mean=(0.1305, 0.0477, 0.0168), quality=80),
    # tile: the bathroom wall (white), the dark floor tile, the kitchen backsplash; and the counter
    dict(out='tile-white', src=f'{MIRROR}/polyhaven-textures-ceramic/main/long_white_tiles/1k/long_white_tiles_diff_1k.jpg',
         size=512, mean=(0.874, 0.8712, 0.8528), quality=80),
    dict(out='tile-dark', src=f'{MIRROR}/polyhaven-textures-stone/main/granite_tile/1k/granite_tile_diff_1k.jpg',
         size=512, mean=(0.0248, 0.0259, 0.028), quality=80),
    dict(out='backsplash', src=f'{MIRROR}/polyhaven-textures-ceramic/main/rounded_square_tiled_wall/1k/rounded_square_tiled_wall_diff_1k.jpg',
         size=512, mean=(0.0372, 0.0372, 0.0358), quality=80),
    dict(out='counter-stone', src=f'{MIRROR}/polyhaven-textures-stone-2/main/granite_tile_03/1k/granite_tile_03_diff_1k.jpg',
         size=512, mean=(0.0285, 0.0285, 0.0299), quality=80, crop=(40, 40, 470, 470)),
]

OUT = Path(__file__).resolve().parent.parent / 'assets' / 'textures'


def to_linear(v):
    v = v / 255
    return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4


def to_srgb(v):
    v = min(max(v, 0.0), 1.0)
    return round(255 * (v * 12.92 if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055))


def make(t):
    if callable(t['src']):
        im = t['src']()
    else:
        with urllib.request.urlopen(t['src'], timeout=60) as r:
            im = Image.open(io.BytesIO(r.read())).convert('RGB')
    if t.get('crop'):   # the part to keep, mirrored 2 by 2 so it tiles without a seam
        im = im.crop(t['crop'])
        w, h = im.size
        big = Image.new('RGB', (w * 2, h * 2))
        for i, flip in enumerate([None, Image.FLIP_LEFT_RIGHT, Image.FLIP_TOP_BOTTOM, Image.ROTATE_180]):
            big.paste(im.transpose(flip) if flip is not None else im, ((i % 2) * w, (i // 2) * h))
        im = big
    if t.get('turn'):   # grain along the other way, to match the drawn texture's
        im = im.transpose(Image.ROTATE_90)
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
