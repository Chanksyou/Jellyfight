// Hit feedback: the numbers, bursts, shakes, hit-stop and sounds that make an enemy getting
// hurt, frozen or killed land with weight. Nothing here changes the game; it only listens.
import { bus } from './events.js';
import { juice } from './juice.js';
import { sfx } from './sfx.js';
import { GUTS } from './enemies.js';

export function wireFeedback(fx) {
  bus.on('enemy_hit', ({ amount, color, pos }) => {
    sfx.hit();
    fx.number(pos, Math.round(amount), color, color === '#fff' ? 13 : 17);
  });

  bus.on('enemy_frozen', ({ pos, r }) => {
    sfx.freeze();
    fx.ring(pos.clone().setY(pos.y - r), 0x9fe8ff, r * 3, 0.5);
    fx.number(pos.clone().setY(pos.y + r * 2), 'FROZEN', '#bff4ff', 14);
  });

  // it bursts: bits fly and bounce, the screen kicks, the game catches its breath for a beat
  bus.on('enemy_killed', ({ type, pos, floor, r, silent }) => {
    fx.puff(pos, 0xe6ded0, r * 1.6);
    if (silent) return;
    const big = r > 0.018;
    fx.burst(pos, GUTS[type] || ['#ffffff'], 10 + (big ? 6 : 0), r * 0.28, 0.3, floor);
    fx.ring(pos.clone().setY(floor + 0.003), 0xffffff, r * 3, 0.25);
    juice.hitstop(big ? 0.06 : 0.035);
    juice.shake(big ? 0.3 : 0.18);
    sfx.kill(big ? 1.6 : 1);
  });
}
