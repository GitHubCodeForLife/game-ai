import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,seededRandom,SKILLS,waveFormation,progress} from './last-light-game.js';
import {createAudio} from './last-light-audio.js';

function encounter(type='normal',random=()=>.99){
  const events=[],g=createGame({random,onEvent:e=>events.push(e)});g.startWave();g.state.enemies=[];g.state.waveIntro=0;g.state.spawns=[{type,at:0}];g.update(.01);
  const e=g.state.enemies[0],p=g.state.player;e.x=0;e.cooldown=1000;p.x=-1.3;p.cooldown=0;
  return {g,e,p,events};
}
function hit(g){g.state.player.cooldown=0;g.update(.02);}
function run(g,steps=100){for(let i=0;i<steps;i++)g.update(.05);}

test('a normal landed attack reduces HP and reports exact loss',()=>{
  const {g,e,events}=encounter();hit(g);assert.equal(e.hp,24);assert.ok(events.some(e=>e.type==='float'&&e.text==='−18 HP'));
});
test('First Strike crits against each new enemy but cannot refresh on an already-hit target',()=>{
  const {g,e,p}=encounter();p.skills.first=1;e.hp=200;e.maxHp=200;
  hit(g);assert.equal(e.hp,164);hit(g);assert.equal(e.hp,146);
  delete p.skills.first;hit(g);p.skills.first=1;hit(g);assert.equal(e.hp,110);
  const next={...e,id:999,hp:100,maxHp:100,hitCount:0};g.state.enemies=[next];hit(g);assert.equal(next.hp,64);
});
test('50% healing chance applies once per basic hit and respects max HP',()=>{
  const {g,p}=encounter('normal',()=>.1);p.skills.touch=1;p.hp=98;hit(g);assert.equal(p.hp,100);assert.equal(p.armor,0);
  const success=encounter('normal',()=>.49);success.p.hp=50;success.p.skills.touch=1;hit(success.g);assert.equal(success.p.hp,58);
  const failure=encounter('normal',()=>.5);failure.p.hp=50;failure.p.skills.touch=1;hit(failure.g);assert.equal(failure.p.hp,50);
});
test('Overflow Guard grants 4 armor plus unused healing, and armor is capped',()=>{
  const {g,e,p,events}=encounter();p.hp=98;p.armor=4;p.skills={killHeal:1,overflow:1};e.hp=1;e.xp=0;hit(g);
  assert.equal(p.hp,100);assert.equal(p.armor,14);assert.ok(events.some(e=>e.text==='−1 HP'));assert.equal(g.state.kills,1);
  const x=encounter();x.p.armor=49;x.p.skills={killHeal:3,overflow:1};x.e.hp=1;x.e.xp=0;hit(x.g);assert.equal(x.p.armor,50);
});
test('nonlethal healing never converts to armor, even with Overflow Guard',()=>{
  const {g,p}=encounter('normal',()=>.1);p.skills={touch:1,overflow:1};p.hp=100;hit(g);assert.equal(p.armor,0);
});
test('armor absorbs first; HP damage activates Retribution; lethal damage wins ties',()=>{
  const {g,e,p}=encounter();p.armor=5;p.cooldown=1000;p.skills.revenge=1;e.wind=.001;e.windDuration=.3;e.action='basic';g.update(.02);
  assert.equal(p.armor,0);assert.equal(p.hp,99);assert.equal(p.revenge,true);
  p.hp=1;p.cooldown=0;e.hp=1;e.wind=.001;e.action='basic';g.update(.02);
  assert.equal(g.state.phase,'defeat');assert.equal(g.state.kills,0);assert.equal(e.hp,1);
});
test('tanker guard reduces and floors damage, consumes once, and reports actual HP loss',()=>{
  const {g,e,events}=encounter('tanker');e.guard=true;hit(g);assert.equal(e.hp,114);assert.equal(e.guard,false);
  assert.ok(events.some(e=>e.text==='GUARD −12 HP'));hit(g);assert.equal(e.hp,96);
});
test('multiple earned levels pause combat and resolve before wave-clear rest',()=>{
  const {g,e}=encounter();e.hp=1;e.xp=100;hit(g);assert.equal(g.state.phase,'upgrade');assert.equal(g.state.pendingLevels,3);
  const snapshot=JSON.stringify(g.state);run(g);assert.equal(JSON.stringify(g.state),snapshot);
  assert.equal(g.chooseSkill('not-an-offer'),false);
  while(g.state.phase==='upgrade'){assert.equal(new Set(g.state.offers).size,g.state.offers.length);g.chooseSkill(g.state.offers[0]);}
  assert.equal(g.state.phase,'rest');assert.equal(g.state.pendingLevels,0);
});
test('rest pays once, never grants armor, and training level-ups return to ready',()=>{
  const {g,e,p}=encounter();e.hp=1;e.xp=0;p.hp=90;p.skills.overflow=1;hit(g);assert.equal(g.state.phase,'rest');
  const armorBeforeRest=p.armor;
  assert.equal(g.chooseRest('heal'),true);assert.equal(p.hp,100);assert.equal(p.armor,armorBeforeRest);assert.equal(g.chooseRest('train'),false);
  g.state.phase='rest';g.state.restChosen=false;p.xp=23;
  assert.equal(g.chooseRest('heal'),false);assert.equal(g.chooseRest('train'),true);assert.equal(g.state.phase,'upgrade');
  g.chooseSkill(g.state.offers[0]);assert.equal(g.state.phase,'ready');
});
test('offer eligibility excludes capped skills and unsupported overflow; fallback remains actionable',()=>{
  const {g,e,p}=encounter();p.skills=Object.fromEntries(SKILLS.filter(s=>s.id!=='overflow').map(s=>[s.id,s.max]));e.hp=1;e.xp=24;hit(g);
  assert.deepEqual(g.state.offers,['overflow']);g.chooseSkill('overflow');
  g.state.pendingLevels=1;g.state.phase='upgrade';g.state.offers=['fallback'];g.chooseSkill('fallback');assert.equal(p.flatDamage,6);
  const x=encounter();x.e.hp=1;x.e.xp=24;hit(x.g);assert.ok(!x.g.state.offers.includes('overflow'));
});

