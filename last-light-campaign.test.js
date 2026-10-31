import test from 'node:test';
import assert from 'node:assert/strict';
import {STAGES,PRACTICE,createCampaign,freshProfile,SAVE_KEY,isUnlocked,rewardFor,startingStats} from './last-light-campaign.js';
import {createGame,seededRandom,progress} from './last-light-game.js';
function memory(initial=null){let raw=initial;return {getItem:()=>raw,setItem:(_key,value)=>{raw=value;},get raw(){return raw;}};}
function finish(c,stage=STAGES[0],outcome='victory',completed=stage.waves.length){const run=c.begin(stage.id);return c.settle({...run,completed,wave:completed,kills:stage.waves.slice(0,completed).flat().length,level:5,skills:{edge:2,first:1},outcome});}
test('six stages have valid finite formations and bosses only in their final wave',()=>{
  assert.deepEqual(STAGES.map(s=>s.waves.length),[5,8,10,6,8,12]);
  for(const stage of STAGES){assert.ok(stage.waves.every(w=>w.length>0));assert.equal(stage.waves.flat().filter(t=>t==='boss').length,1);assert.ok(stage.waves.at(-1).includes('boss'));}
});
test('first-visit introduction survives preferences and reload until explicitly skipped or completed',()=>{
  const storage=memory(),first=createCampaign(storage);
  assert.equal(first.needsIntroduction,true);assert.equal(storage.raw,null);
  first.preferences({music:35});
  const returning=createCampaign(storage);assert.equal(returning.needsIntroduction,true);
  returning.onboarding();
  const skipped=createCampaign(storage);assert.equal(skipped.needsIntroduction,false);assert.equal(skipped.profile.onboarding.complete,false);
  skipped.onboarding(true);
  const completed=createCampaign(storage);assert.equal(completed.needsIntroduction,false);assert.equal(completed.profile.onboarding.complete,true);
  assert.equal(completed.profile.gold,0);assert.deepEqual(completed.profile.clears,[]);
});
test('first-clear rewards, partial rewards, and unlock branches persist exactly once',()=>{
  const storage=memory(),c=createCampaign(storage);
  assert.equal(isUnlocked(c.profile,STAGES[1]),false);assert.throws(()=>c.begin(STAGES[1].id),/locked/);
  const first=finish(c);assert.equal(first.reward.total,120);assert.equal(c.profile.gold,120);assert.ok(isUnlocked(c.profile,STAGES[1]));
  c.settle(first);assert.equal(c.profile.gold,120);
  assert.equal(finish(c).reward.total,90);assert.equal(c.profile.gold,210);
  finish(c,STAGES[1]);assert.ok(isUnlocked(c.profile,STAGES[2]));assert.ok(isUnlocked(c.profile,STAGES[3]));
  assert.equal(finish(c,STAGES[0],'defeat',3).reward.total,30);
  const restored=createCampaign(storage);assert.deepEqual(restored.profile,c.profile);
  assert.equal(rewardFor(STAGES[5],12,'victory',true).total,342);
});
test('purchases are affordable, capped, atomic, and starting stats carry into a fresh run',()=>{
  const c=createCampaign(memory());assert.throws(()=>c.buy('blade'),/Not enough/);finish(c);
  c.buy('blade');c.buy('armor');assert.equal(c.profile.gold,70);assert.deepEqual(startingStats(c.profile),{damage:20,armor:5,hp:100});
  const run=c.begin(STAGES[0].id);assert.throws(()=>c.buy('blade'),/between runs/);c.settle({...run,outcome:'abandoned'});
  c.toggleTest();for(let i=0;i<4;i++)c.buy('blade');assert.equal(c.profile.upgrades.blade,5);assert.throws(()=>c.buy('blade'),/Maximum/);
  const game=createGame({stage:STAGES[0],upgrades:c.profile.upgrades});assert.equal(game.state.player.baseDamage,28);assert.equal(game.state.player.armor,5);
  game.state.player.armor=2;game.startWave();assert.equal(game.state.player.armor,2,'Permanent armor does not refill on wave start');
  game.reset();assert.equal(game.state.player.armor,5);assert.deepEqual(game.state.player.skills,{});
});
test('a failed storage write never changes the wallet, ranks, or receipt; retry is safe',()=>{
  const storage=memory(),c=createCampaign(storage);finish(c);const before=c.profile;
  const write=storage.setItem;storage.setItem=()=>{throw Error('Quota exceeded');};assert.throws(()=>c.buy('blade'),/Quota/);assert.deepEqual(c.profile,before);
  storage.setItem=write;c.buy('blade');assert.equal(c.profile.gold,95);
  const active=c.begin(STAGES[0].id),result={...active,completed:2,wave:3,outcome:'defeat'};storage.setItem=()=>{throw Error('Quota');};assert.throws(()=>c.settle(result));assert.equal(c.profile.active.id,active.id);
  storage.setItem=write;c.settle(result);c.settle(result);assert.equal(c.profile.gold,115);
});
test('interruption pays the last saved completed waves and never grants completion bonuses',()=>{
  const storage=memory(),c=createCampaign(storage),run=c.begin(STAGES[0].id);
  c.checkpoint({...run,completed:3,wave:4,kills:10});const restored=createCampaign(storage);
  const receipt=restored.settle({...restored.profile.active,outcome:'interrupted'});assert.equal(receipt.reward.total,30);assert.deepEqual(restored.profile.clears,[]);assert.equal(restored.profile.active,null);
  assert.equal(createCampaign(storage).profile.gold,30);
});
test('TUGAME test profile is isolated, including free purchases, stage clears, settings, and reload',()=>{
  const storage=memory(),c=createCampaign(storage);c.onboarding();const real=c.profile;const raw=storage.raw;
  c.toggleTest();for(let i=0;i<5;i++)c.buy('blade');finish(c);c.preferences({motion:'on',sfx:15});assert.ok(c.profile.clears.length);assert.equal(c.profile.upgrades.blade,5);
  assert.equal(storage.raw,raw);assert.deepEqual(createCampaign(storage).profile,real);
  c.toggleTest();assert.deepEqual(c.profile,real);
});
test('unreadable saves are preserved and stale tabs cannot overwrite a newer profile',()=>{
  const bad=memory('{broken'),c=createCampaign(bad);assert.ok(c.error);assert.throws(()=>c.onboarding());assert.equal(bad.raw,'{broken');
  const storage=memory(),one=createCampaign(storage),two=createCampaign(storage);one.onboarding();assert.throws(()=>two.preferences({music:30}),/another tab/);assert.equal(createCampaign(storage).profile.onboarding.dismissed,true);
});
test('TUGAME opens every region and stage without marking any stage cleared',()=>{
  const storage=memory(),c=createCampaign(storage);c.onboarding();const before=storage.raw;
  c.toggleTest();
  for(const stage of STAGES){
    assert.ok(isUnlocked(c.profile,stage,c.test));
    const run=c.begin(stage.id);c.settle({...run,outcome:'abandoned'});
  }
  assert.deepEqual(c.profile.clears,[]);assert.equal(storage.raw,before);
  assert.throws(()=>createCampaign(storage).begin(STAGES[5].id),/locked/);
  c.toggleTest();assert.equal(isUnlocked(c.profile,STAGES[5],c.test),false);assert.throws(()=>c.begin(STAGES[5].id),/locked/);
});
test('invalid and incomplete victories do not award gold',()=>{
  const c=createCampaign(memory()),r=c.begin(STAGES[0].id);assert.throws(()=>c.settle({...r,outcome:'victory',completed:2}));assert.equal(c.profile.gold,0);
  assert.throws(()=>c.checkpoint({...r,completed:99}));assert.equal(c.profile.active.completed,0);
});
test('volume settings preserve the last nonzero level independently across reloads',()=>{
  const storage=memory(),c=createCampaign(storage);c.preferences({music:37,sfx:72});c.preferences({music:0,musicMuted:true});
  const p=createCampaign(storage).profile.settings;assert.equal(p.music,0);assert.equal(p.lastMusic,37);assert.equal(p.sfx,72);assert.equal(p.lastSfx,72);
});
function play(stage,seed,upgrades={},strategy='damage'){
  const events=[];const g=createGame({stage,upgrades,random:seededRandom(seed),onEvent:e=>events.push(e.type)});let ticks=0;
  const priority=strategy==='first'?[]:['first','edge','third','speed','eye','killHeal','touch','opening','critHeal','critArmor','overflow','momentum','stand','revenge','vitality'];
  while(!['victory','defeat'].includes(g.state.phase)&&ticks++<150000){
    if(g.state.phase==='ready'){g.startWave();assert.equal(g.state.enemies.length,stage.waves[g.state.wave-1].length);}
    else if(g.state.phase==='upgrade')g.chooseSkill(priority.find(id=>g.state.offers.includes(id))||g.state.offers[0]);
    else if(g.state.phase==='rest')g.chooseRest(g.state.player.hp<g.state.player.maxHp*.8?'heal':'train');
    else g.update(1/60);
  }
  assert.ok(ticks<150000,'No stalled encounters');return {g,events};
}
test('all six stage lengths finish, reward their own final wave, and remain winnable with earned skills',()=>{
  for(const stage of STAGES){
    for(const upgrades of [{blade:0,armor:0},{blade:2,armor:2},{blade:5,armor:5}]){
      let wins=0;for(let seed=1;seed<=30;seed++){const {g,events}=play(stage,seed,upgrades);if(g.state.phase==='victory'){wins++;assert.equal(g.state.completedWaves,stage.waves.length);assert.equal(progress(g.state).stagePercent,100);assert.equal(events.filter(e=>e==='waveClear').length,stage.waves.length-1);assert.equal(events.filter(e=>e==='victory').length,1);}}
      assert.ok(wins>=24,stage.name+' wins '+wins+'/30 at '+JSON.stringify(upgrades));
    }
  }
});
test('practice gives a fixed skill choice and completes without a boss or permanent upgrades',()=>{
  const {g}=play(PRACTICE,8);assert.equal(g.state.phase,'victory');assert.equal(g.state.wave,2);assert.equal(g.state.bossDead,false);assert.equal(g.state.player.baseDamage,18);
});
test('boss patterns remain distinct: heavy, double, guard, and enrage',()=>{
  for(const stage of STAGES){
    const g=createGame({stage,random:()=>.5});g.state.wave=stage.waves.length-1;g.startWave();g.state.waveIntro=0;g.state.bossIntro=0;
    const boss=g.state.enemies.find(e=>e.type==='boss');g.state.enemies=[boss];g.state.player.x=0;g.state.player.cooldown=1e6;g.state.player.hp=g.state.player.maxHp=100000;boss.x=1.8;boss.cooldown=0;
    const actions=new Set();for(let i=0;i<1400;i++){g.update(1/60);if(boss.action)actions.add(boss.action);}
    const pattern=stage.boss.pattern;if(['heavy','guard'].includes(pattern))assert.ok(actions.has('heavy'));if(['double','cuts'].includes(pattern))assert.ok(actions.has('double'));if(['warden','sun'].includes(pattern))assert.ok(actions.has('slam'));if(pattern==='guard')assert.ok(boss.guard);
  }
});
