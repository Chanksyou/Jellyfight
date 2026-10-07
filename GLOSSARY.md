# Jelly Fight

A jellyfish roguelike in a real-scale apartment at night. Core systems a player must understand use plain game words, the same in the game's text, its code and its content files; the things a player meets (items, enemies, bosses, species) keep their own names.

## Language

### Core systems

**Health**:
How much damage the jelly can take before the run ends.
_Avoid_: Moisture, HP

**XP**:
What fills the bar toward the next Level; enemies drop it as droplets the jelly collects.
_Avoid_: Dew, experience points

**Health regen**:
Health the jelly gets back each second on its own.
_Avoid_: Moisture regen

**Level**:
The jelly's rank within a run; each new Level offers a choice of cards that raise its stats (every 3rd Level offers Element upgrades instead, while the jelly has any left to take).

**Bubble damage**:
How hard each of the jelly's bubbles hits when it pops.
_Avoid_: Pop damage

**Fire rate**:
How many bubbles the jelly blows each second.
_Avoid_: Blow rate

**Move speed**:
How fast the jelly swims.
_Avoid_: Swim speed

**Jump height**:
How high the jelly jumps.
_Avoid_: Bounce

**Tentacle damage**:
How hard each tentacle lash hits. ("Sting" was its old stat name; stinging is still fine as a verb.)

**Tentacle speed**:
How many tentacle lashes the jelly makes each second.
_Avoid_: Lash speed

**First run**:
A new player's first run of act 1, which introduces the game's systems one at a time; it ends for good once one of their runs ends.
_Avoid_: Tutorial, onboarding run

### Things the jelly meets

**Treasure**:
An item the jelly keeps for the rest of the run, chosen from a pick of three. Treasures turn up in the room on a schedule, and every beaten Elite drops one; either way it waits as a small golden chest the jelly touches to open the same pick of treasures.
_Avoid_: Gift, golden gift, lost things, item, chest (the chest is just how a treasure looks before it's picked)

**Rarity**:
How special a Treasure is: Common, Rare, Epic or Legendary. Legendary treasures change a rule of the game and are always one of a kind; the Elements are Legendary.

**Stacking**:
Taking the same Treasure again. A treasure with levels goes up a level; one without adds its effect again, up to 5 copies, unless it changes a rule.
_Avoid_: Duplicates

**Element upgrade**:
A Treasure that improves an Element the jelly already has. It never turns up in a treasure pick; it's offered on its own.

**Boss reward**:
What beating a Boss gives: the metamorphosis, then a Legendary pick of three: Legendary treasures and Elements the jelly doesn't have yet, with at least one Element while any are left.

**Bug**:
An ordinary enemy (roach, ant, mosquito, lanternfly, fly, spider, millipede, ladybug), as opposed to an Elite or the boss.
_Avoid_: Mob, critter

**Boss**:
The one big enemy that ends each act, arriving when the countdown runs out (the Vacuum, the Clog).

**Element**:
A second attack type (fire, lightning, ice, acid, wind or glitter) fired alongside the bubbles. Each is a Legendary treasure: the run starts with a pick of three, and the Boss reward can offer more.

**Elite**:
A mini-boss: a household object that fights back, tougher than a bug and weaker than the boss.
_Avoid_: Miniboss

**Polyp, Ephyra, Medusa**:
The jelly's growth stages, one per act; growing from one to the next is its metamorphosis.