test('a first damage upgrade reduces a raider from three hits to two',()=>{
  const {g,e,p}=encounter();p.skills.edge=1;hit(g);assert.equal(e.hp,17);hit(g);assert.equal(e.hp,0);assert.equal(g.state.kills,1);
});
test('damage, critical chance, and speed ranks have substantial cumulative effects',()=>{
  const {g,p}=encounter();p.skills={edge:3,eye:3,speed:3};
  assert.ok(Math.abs(g.stats().damage-39.6)<1e-10);assert.ok(Math.abs(g.stats().crit-.5)<1e-10);assert.ok(Math.abs(g.stats().interval-.51)<1e-10);
});
test('Third Beat, Momentum, Last Stand, and Retribution apply their stronger damage bonuses',()=>{
  const third=encounter();third.e.hp=200;third.e.maxHp=200;third.p.skills.third=1;
  hit(third.g);hit(third.g);hit(third.g);assert.equal(third.e.hp,128);
  const momentum=encounter();momentum.p.skills.momentum=1;momentum.e.hp=1;momentum.e.xp=0;
  const next={...momentum.e,id:999,hp:100,maxHp:100};momentum.g.state.enemies.push(next);
  hit(momentum.g);hit(momentum.g);assert.equal(next.hp,72);hit(momentum.g);assert.equal(next.hp,54);
  const stand=encounter();stand.p.hp=49;stand.p.skills.stand=1;hit(stand.g);assert.equal(stand.e.hp,14);
  const boundary=encounter();boundary.p.hp=50;boundary.p.skills.stand=1;hit(boundary.g);assert.equal(boundary.e.hp,24);
  const revenge=encounter();revenge.p.skills.revenge=1;revenge.e.wind=.001;revenge.e.windDuration=.3;revenge.e.action='basic';hit(revenge.g);
  assert.equal(revenge.e.hp,12);assert.equal(revenge.p.revenge,false);
});
test('critical skills and wave-start armor provide their new rewards',()=>{
  const {g,e,p}=encounter();p.hp=70;p.skills={first:1,critHeal:1,critArmor:1,opening:1};e.hp=100;e.maxHp=100;
  hit(g);assert.equal(p.hp,80);assert.equal(p.armor,8);
  g.state.enemies=[];g.state.phase='ready';g.startWave();assert.equal(p.armor,28);
  g.state.phase='ready';p.skills.opening=3;g.startWave();assert.equal(p.armor,50);
});
test('Vitality heals immediately once per pick and increases maximum HP and armor capacity',()=>{
  const {g,p}=encounter();p.hp=40;g.state.phase='upgrade';g.state.pendingLevels=1;g.state.offers=['vitality'];
  assert.equal(g.chooseSkill('vitality'),true);assert.equal(p.maxHp,125);assert.equal(p.hp,65);assert.equal(g.stats().armorCap,62);
  assert.equal(g.chooseSkill('vitality'),false);assert.equal(p.hp,65);
  g.state.phase='upgrade';g.state.pendingLevels=1;g.state.offers=['vitality'];g.chooseSkill('vitality');assert.equal(p.maxHp,150);assert.equal(p.hp,90);
});
test('every level offers an eligible direct damage skill without duplicates',()=>{
  for(let seed=1;seed<=100;seed++){
    const {g,e}=encounter('normal',seededRandom(seed));e.hp=1;e.xp=24;hit(g);
    assert.equal(g.state.offers.length,3);assert.equal(new Set(g.state.offers).size,3);
    assert.ok(g.state.offers.some(id=>['first','third','edge','eye','speed'].includes(id)));
  }
});

