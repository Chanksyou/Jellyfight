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
    fx.number(pos.clone().setY(pos.y + r * 2), 'FROZEN', '#bff4ff', 14);
  });

  bus.on('enemy_killed', (k) => showKill(fx, isBurning, k));
}

// Decide the non-elemental comedic death cause from the killing hit metadata.
function killCause({ element, source, slam, sliced, trapped, crit, overkill }) {
  if (sliced) return 'slice';
  if (source === 'stomp' || source === 'brick') return 'pancake';
  if (element === 'wind' && slam) return 'wall-splat';
  if (element === 'lightning' || source === 'lightning' || source === 'static' || source === 'zap') return 'zap';
  if (source === 'tentacle') return 'whip';
  if (source === 'cradle' || source === 'marble' || source === 'wind-bowl') return 'bowl';
  if (trapped || (source === 'bubble' && !element && (crit || overkill > 0.6))) return 'balloon';
  return 'normal';
}

// A bug dying (an enemy_killed event): it bursts, real anatomical parts fly and bounce, the death
// reflects how it was killed, the screen kicks, and the game catches its breath for a beat.
export function showKill(fx, isBurning, { targetId, type, pos, floor, r, silent, remains, chilled, element, dir, body, source, crit, overkill, slam, sliced, trapped }) {
  const fire = isBurning(targetId);
  const ice = chilled && !fire;
  const sparkle = element === 'glitter' && !fire && !ice;
  const melt = (element === 'acid' || element === 'poison' || source === 'venom') && !fire && !ice && !!body;
  const blown = element === 'wind' && !slam && !fire && !ice && !!body;
  const own = fire || ice || sparkle || melt || blown;   // dies its element's own way, with its own sound
  if (!own) fx.puff(pos, 0xe6ded0, r * 1.6);
  if (silent) return;
  if (fire && body) {
    fx.fireCorpse(body, r, floor);
    fx.splat(pos.clone().setY(floor), LOOK.color('beetle-scorch', '#2a1a12'), r * 1.6, 'scorch');
  }
  const big = r > 0.03;            // ant squads and mosquitoes land heavier than roaches
  if (ice) {
    // it died chilled: it shatters into ice crystals plus frozen real bug parts
    fx.impact(pos, LOOK.color('ice-frost', '#9fe4ff'), r * 1.4, 10);
    fx.ice.shatter(pos, Math.round(LOOK.num('ice-shatter-shards', 18) * (big ? 1.4 : 1)), r * 0.32, 0.6, floor);
    fx.ice.bloom(pos.clone().setY(floor), Math.max(0.03, r * 2.4), 2);
    fx.puff(pos, 0xe8f8ff, r * 2, 0.5);
    if (remains) fx.deaths.ejectParts(remains, { mode: 'ice', mat: fx.deaths.frostMat, dir, count: big ? 3 : 2 });
    sfx.iceShatter(big);
  } else if (melt) {
    // finished by acid or poison: its body turns to glowing goo and slumps into the floor while
    // one hero prop (shell/pushpin/eyes) bobs on top of the puddle before sinking last
    fx.acid.melt(body);
    fx.acid.drops(pos, big ? 10 : 6, 0.25, floor, r * 0.25);
    fx.splat(pos.clone().setY(floor), LOOK.color('acid-spot', '#3aff00'), r * 1.5);
    fx.puff(pos, 0x9ab08a, r * 1.8, 0.6);
    if (remains) fx.deaths.ejectParts(remains, { mode: 'float-sink', dir, count: 1 });
    sfx.acidMelt(big);
  } else if (blown) {
    // finished by wind: tumbles off along the gust while lightweight parts peel into the slipstream
    const way = dir?.lengthSq() > 1e-8 ? dir.clone() : pos.clone().set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
    fx.wind.blowAway(body, way, r);
    fx.wind.swirl(pos.clone().setY(floor), r * 2.2);
    fx.wind.streaks(pos, way, big ? 8 : 6, 1.2, r * 4);
    fx.wind.debris(pos.clone().setY(floor + 0.002), way, big ? 10 : 6, 0.35, floor);
    if (remains) fx.deaths.ejectParts(remains, { mode: 'slipstream', dir: way, count: 2 });
    sfx.windBlowAway(big);
  } else if (sparkle) {
    // finished by glitter: bursts into confetti flakes plus detached bug parts like a piñata
    fx.impact(pos, LOOK.color('glitter-pop', '#ff9ae8'), r * 1.4, 10);
    fx.glitter.burst(pos, Math.round(LOOK.num('glitter-death-flakes', 34) * (big ? 1.4 : 1)), Math.max(0.025, r * 2), floor);
    if (remains) fx.deaths.ejectParts(remains, { mode: 'pinata', dir, count: big ? 3 : 2 });
    sfx.glitterBurst(big);
  } else if (!fire) {
    const cause = killCause({ element, source, slam, sliced, trapped, crit, overkill });
    const hasBody = remains && fx.deaths.add({ ...remains, cause, dir, crit, overkill });
    const chunks = hasBody ? (crit || overkill > 0.5 ? 7 : 4) : 10 + (big ? 6 : 0);
    fx.burst(pos, GUTS[type] || ['#ffffff'], chunks, r * 0.28, crit ? 0.42 : 0.3, floor);
    // Cause-specific floor evidence & comedic audio
    if (cause === 'zap') {
      fx.impact(pos, LOOK.color('stunned', '#fff27a'), r * 1.5, 10);
      fx.splat(pos.clone().setY(floor), LOOK.color('beetle-scorch', '#2a1a12'), r * 1.5, 'scorch');
      sfx.deathZap(big);
    } else if (cause === 'pancake' || cause === 'wall-splat') {
      fx.splat(pos.clone().setY(floor), LOOK.color('bug-scuff', '#4a3c30'), r * 1.8, 'dust');
      sfx.deathPancake(big);
    } else if (cause === 'balloon') {
      fx.splat(pos.clone().setY(floor), LOOK.color('splat', '#9fd8ff'), r * 1.6, 'splash');
      sfx.deathPop(big);
    } else {
      sfx.kill(big ? 1.6 : 1);
    }
    if (hasBody && fx.deaths.list.at(-1)?.fragments?.length) {
      sfx.partClatter(fx.deaths.list.at(-1).fragments.length);
    }
  }
  juice.feel(big ? 'kill-big' : 'kill');
}
