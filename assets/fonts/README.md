# Fonts

Self-hosted so the game never waits on a font service. Both are SIL Open Font License 1.1 (the `*-OFL.txt` beside each).

- `fredoka.woff2`: Fredoka, the display face for every heading (variable, weights 500 to 600).
- `inter.woff2`: Inter, the text face (variable, weights 400 to 700).

Each is cut to Latin (Basic Latin, Latin-1, dashes, quotes, ellipsis, arrows), with kerning, ligatures and tabular numbers kept.
Made from `@fontsource-variable/fredoka` and `@fontsource-variable/inter` 5.3.0 with fontTools:

```
python3 -m fontTools.varLib.instancer <font> wght=500:600 -o f.ttf     # Inter: wght=400:700
pyftsubset f.ttf --unicodes="U+0020-007E,U+00A0-00FF,U+2013-2014,U+2018-201D,U+2022,U+2026,U+2039-203A,U+2190-2193,U+2212,U+2248" \
  --layout-features='kern,liga,tnum' --flavor=woff2 --no-hinting --desubroutinize --output-file=fredoka.woff2
```

A character outside the cut falls back to the system font, so player text should stay inside it (emoji always come from the system).