test('damage-focused and unoptimized builds can both clear the rebalanced campaign',()=>{
  const damage=['edge','speed','third','first','eye','momentum','revenge','stand','killHeal','touch','opening','vitality','critHeal','critArmor','overflow'];
  for(const priority of [damage,null]){
    let wins=0;
    for(let seed=1;seed<=100;seed++){
      const g=createGame({random:seededRandom(seed)});let steps=0;
      while(!['victory','defeat'].includes(g.state.phase)&&steps++<100000){
        const s=g.state;
        if(s.phase==='ready')g.startWave();
        else if(s.phase==='rest')g.chooseRest(s.player.hp<s.player.maxHp*.8?'heal':'train');
        else if(s.phase==='upgrade')g.chooseSkill(priority?[...s.offers].sort((a,b)=>priority.indexOf(a)-priority.indexOf(b))[0]:s.offers[0]);
        else g.update(1/60);
      }
      assert.ok(steps<100000,'A run must finish without combat stalls');
      if(g.state.phase==='victory')wins++;
    }
    assert.ok(wins>=90,`${priority?'Damage':'First-offer'} strategy won ${wins}/100; expected at least 90`);
  }
});
test('pause freezes every timer and projectiles; invalid frame times do not mutate state',()=>{
  const {g}=encounter('archer');g.setPaused(true);const before=JSON.stringify(g.state);g.update(.1);g.update(NaN);g.update(-1);assert.equal(JSON.stringify(g.state),before);
  g.setPaused(false);g.update(.1);assert.ok(g.state.time>JSON.parse(before).time);
});
test('floating-point reach at the arena boundary cannot prevent attacking an archer',()=>{
  const {g,e,p}=encounter('archer');e.x=12;p.x=10.6;e.retreatCd=99;hit(g);assert.equal(e.hp,12);
});
test('boss escorts appear immediately, enrage adds no enemies, and surviving escorts block victory',()=>{
  const g=createGame({random:()=>.99});g.state.wave=9;g.startWave();g.state.bossIntro=0;
  assert.equal(g.state.enemies.length,4);
  const b=g.state.enemies.find(e=>e.type==='boss'),p=g.state.player;p.x=b.x-2;p.hp=10000;p.maxHp=10000;b.hp=326;b.cooldown=1000;p.cooldown=0;
  for(const e of g.state.enemies)if(e!==b){e.x=-10;e.cooldown=1000;}
  hit(g);assert.equal(b.enraged,true);assert.equal(b.phasePending,true);p.cooldown=1000;run(g,30);
  assert.equal(g.state.enemies.length,4);assert.equal(g.state.bossSummoned,false);run(g,50);assert.equal(g.state.enemies.length,4);
  p.x=b.x-2;b.hp=1;
  for(const e of g.state.enemies)if(e!==b)e.x=-10;
  hit(g);assert.equal(g.state.bossDead,true);assert.notEqual(g.state.phase,'victory');
  while(g.state.phase==='upgrade')g.chooseSkill(g.state.offers[0]);
  assert.equal(g.state.enemies.length,3);assert.equal(g.state.bossCall,0);
});
test('a lethal hit through the boss threshold leads to one victory when escorts are already defeated',()=>{
  const events=[],g=createGame({random:()=>.99,onEvent:e=>events.push(e)});g.state.wave=9;g.startWave();g.state.bossIntro=0;
  const b=g.state.enemies.find(e=>e.type==='boss');g.state.enemies=[b];b.hp=326;b.cooldown=1000;g.state.player.x=b.x-2;g.state.player.baseDamage=1000;hit(g);
  assert.equal(g.state.bossCall,0);assert.equal(g.state.bossSummoned,false);
  while(g.state.phase==='upgrade')g.chooseSkill(g.state.offers[0]);assert.equal(g.state.phase,'victory');run(g);
  assert.equal(events.filter(e=>e.type==='victory').length,1);
});
test('reset clears stale choice continuation, armor, skills, and pause state',()=>{
  const {g}=encounter();g.state.resumePhase='ready';g.state.player.armor=20;g.state.player.skills.edge=2;g.setPaused(true);g.reset();
  assert.equal(g.state.resumePhase,null);assert.equal(g.state.phase,'ready');assert.equal(g.state.paused,false);assert.equal(g.state.player.armor,0);assert.deepEqual(g.state.player.skills,{});
});
test('a complete ten-wave run is winnable with only earned skills and normal rest rewards',()=>{
  const events=[],g=createGame({random:seededRandom(2),onEvent:e=>events.push(e)});
  const priority=['killHeal','touch','edge','speed','overflow','critHeal','eye','critArmor','opening','third','momentum','vitality','first','stand','revenge'];
  let steps=0;
  while(!['victory','defeat'].includes(g.state.phase)&&steps++<30000){
    const s=g.state;
    if(s.phase==='ready')g.startWave();
    else if(s.phase==='rest')g.chooseRest(s.player.hp<s.player.maxHp*.8?'heal':'train');
    else if(s.phase==='upgrade')g.chooseSkill([...s.offers].sort((a,b)=>priority.indexOf(a)-priority.indexOf(b))[0]);
    else g.update(.05);
  }
  assert.equal(g.state.phase,'victory');assert.equal(g.state.wave,10);assert.ok(g.state.player.hp>0);
  assert.equal(events.filter(e=>e.type==='summon').length,0);assert.equal(events.filter(e=>e.type==='rest').length,9);
  const kills=events.filter(e=>e.type==='kill');assert.equal(new Set(kills.map(e=>e.enemy.id)).size,kills.length);
});

