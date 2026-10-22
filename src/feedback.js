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
  bus.on('enemy_killed', ({ targetId, type, pos, floor, r, silent, remains, chilled, element }) => {
    const fire = isBurning(targetId), ice = chilled && !fire, sparkle = element === 'glitter' && !fire && !ice;
    if (!fire && !ice && !sparkle) fx.puff(pos, 0xe6ded0, r * 1.6);
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
    if (!fire && !ice && !sparkle) sfx.kill(big ? 1.6 : 1);
  });
}
