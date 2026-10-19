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
  bus.on('enemy_killed', ({ targetId, type, pos, floor, r, silent }) => {
    const fire = isBurning(targetId);
    if (!fire) fx.puff(pos, 0xe6ded0, r * 1.6);
    if (silent) return;
    const big = r > 0.03;            // ant squads and mosquitoes land heavier than roaches
    if (!fire) {
      fx.burst(pos, GUTS[type] || ['#ffffff'], 10 + (big ? 6 : 0), r * 0.28, 0.3, floor);
      fx.ring(pos.clone().setY(floor + 0.003), LOOK.color('kill-ring', '#9fd8ff'), Math.min(r * 3, LOOK.num('kill-ring-max', 0.08)), 0.25);   // capped: a big bug's (3x its size) was a huge white circle round you
    }
    juice.feel(big ? 'kill-big' : 'kill');
    if (!fire) sfx.kill(big ? 1.6 : 1);
  });
}
