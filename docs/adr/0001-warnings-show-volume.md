---
status: accepted
---

# Warnings show volume, not just a floor shape

Elite and Boss attacks hit in 3D: a Blast is a sphere centred where it goes off (half a sphere on a surface, a whole one in mid-air), lanes and cones have a real height, and Shots aim at the jelly in the air or on the ground. So a Warning keeps its flat shape on the floor (the camera looks down at about 60°, and the outline is what says where to step) and adds a faint see-through volume over it showing how high the attack reaches, both filling to the moment of the hit. The volume shows on every graphics tier, phones on Low included, because it is how a player knows whether to jump; it is kept cheap (few triangles, unlit, no depth write) rather than dropped.

## Considered Options

- **Volume only, no floor shape**: from the game's high camera a dome's footprint is hard to read, so it was harder to tell where to stand.
- **Floor shape only, 3D hit areas**: cheapest, but the player would be guessing whether a jump clears an attack.
- **Volumes on Medium and High only**: rejected because the volume carries gameplay information, not decoration.

## Consequences

CLAUDE.md rule 3 (attacks speak one visual language) now covers volumes. Ordinary bugs' warnings (the lanternfly's leap ring, the ladybug's lock-on) stay flat until they get the same treatment.

One exception, by the owner's call (v138): the Cream Whipper's balloon shows only its floor circle, with no sphere round it. The balloon itself, blinking and ticking, shows where the burst is; its Blast is still the whole sphere round it.
