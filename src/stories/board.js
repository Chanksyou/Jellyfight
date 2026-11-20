// The leaderboard screen on the game's own site: a tab for Champions, All and each jelly type, a board kept
// for each type (worker/index.js), your own row always shown. Fixtures stand in for the Worker's answers.
import { Leaderboard } from '../leaderboard.js';
import { G, fresh, ok, story } from './kit.js';

const LOOKS = [{ body: 'moon', color: '#ff5fa2', accent: '#ffd23a' }, { body: 'lion', color: '#4dff7a', accent: '#1f6b3a' }, { body: 'box', color: '#6aa9ff', accent: '#fff' }];
const TYPES = ['normal', 'fire', 'lightning', 'ice', 'poison', 'wind', 'glitter'];   // tentacle is left empty on purpose
const row = (i, jelly, score, extra = {}) => ({ name: 'Jelly ' + i, jelly, score, acts: 4, clean: 0, won: true, look: LOOKS[i % 3], at: 1000 + i, ...extra });
const list = (jelly, n, top = 50000, extra = {}) => Array.from({ length: n }, (_, i) => row(i, jelly, top - i * 100, i === 0 ? extra : {}));

// What the Worker answers for each tab (see its top-of-file note): me is 'me'
export const fixture = () => ({
  champions: { season: 1, tab: 'champions', mine: null, top: TYPES.map((t, i) => row(i, t, 40000 + i * 1000, t === 'ice' ? { id: 'me', name: 'Chan', clean: 3 } : { won: i % 2 === 0, acts: 3 })) },
  all: { season: 1, tab: 'all', mine: { ...row(0, 'ice', 57300, { id: 'me', name: 'Chan', clean: 3 }), place: 1 }, top: [row(0, 'ice', 57300, { id: 'me', name: 'Chan', clean: 3 }), row(1, 'normal', 55120, { clean: 1 }), row(2, 'fire', 48200, { won: false, acts: 4 })] },
  ice: { season: 1, tab: 'ice', mine: { ...row(0, 'ice', 57300, { id: 'me', name: 'Chan', clean: 3 }), place: 1 }, top: [row(0, 'ice', 57300, { id: 'me', name: 'Chan', clean: 3 }), row(1, 'ice', 55120, { clean: 1 }), row(2, 'ice', 48200, { won: false, acts: 4 }), row(3, 'ice', 37900, { won: false, acts: 3 }), row(4, 'ice', 24650, { won: false, acts: 2 })] },
  fire: { season: 1, tab: 'fire', mine: null, top: list('fire', 3, 41000) },
  lightning: { season: 1, tab: 'lightning', mine: null, top: list('lightning', 10, 52000) },
  normal: { season: 1, tab: 'normal', mine: null, top: [] },
});

// A fetch that answers from `boards`, noting what was asked (and every post)
export function fakeWorker(boards) {
  const log = { gets: [], posts: [] };
  const real = window.fetch;
  window.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (!u.startsWith('api/scores')) return Response.json({});
    if (opts.method === 'POST') { log.posts.push(JSON.parse(opts.body)); return Response.json({ posted: true }); }
    const tab = new URL(u, 'http://x/').searchParams.get('tab') || 'all';
    log.gets.push(tab);
    return Response.json(boards[tab] || { season: 1, tab, top: [], mine: null });
  };
  return { log, restore() { window.fetch = real; } };
}

// A web Leaderboard with its tabs already in (a screen opens in one step: nothing waits for a read)
export function webBoard(boards) {
  const realClaude = window.claude;
  delete window.claude;
  const B = new Leaderboard();
  window.claude = realClaude;
  B.web = true; B.status = 'live'; B.id = 'me'; B.canWrite = true; B.season = 1; B.ready = Promise.resolve(true);
  for (const [tab, d] of Object.entries(boards)) B.tabs.set(tab, { top: d.top, mine: d.mine, visit: B.visit });
  B.mine = boards.all.mine;
  return B;
}

