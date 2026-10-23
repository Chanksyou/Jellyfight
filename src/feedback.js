// Hit feedback: the numbers, bursts, shakes, hit-stop and sounds that make an enemy getting
// hurt, frozen or killed land with weight. Nothing here changes the game; it only listens.
import { bus } from './events.js';
import { juice } from './juice.js';
import { sfx } from './sfx.js';
import { GUTS } from './enemies.js';
import { LOOK } from './look.js';

export function wireFeedback(fx, isBurning = () => false) {
  bus.on('enemy_hit', ({ targetId, amount, color, pos, sound, feedback }) => {
    if (sound !== 'fire' && sound !== 'fireball' && sound !== 'wind-collision') sfx.hit();
    fx.number(pos, amount, color, 14, { targetId, ...feedback });
  });

  bus.on('enemy_frozen', ({ pos, r }) => {
    sfx.freeze();
    fx.ring(pos.clone().setY(pos.y - r), 0x9fe8ff, r * 3, 0.5);
    fx.number(pos.clone().setY(pos.y + r * 2), 'FROZEN', '#bff4ff', 14);
  });

  // it bursts: bits fly and bounce, the screen kicks, the game catches its breath for a beat
  bus.on('enemy_killed', ({ targetId, type, pos, floor, r, silent, remains, chilled, element, dir, body }) => {
    const fire = isBurning(targetId), ice = chilled && !fire, sparkle = element === 'glitter' && !fire && !ice, melt = element === 'acid' && !fire && !ice && !!body;
    const blown = element === 'wind' && !fire && !ice && !!body;
    const own = fire || ice || sparkle || melt || blown;   // dies its element's own way, with its own sound
    if (!own) fx.puff(pos, 0xe6ded0, r * 1.6);
    if (silent) return;
    const big = r > 0.03;            // ant squads and mosquitoes land heavier than roaches
    if (ice) {
      // it died chilled: it shatters into ice, no body left. A cold flash, a burst of crystal shards
      // the size of the bug, a frost flower where it stood, a mist of frost, and the shatter
      fx.impact(pos, LOOK.color('ice-frost', '#9fe4ff'), r * 1.4, 10);
      fx.ice.shatter(pos, Math.round(LOOK.num('ice-shatter-shards', 18) * (big ? 1.4 : 1)), r * 0.32, 0.6, floor);
      fx.ice.bloom(pos.clone().setY(floor), Math.max(0.03, r * 2.4), 2);
      fx.puff(pos, 0xe8f8ff, r * 2, 0.5);
      sfx.iceShatter(big);
    } else if (melt) {
      // finished by acid: it melts. Its own body turns to glowing goo and slumps into the floor,
      // spreading as it sinks, fizzing; drops spit off it and a green stain is left where it stood
      fx.acid.melt(body);
      fx.acid.drops(pos, big ? 10 : 6, 0.25, floor, r * 0.25);
      fx.splat(pos.clone().setY(floor), LOOK.color('acid-spot', '#3aff00'), r * 1.5);
      fx.puff(pos, 0x9ab08a, r * 1.8, 0.6);
      sfx.acidMelt(big);
    } else if (blown) {
      // finished by wind: it's blown away. Its own body tumbles off along the gust, up and spinning,
      // shrinking to nothing, then puffs into dust; a whirlwind where it stood and its dust blowing off
      const way = dir?.lengthSq() > 1e-8 ? dir.clone() : pos.clone().set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
      fx.wind.blowAway(body, way, r);
      fx.wind.swirl(pos.clone().setY(floor), r * 2.2);
      fx.wind.streaks(pos, way, big ? 8 : 6, 1.2, r * 4);
      fx.wind.debris(pos.clone().setY(floor + 0.002), way, big ? 10 : 6, 0.35, floor);
      sfx.windBlowAway(big);
    } else if (sparkle) {
      // finished by glitter: it bursts into glitter, no body left. A flash of every colour, a shower of
      // flakes the size of the bug that flutter down and glint on the floor, and a sparkling pop
      fx.impact(pos, LOOK.color('glitter-pop', '#ff9ae8'), r * 1.4, 10);
      fx.glitter.burst(pos, Math.round(LOOK.num('glitter-death-flakes', 34) * (big ? 1.4 : 1)), Math.max(0.025, r * 2), floor);
      fx.ring(pos.clone().setY(floor + 0.003), LOOK.color('glitter-pop', '#ff9ae8'), Math.min(r * 3, 0.08), 0.3);
      sfx.glitterBurst(big);
    } else if (!fire) {
      const body = remains && fx.deaths.add(remains);
      fx.burst(pos, GUTS[type] || ['#ffffff'], body ? 4 : 10 + (big ? 6 : 0), r * 0.28, 0.3, floor);
      fx.ring(pos.clone().setY(floor + 0.003), LOOK.color('kill-ring', '#9fd8ff'), Math.min(r * 3, LOOK.num('kill-ring-max', 0.08)), 0.25);   // capped: a big bug's (3x its size) was a huge white circle round you
    }
    juice.feel(big ? 'kill-big' : 'kill');
    if (!own) sfx.kill(big ? 1.6 : 1);
  });
}