test('every wave deploys its entire formation synchronously, including boss escorts',()=>{
  for(let wave=1;wave<=10;wave++){
    const g=createGame({random:()=>.5});g.state.wave=wave-1;g.startWave();
    assert.deepEqual(g.state.enemies.map(e=>e.type),waveFormation(wave));assert.equal(g.state.spawns.length,0);
    assert.equal(g.state.waveTotal,g.state.enemies.length);assert.equal(new Set(g.state.enemies.map(e=>e.x)).size,g.state.waveTotal);
    assert.ok(g.state.enemies.every(e=>e.x>=-1&&e.x<=11));
    const snapshot=g.state.enemies.map(e=>({x:e.x,hp:e.hp}));g.update(.1);
    assert.deepEqual(g.state.enemies.map(e=>({x:e.x,hp:e.hp})),snapshot,'Intro holds formation for the first scene');
  }
});
test('stage progress counts kills within a wave and stays stable during rest',()=>{
  const g=createGame();assert.equal(progress(g.state).stagePercent,0);g.startWave();
  assert.deepEqual(progress(g.state),{total:3,defeated:0,remaining:3,wavePercent:0,stagePercent:0});
  g.state.kills=1;assert.equal(progress(g.state).stagePercent,3);assert.equal(progress(g.state).remaining,2);
  g.state.kills=3;g.state.phase='rest';assert.equal(progress(g.state).stagePercent,10);
  g.state.phase='ready';g.startWave();assert.equal(progress(g.state).stagePercent,10);assert.equal(progress(g.state).defeated,0);
  g.state.wave=10;g.state.waveTotal=4;g.state.waveStartKills=70;g.state.kills=74;assert.equal(progress(g.state).stagePercent,99);
  g.state.phase='victory';assert.equal(progress(g.state).stagePercent,100);
});
test('melee enemies keep formation and cannot charge an attack while waiting behind another fighter',()=>{
  const g=createGame({random:()=>.5});g.startWave();g.state.waveIntro=0;g.state.player.cooldown=100;
  const [front,back]=g.state.enemies;front.x=g.state.player.x+1.35;back.x=front.x+1.05;back.cooldown=1;
  for(let i=0;i<10;i++)g.update(.05);
  assert.ok(back.x-front.x>=1.04);assert.equal(back.cooldown,1);assert.equal(back.attacks,0);
});
test('music and SFX are independent, gated by user activation, and mute when suspended',async()=>{
  const oscillators=[],buses=[];
  const parameter=()=>({value:0,setValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(v){this.value=v;}});
  class FakeAudio {
    constructor(){this.currentTime=0;this.state='suspended';this.destination={};}
    async resume(){this.state='running';}
    createGain(){const node={gain:parameter(),connect(){},disconnect(){}};buses.push(node);return node;}
    createOscillator(){const node={frequency:parameter(),connect(){},disconnect(){},start(){},stop(){}};oscillators.push(node);return node;}
  }
  const audio=createAudio({Audio:FakeAudio});audio.tick();audio.effect('hit');assert.equal(oscillators.length,0);
  await audio.setMusic(true);audio.tick();assert.ok(oscillators.length>=3);assert.equal(audio.status().sfx,false);
  const beforeSfx=oscillators.length;audio.effect('hit');assert.equal(oscillators.length,beforeSfx);
  await audio.setSfx(true);audio.effect('hit');assert.ok(oscillators.length>beforeSfx);
  await audio.setMusic(false);assert.equal(buses[0].gain.value,0);assert.ok(buses[1].gain.value>0);
  audio.setSuspended(true);assert.equal(buses[1].gain.value,0);const beforePause=oscillators.length;audio.tick(true);audio.effect('slam');assert.equal(oscillators.length,beforePause);
  audio.setSuspended(false);assert.equal(buses[0].gain.value,0);assert.ok(buses[1].gain.value>0);
  audio.setVolumes(20,40);assert.equal(buses[0].gain.value,0);assert.equal(buses[1].gain.value,.65*.4);
  await audio.setMusic(true);assert.equal(buses[0].gain.value,.42*.2);
  audio.setVolumes(0,100);assert.equal(buses[0].gain.value,0);assert.equal(buses[1].gain.value,.65);
});
