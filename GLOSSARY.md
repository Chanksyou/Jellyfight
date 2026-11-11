# Jelly Run

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

**Shield**:
A pool on top of Health that takes damage first, shown as its own bar at the end of the Health bar. After 5 s without damage it refills to full in 2 s.

**Level**:
The jelly's rank within a run; each new Level offers a choice of cards that raise its stats.

**Attack damage**:
How hard each of the jelly's attacks hits.
_Avoid_: Pop damage, Bubble damage

**Fire rate**:
How many times the jelly attacks each second.
_Avoid_: Blow rate

**Attack size**:
How big each of the jelly's attacks is; bigger ones are easier to land and splash wider.
_Avoid_: Bubble size

**Attacks**:
How many attacks the jelly fires side by side in each blow (the stat; the thing a run's attack does is its _attack_).
_Avoid_: Bubbles (as a stat)

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

**Pearl**:
What every run that ends earns, banked between runs and spent on shop looks in Change your look. The golden awards can't be bought; they're earned by what you do.
_Avoid_: Tokens, coins

### Things the jelly meets

**Treasure**:
An item the jelly keeps for the rest of the run, chosen from a pick of three. Treasures turn up in the room on a schedule, and every beaten Elite drops one; either way it waits as a small golden chest the jelly touches to open the same pick of treasures.
_Avoid_: Gift, golden gift, lost things, item, chest (the chest is just how a treasure looks before it's picked)

**Rarity**:
How special a Treasure is: Common, Rare, Epic or Legendary. Legendary treasures change a rule of the game and are always one of a kind.

**Stacking**:
Taking the same Treasure again. A treasure with levels goes up a level; one without adds its effect again, up to 5 copies, unless it changes a rule.
_Avoid_: Duplicates

**Boss reward**:
What beating a Boss gives: one Legendary pick of three from the Legendary treasures, the evolutions included, then an Attack upgrade.

**Evolution**:
A Legendary treasure that changes what the jelly is (Cinder Jelly, Moon Jelly, Lion's Mane…): a trick, a cost, and a piece drawn on the jelly. A run can hold several, and their costs add up; picking one plays the metamorphosis.

**Bug**:
An ordinary enemy (roach, ant, mosquito, lanternfly, fly, spider, millipede, ladybug, dragonfly, mantis, worm, wasp, stag beetle; a wasp nest is one too, one that never moves), as opposed to an Elite or the boss.
_Avoid_: Mob, critter

**Boss**:
The one big enemy that ends each act, arriving when the countdown runs out (the Vacuum, the Clog, the Great White One, the Encore).

**Element**:
The kind of shot a Fire, Lightning, Ice, Poison, Wind or Glitter jelly type fires as its one attack. Not a Treasure any more.

**Jelly type**:
What a run starts as: its base stats and its one attack (bubbles, an Element shot, or tentacle lashes). Normal, Fire, Lightning, Ice, Poison, Wind, Glitter or Tentacle (`content/jellies.kdl`). A first-time player has Normal only; each other type unlocks for good by finishing an act or defeating Elites across all runs (`unlock-act=`, `unlock-elites=`).

**Attack upgrade**:
A change to the jelly type's attack, picked 1 of 3 from that type's own pool after each of the first three bosses (after the Legendary pick). Never in a treasure chest, and each one of a kind (`content/upgrades.kdl`).

**Type bars**:
The six bars on a jelly type's card on the pick screen: Damage, Attack speed, Range, Area, Toughness and Mobility, each worked out from the type's level-1 stats with Normal at the middle of every bar.

**Elite**:
A mini-boss: a household object that fights back, tougher than a bug and weaker than the boss.
_Avoid_: Miniboss

### Attacks

**Bleed**:
Health the jelly loses each second for a few seconds after a bite that bleeds (the mosquito's): 1 a second for 3 s. Every bite adds its own Bleed, so they stack.
Bugs can Bleed too: the Tentacle jelly's stings (Stinging Nettle, Venom Sac) add Bleed stacks that each take a share of the sting's damage every second for 3 s.

**Chill**:
What the Ice jelly's shards do to a bug: it moves at 55% speed for 2 s, and a new hit starts the 2 s again. A Chilled bug that dies shatters.

**Frozen**:
A bug held solid for a short time (Permafrost): it can't move or hurt anything. A hit that shatters the ice ends it (Deep Freeze).

**Trapped**:
A bug held still in a bubble (Bubble Trap) for 1.5 s: it can't move until the bubble bursts, or it dies. Elites and the boss can't be trapped.

**Poison**:
The Poison jelly type's status on bugs. Its blob's burst adds a Poison stack to every bug inside: each stack does 20% of Attack damage a second for 5 s, up to 5 stacks, and a new stack starts the time again. A Poisoned bug also deals 20% less damage to the jelly (Elites and the boss don't). Not the Clog's acid, which stays "acid".

**Gust**:
The Wind jelly type's attack: a fast crescent of wind that goes through bugs, shoves each one back, and hits a bug it slams into furniture a second time. Its upgrades (Gale, Crosswind, Jet Stream…) change how it flies.
_Avoid_: Wind blade

**Warning**:
What shows where an Elite's or the Boss's attack will land before it does: a shape on the floor, with the space it will fill above it, both filling up to the moment of the hit.
_Avoid_: Telegraph

**Blast**:
An attack that hits everything inside a sphere centred where it goes off: half a sphere when it lands on a surface, a whole one in mid-air. A low enough one can be jumped over.
_Avoid_: AoE

**Shot**:
Something an Elite or the Boss fires that hits when it touches the jelly, aimed at where the jelly is, in the air or on the ground.
_Avoid_: Projectile

### Growing

**Polyp, Ephyra, Medusa**:
The jelly's growth stages, one per act; growing from one to the next is its metamorphosis.