const modal = () => document.querySelector('.jf-modal');
const tabBtn = (id) => modal().querySelector(`.jf-board-tabs [data-tab="${id}"]`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rowsText = () => [...modal().querySelectorAll('.jf-stats > span')].map((e) => e.innerText.replace(/\s+/g, ' ').trim());

// Open the board on a fake Worker; run `fn`, then put everything back
async function withBoard(boards, fn) {
  const { run } = G(), realBoard = run.board, worker = fakeWorker(boards);
  try {
    delete window.claude;
    const B = run.board = new Leaderboard(); await B.ready; B.id = 'me';   // the fixtures' own rows carry this id
    return await fn({ run, B, worker });
  } finally {
    run.board.onChange = null; run.endView = null; run.board = realBoard; worker.restore();
    run.ui.close();
  }
}

story('board/tabs-switch-and-champions-show-every-type', {
  about: 'The leaderboard opens on Champions: a row for each jelly type with a season chip and a note saying how many you hold; a type nobody has played says Nobody yet. Tabs run Champions, All, then one for each jelly type; choosing one shows that board, with Won or the act reached and acts untouched on a second line, and All naming each run\'s type.',
  setup() { fresh({ elites: false }); },
  async play() {
    return withBoard(fixture(), async ({ run, B, worker }) => {
      run.showBoard(() => {});
      await wait(150);
      const tabs = [...modal().querySelectorAll('.jf-board-tabs button')].map((b) => b.dataset.tab);
      const opened = tabBtn('champions').getAttribute('aria-pressed') === 'true';
      const champs = rowsText();
      const note = modal().querySelector('.jf-board-body .sub')?.innerText || '';
      const chip = modal().querySelector('.jf-season')?.innerText || '';
      const empty = champs.length === 8 && /Nobody yet/.test(champs[7]) && /Tentacle Jelly/.test(champs[7]);
      tabBtn('all').click(); await wait(150);
      const all = rowsText();
      tabBtn('ice').click(); await wait(150);
      const ice = rowsText();
      const iceTab = tabBtn('ice');
      return ok(tabs.join() === 'champions,all,normal,fire,lightning,ice,poison,wind,glitter,tentacle' && opened && chip === 'Season 1' && /You hold 1 of 8/.test(note) && empty
        && /Chan/.test(champs[3]) && /Ice Jelly · Won/.test(champs[3]) && iceTab.getAttribute('aria-pressed') === 'true' && iceTab.getAttribute('aria-label') === 'Ice Jelly'
        && all.length === 3 && /Ice Jelly · Won · 3 acts untouched/.test(all[0]) && /Normal Jelly · Won · 1 act untouched/.test(all[1]) && /Fire Jelly · Reached act 4/.test(all[2])
        && ice.length === 5 && /^1\. Chan \(you\) Won · 3 acts untouched/.test(ice[0]) && /Reached act 2/.test(ice[4]) && !/Ice Jelly/.test(ice[0])
        && /Your best with Ice Jelly: 57,300 \(#1\)/.test(modal().querySelector('.jf-board-body .sub').innerText) && worker.log.gets.includes('ice'),
      { tabs, opened, chip, note, champs, all, ice, gets: worker.log.gets });
    });
  },
});

story('board/own-row-stays-when-outside-the-top-10', {
  about: 'When your own row is not in a board\'s top 10 it is pinned under the list with its real place; when it is in the top 10 it stays in place and nothing is added.',
  setup() { fresh({ elites: false }); },
  async play() {
    const boards = fixture();
    boards.lightning = { season: 1, tab: 'lightning', top: list('lightning', 10, 52000), mine: { ...row(0, 'lightning', 9000, { id: 'me', name: 'Chan', won: false, acts: 2 }), place: 14 } };
    return withBoard(boards, async ({ run }) => {
      run.showBoard(() => {}, 'lightning');
      await wait(150);
      const out = rowsText(), pinned = /^14\. Chan \(you\) Reached act 2/.test(out[out.length - 1]) && out.length === 12 && !out.slice(0, 10).some((t) => /\(you\)/.test(t));
      tabBtn('ice').click(); await wait(150);
      const inside = rowsText(), once = inside.length === 5 && inside.filter((t) => /\(you\)/.test(t)).length === 1;
      return ok(pinned && once && tabBtn('lightning').getAttribute('aria-pressed') === 'false', { out, inside });
    });
  },
});

story('board/submit-is-offered-by-jelly-type', {
  about: 'A run is held against its own jelly type\'s board: a Fire run that makes the Fire top 10 is offered Submit score and posts even when your Ice run scores more, a run that cannot make its type\'s top 10 is told so, and the end screen\'s Leaderboard opens on that type\'s tab.',
  setup() { fresh({ elites: false }); },
  async play() {
    const boards = fixture();
    return withBoard(boards, async ({ run, B, worker }) => {
      const finish = async (jelly) => {
        run.jelly = jelly; run.t = run.duration;   // the whole night: a score of a few thousand
        run.endRun('Finished', '', 'Again'); await wait(250);
        return { text: modal().innerText, submit: [...modal().querySelectorAll('button')].some((b) => /Submit score/.test(b.textContent)), score: run.score() };
      };
      // Fire's board has room, and your best Ice run (57,300) is not Fire's
      const fire = await finish('fire');
      await B.load('ice');   // the Ice board, as the board screen would have read it
      const rules = { fireQualifies: B.qualifies(fire.score, 'fire'), iceBlocks: !B.qualifies(fire.score, 'ice'), ranks: B.rank('ice') === 1 && B.rank('fire') === null };
      const posted = await B.post({ score: fire.score, season: 1, jelly: 'fire', name: 'Chan' });
      // Lightning's board is full of bigger scores
      run.ui.close();
      const lightning = await finish('lightning');
      const tooLow = !lightning.submit && /not enough for the top 10 with this jelly type/.test(lightning.text) && B.cutoff('lightning') === 51100;
      // the Leaderboard button opens on the run's type
      [...modal().querySelectorAll('button')].find((b) => /Leaderboard/.test(b.textContent)).click(); await wait(150);
      const opensOn = tabBtn('lightning').getAttribute('aria-pressed') === 'true';
      return ok(fire.submit && rules.fireQualifies && rules.iceBlocks && rules.ranks && posted.posted && worker.log.posts.length === 1 && worker.log.posts[0].jelly === 'fire' && tooLow && opensOn,
        { fire: fire.submit, rules, posted, posts: worker.log.posts.length, tooLow, opensOn });
    });
  },
});
