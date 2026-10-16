# Fire spell rework — v172

## Research and interpretation

- [Riot: Sound Design](https://www.riotgames.com/en/artedu/sound-design)
  describes sound as feedback that communicates what happened, and discusses
  changing a sound's parts to change what it communicates.
- [Riot: Visual Effects](https://www.riotgames.com/vi/artedu/visual-effects)
  stresses clear actions and states, cohesive identity, and restraint.
- [Fusehive's published fantasy sound list](https://www.asoundeffect.com/wp-content/uploads/2023/05/Fusehive_Fantasy_RPG_Sound_Effects_Library_Bundle-Content_Full-Corrected.pdf)
  separates fireball charging, shooting/whoosh, flying loops, and impact assets.
- [RawAmbience fire spell library](https://sonniss.com/sound-effects/elemental-fire-spell-casting-sfx/)
  also distinguishes casts, charges and impacts. This is a reference for phase
  separation, not a purchase or a claim that we auditioned its sounds.

Our application: each phase needs a distinct envelope and a real gameplay
trigger. The prior recording continued after contact, while generic hit sounds
competed with fire feedback. The previous death was mainly a particle burst.
Research informed the sequence below; it does not certify its subjective sound.
No external library assets were downloaded or purchased.

## Revised sequence

1. Release: existing immediate firing and jelly pulse; the owner's recording
   starts here, with a short opening swell and small pitch variation.
2. Travel: the recording drops to a quieter bed. Its voice is owned by the
   projectile and fades over 45 ms on contact, expiry, wall collision or reset.
   Simultaneous launches share the existing 90 ms gate; at most three recordings.
3. Contact: a short noise snap, filtered midrange body, restrained low punch and
   sparse crackles. No generic hit plink over a fireball or each burn tick.
   A tight flash, directional sparks and upward flame licks mark the real hit.
   The training bug squashes and tilts cosmetically; this adds no gameplay stun.
4. Burn: visible upward flicker and quiet, globally throttled crackles on the
   existing damage ticks. Training bugs darken while burning.
5. Death while burning: retain the dead silhouette for 0.55 seconds, curl and
   shrink it, scatter charred fragments, and let embers outlast the body.
   A soft sputter replaces the former death bass note. No gameplay lifetime is
   extended: dead enemies cannot be targeted or attack, and rewards are immediate.

The corpse animation retains at most 12 existing roots, with no mesh clones,
material clones or dynamic lights. Fx.clear removes them. The sample resets
their transforms and restores targets between casts. Proxy bosses keep their
own body death animation and receive the existing bounded fire particles.
Damage, fire cadence, travel speed, hitboxes, burn timing and spread are unchanged.

## Review limits

Video and offline audio captures cover the sequence and reported renderer/audio
metrics. They do not establish subjective sound quality or real phone behavior.
The full story suite and real iPhone/Pixel performance remain unverified for
this revision. The owner-supplied recording retains its existing provenance.
