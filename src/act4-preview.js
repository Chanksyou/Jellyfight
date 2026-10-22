// Walkable environment preview until Act 4's boss and campaign transition are implemented.
import * as THREE from 'three';
import { buildAct4 } from './act4-arena.js';
import { STAGE4 } from './stage4.js';
import { CONFIG } from './config.js';
import { LOOK } from './look.js';
import { Player } from './player.js';
import { World } from './collision.js';
import { Input } from './input.js';
import { ThirdPersonCamera } from './camera.js';
import { buildCharacter, normalizeLook } from './character.js';
import { TouchControls, IS_TOUCH } from './touch.js';
import { Graphics } from './graphics.js';
import { FramePacer, FrameGovernor } from './pacing.js';
import { EncoreFloor, EncoreSet } from './encore-floor.js';
import { Music, SONGS } from './music.js';
import { unlock as unlockAudio, audio, sfx } from './sfx.js';
import { juice } from './juice.js';
import { BASE_STATS } from './stats.js';
import { SongTrack, TRACKS } from './song-track.js';

export async function startAct4Preview({scene,renderer,camera}){
  scene.background=new THREE.Color(LOOK.color('arena-background','#030611'));
  scene.fog=new THREE.FogExp2(LOOK.color('arena-background','#030611'),.3);
  const maxScale=Math.min(devicePixelRatio||1,LOOK.num(IS_TOUCH?'phone-pixel-ratio':'desktop-pixel-ratio',IS_TOUCH?1.5:2));
  renderer.setPixelRatio(maxScale);
  const arena=buildAct4(scene),world=new World(scene,{staticScene:true});
  for(const m of arena.solids)if(m.userData.noCollide)world.addCollider(m,false);
  world.focus(new THREE.Vector3(...STAGE4.start),1);
  const player=new Player(world,CONFIG.player);scene.add(player.mesh);
  player.setAvatar(buildCharacter(normalizeLook(null),CONFIG.player.height));
  const input=new Input(renderer.domElement),tpc=new ThirdPersonCamera(camera,world,CONFIG.camera);
  player.spawn(new THREE.Vector3(...STAGE4.start));player.snapToGround();tpc.snapTo(player.position);
  const gfx=new Graphics(renderer,scene,camera,'low');gfx.setTier('low');
  const panel=document.createElement('div');panel.id='act4-preview';
  panel.innerHTML=`<style>
  #act4-preview{position:fixed;inset:12px 12px auto;z-index:12;display:flex;align-items:center;gap:8px;flex-wrap:wrap;pointer-events:none;font:13px system-ui;color:#d8e6ff}
  #act4-preview strong{font-size:18px;margin-right:12px}#act4-preview button,#act4-preview a{pointer-events:auto;color:#e5edff;background:#0b1226cc;border:1px solid #64789970;border-radius:10px;padding:9px 12px;text-decoration:none;font:inherit}
  #act4-preview [data-health]{font-weight:700;color:#ffd0dc;text-shadow:0 2px 4px #000}#act4-preview p{flex-basis:100%;margin:0;text-shadow:0 2px 4px #000}#act4-preview button[aria-pressed=true]{border-color:#f5b660;color:#ffcf8b}
  @media(max-height:500px){#act4-preview{font-size:11px;inset:6px 6px auto}#act4-preview strong{font-size:14px}#act4-preview p{display:none}}
  </style><strong>Act 4 · The Encore</strong><button data-view aria-pressed="false">Walk arena</button><button data-boss>Boss close-up</button><button data-charge>Boss lights: off</button><button data-tiles aria-pressed="false">Tile lights</button><button data-fight aria-pressed="false">Fight: floor patterns</button><span data-health hidden></span><a href="./">Back to game</a><p>Preview · WASD move · mouse look · Space jump · R return · Fight: jump the lit tiles on the beat</p>`;
  document.body.append(panel);
  let overview=true,lit=false,paused=false;const shake=new THREE.Vector3();
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const touch=new TouchControls(input,{onPause:()=>{paused=!paused;}});touch.mount(document.body);input.touchOnly=IS_TOUCH;
  function view(on){overview=on;input.enabled=!on;touch.show(IS_TOUCH&&!on);panel.querySelector('[data-view]').textContent=on?'Walk arena':'Arena overview';panel.querySelector('[data-view]').setAttribute('aria-pressed',String(!on));if(on){document.exitPointerLock?.();camera.position.set(.35,1.12,1.46);camera.lookAt(0,.11,-.05);}else tpc.snapTo(player.position);}
  panel.querySelector('[data-boss]').onclick=()=>{view(true);camera.position.set(.24,.44,-.03);camera.lookAt(0,.255,-.435);};
  panel.querySelector('[data-view]').onclick=()=>view(!overview);
  panel.querySelector('[data-tiles]').onclick=()=>{if(fighting)return;lit=!lit;arena.clearTiles();if(lit)for(let r=0;r<STAGE4.tiles;r++)for(let c=0;c<STAGE4.tiles;c++)if((r*7+c*3)%5<3)arena.setTile(r,c,['#0066ff','#9415ff','#ff6504'][(r+c)%3],.55);panel.querySelector('[data-tiles]').setAttribute('aria-pressed',String(lit));};
  const lightSamples=['off','pyramid','leftWing','rightWing','all'];let lightSample=0;
  panel.querySelector('[data-charge]').onclick=()=>{lightSample=(lightSample+1)%lightSamples.length;arena.boss.clearLighting();if(lightSample)arena.boss.setLighting(lightSamples[lightSample]);panel.querySelector('[data-charge]').textContent=`Boss lights: ${['off','pyramid','left wing','right wing','all'][lightSample]}`;};
  // Fight: the Encore's floor patterns on its song. A hit takes Health; at 0 it fills back up.
  const maxHealth=BASE_STATS.health;let health=maxHealth,fighting=false,set=null,music=null,clock=0;
  const healthEl=panel.querySelector('[data-health]'),showHealth=()=>{healthEl.textContent=`Health ${Math.max(0,Math.round(health))}/${maxHealth}`;};
  const floor=new EncoreFloor(arena,{onHit(dmg){
    health-=dmg;sfx.hurt();juice.feel('impact-big');player.velocity.y=Math.max(player.velocity.y,.45);
    if(health<=0)health=maxHealth;showHealth();
  }});
  // the song's own clock once it exists (it holds still until the audio starts); without audio, frames at its tempo
  // the beat comes from what's playing: the Encore's track, or the synthesized song if the track won't
  // load; null while the track loads (the fight waits); with no audio at all, frames at the song's tempo
  let track=null,source=null,waiting=false;
  const beatNow=dt=>source?source.beatNow():waiting?null:clock+=dt*SONGS.encore.bpm/60;
  function fight(on){
    fighting=on;floor.reset();set=null;health=maxHealth;showHealth();healthEl.hidden=!on;
    const b=panel.querySelector('[data-fight]');b.setAttribute('aria-pressed',String(on));b.textContent=on?'Stop the fight':'Fight: floor patterns';
    if(on){unlockAudio();const A=audio();if(lit)panel.querySelector('[data-tiles]').click();view(false);
      if(A){waiting=true;track||=new SongTrack(A.ctx,A.master,TRACKS.encore);track.load().then(ok=>{waiting=false;if(!fighting)return;if(ok){track.play();source=track;}else{music||=new Music(A.ctx,A.master);music.play('encore');source=music;}});}}
    else{track?.stop();music?.play(null);source=null;waiting=false;}
  }
  panel.querySelector('[data-fight]').onclick=()=>fight(!fighting);
  view(true);
  await renderer.compileAsync(scene,camera);gfx.render();
  document.getElementById('loading').classList.add('gone');
  const fps=IS_TOUCH?LOOK.num('phone-fps',60):60;
  const pacer=new FramePacer({fps}),governor=new FrameGovernor({fps:fps||60,scale:maxScale,min:Math.min(maxScale,LOOK.num('min-pixel-ratio',1)),max:maxScale});let last=0;
  const preview={arena,world,player,tpc,gfx,scene,renderer,camera,input,setOverview:view,step(dt){juice.calm=reducedMotion.matches;music?.duck(paused);track?.duck(paused);music?.update(dt,.8);if(paused)return;juice.update(dt);arena.boss.update(dt,reducedMotion.matches);if(fighting){const beat=beatNow(dt);if(beat!==null){set||=new EncoreSet(floor,Math.ceil(beat/4)*4+4,{quiet:b=>!!source?.quiet?.(b),drop:b=>!!source?.drop?.(b),target:()=>[player.position.x,player.position.z]});set.update(beat);floor.update(beat,player);}}world.focus(player.position,dt);if(input.consumeReset()){player.spawn(new THREE.Vector3(...STAGE4.start));world.focus(player.position,1);player.snapToGround();}if(!overview){player.update(dt,input,tpc.yaw);tpc.update(dt,input.consumeMouse(),player.position);camera.position.add(juice.offset(shake));}else player.avatar.update(dt,{speed:0,walkSpeed:CONFIG.player.walkSpeed,grounded:true,vy:0,swim:0});},render:()=>gfx.render()};
  preview.floor=floor;preview.fight=fight;
  window.ACT4=preview;
  renderer.setAnimationLoop(now=>{if(!pacer.due(now))return;const elapsed=last?now-last:1000/60,change=governor.sample(elapsed);if(change){renderer.setPixelRatio(change.scale);gfx.resize();}const dt=Math.min(.04,elapsed/1000);last=now;preview.step(dt);preview.render();});
  addEventListener('pagehide',event=>{if(event.persisted)return;renderer.setAnimationLoop(null);music?.play(null);track?.stop();floor.dispose();arena.dispose();},{once:true});
}
