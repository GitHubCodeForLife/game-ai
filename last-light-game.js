// Browser-independent combat simulation. Rendering never changes combat state.
export const SKILLS = [
  { id:'first', name:'First Strike', category:'critical', icon:'✦', trigger:'On Hit', max:1, text:()=>'Your first landed attack against EACH enemy always critically hits.' },
  { id:'touch', name:'Vital Touch', category:'healing', icon:'+', trigger:'On Hit', max:3, text:r=>`50% chance to heal ${[8,12,16][r-1]} HP.` },
  { id:'third', name:'Third Beat', category:'damage', icon:'Ⅲ', trigger:'On Every 3rd Hit', max:3, text:r=>`Add ${[18,30,42][r-1]} damage to this attack. Can critically hit.` },
  { id:'critHeal', name:'Critical Recovery', category:'healing', icon:'✧', trigger:'On Critical Hit', max:3, text:r=>`Heal ${[10,16,22][r-1]} HP.` },
  { id:'critArmor', name:'Tempered Edge', category:'armor', icon:'◇', trigger:'On Critical Hit', max:3, text:r=>`Gain ${[8,12,18][r-1]} armor.` },
  { id:'killHeal', name:'Second Wind', category:'healing', icon:'+', trigger:'On Enemy Die', max:3, text:r=>`Heal ${[8,12,16][r-1]} HP when you defeat an enemy.` },
  { id:'overflow', name:'Overflow Guard', category:'armor', icon:'⬡', trigger:'On Enemy Die', max:1, text:()=>'Gain 4 armor, then convert excess healing from the killing blow into more armor, 1:1.' },
  { id:'momentum', name:'Momentum', category:'damage', icon:'↗', trigger:'On Enemy Die', max:3, text:r=>`Your next hit gains +${[60,90,120][r-1]}% of base damage. Does not stack.` },
  { id:'opening', name:'Opening Guard', category:'armor', icon:'◇', trigger:'On Wave Start', max:3, text:r=>`Gain ${[20,35,50][r-1]} armor.` },
  { id:'stand', name:'Last Stand', category:'damage', icon:'!', trigger:'While HP Below 50%', max:3, text:r=>`Gain +${[60,90,120][r-1]}% of base damage.` },
  { id:'revenge', name:'Retribution', category:'damage', icon:'↶', trigger:'On HP Damage Taken', max:3, text:r=>`Your next hit deals +${[12,20,28][r-1]} damage. Does not stack.` },
  { id:'edge', name:'Sharpened Edge', category:'damage', icon:'/', trigger:'On Pick', max:3, text:r=>`Total attack bonus: +${r*40}% of base damage.` },
  { id:'eye', name:'Keen Eye', category:'critical', icon:'✦', trigger:'On Pick', max:3, text:r=>`Total critical chance bonus: +${r*15} percentage points.` },
  { id:'vitality', name:'Vitality', category:'healing', icon:'♡', trigger:'On Pick', max:3, text:r=>`Total maximum HP bonus: +${r*25}. Heal 25 HP immediately when picked or upgraded.` },
  { id:'speed', name:'Quick Hands', category:'damage', icon:'»', trigger:'On Pick', max:3, text:r=>`Attack interval reduced by ${[20,30,40][r-1]}%.` },
];
const DIRECT_DAMAGE_SKILLS = new Set(['first','third','edge','eye','speed']);
export const ENEMIES = {
  normal:{ name:'Raider', hp:42, damage:6, interval:1.8, speed:1.65, range:1.35, xp:10, windup:.3 },
  tanker:{ name:'Bulwark', hp:126, damage:12, interval:3.2, speed:.8, range:1.6, xp:25, windup:.8 },
  archer:{ name:'Longbow', hp:30, damage:5, interval:2.4, speed:1.15, range:8, xp:15, windup:.6 },
  boss:{ name:'Iron Warden', hp:650, damage:14, interval:3, speed:1, range:2.1, xp:100, windup:.8 },
};
export const WAVES = [
  [3,0,0], [4,0,1], [3,1,0], [4,1,1], [4,1,2], [4,2,1], [5,2,2], [6,2,2], [6,2,3],
];
export const WAVE_NAMES = ['First footsteps','Eyes in the trees','The shield wall','Three kinds of trouble','Under the arrows','A heavier burden','No easy passage','Hold your ground','The last light','The Iron Warden'];
export function waveFormation(wave,stage=null) {
  if(stage)return [...(stage.waves[wave-1]||[])];
  if(wave===10)return ['normal','normal','boss','archer'];
  const counts=WAVES[wave-1];if(!counts)return [];
  const [normal,tanker,archer]=counts;
  return [...Array(normal).fill('normal'),...Array(tanker).fill('tanker'),...Array(archer).fill('archer')];
}
export function progress(state) {
  const total=state.waveTotal||0,defeated=Math.min(total,Math.max(0,state.kills-(state.waveStartKills||0)));
  const fraction=total?defeated/total:0;
  const percent=state.wave?Math.round((state.wave-1+fraction)/(state.totalWaves||10)*100):0;
  return {total,defeated,remaining:total-defeated,wavePercent:Math.round(fraction*100),stagePercent:state.phase==='victory'?100:Math.min(99,percent)};
}
export function seededRandom(seed=Date.now()) { let n=seed>>>0; return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;}; }
export function createGame({ random=seededRandom(), onEvent=()=>{},stage=null,upgrades={} }={}) {
  const state = {};
  let selectedStage=stage,permanent=upgrades;
  let uid=0;
  const rank=id=>state.player.skills[id]||0;
  const value=(id,values)=>rank(id)?values[rank(id)-1]:0;
  const emit=(type,data={})=>onEvent({type,...data});
  const maxArmor=()=>Math.floor(state.player.maxHp/2);
  function reset(options={}) {
    if('stage' in options)selectedStage=options.stage;
    if('upgrades' in options)permanent=options.upgrades;
    uid=0;
    Object.assign(state, { phase:'ready', resumePhase:null, paused:false, speed:1, wave:0, time:0, kills:0, pendingLevels:0, offers:[], enemies:[], projectiles:[], spawns:[], waveTime:0, restChosen:false, bossSummoned:false, bossDead:false, bossCall:0, bossIntro:0, player:{ x:-6,hp:100,maxHp:100,armor:0,baseDamage:18,baseInterval:.85,level:1,xp:0,nextXp:24,skills:{},hits:0,firstUsed:false,momentum:false,revenge:false,cooldown:.25,facing:1,moving:false,attackAt:-10,hitAt:-10,flatDamage:0 } });
    state.waveTotal=0;state.waveStartKills=0;state.waveIntro=0;
    state.stage=selectedStage;state.totalWaves=selectedStage?.waves.length||10;state.completedWaves=0;
    state.player.baseDamage=18+2*Math.max(0,Math.min(5,permanent.blade||0));
    state.player.armor=selectedStage?.practice?15:5*Math.max(0,Math.min(5,permanent.armor||0));
    emit('reset');
  }
  function stats() {
    const p=state.player;
    return { damage:p.baseDamage*(1+rank('edge')*.4)+p.flatDamage, crit:Math.min(1,.05+rank('eye')*.15), interval:p.baseInterval*(1-value('speed',[.2,.3,.4])), armorCap:maxArmor() };
  }
  function armor(amount) {
    const p=state.player, gained=Math.min(Math.max(0,amount),maxArmor()-p.armor);
    p.armor+=gained;
    if(gained>0)emit('float',{x:p.x,text:`+${gained} ARMOR`,kind:'armor'});
  }
  function heal(amount,convert=false) {
    const p=state.player, restored=Math.min(amount,p.maxHp-p.hp);
    p.hp+=restored;
    if(restored>0)emit('float',{x:p.x,text:`+${restored} HP`,kind:'heal'});
    if(convert&&rank('overflow'))armor(amount-restored);
  }
  function offer() {
    const eligible=SKILLS.filter(s=>rank(s.id)<s.max&&(s.id!=='overflow'||rank('touch')||rank('critHeal')||rank('killHeal')));
    for(let i=eligible.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[eligible[i],eligible[j]]=[eligible[j],eligible[i]];}
    state.offers=eligible.slice(0,3).map(s=>s.id);
    if(selectedStage?.practice)state.offers=['first','touch','edge'].filter(id=>eligible.some(s=>s.id===id));
    // Avoid a full set of support choices when the build still needs damage.
    if(!state.offers.some(id=>DIRECT_DAMAGE_SKILLS.has(id))){
      const damageOption=eligible.find(s=>DIRECT_DAMAGE_SKILLS.has(s.id));
      if(damageOption)state.offers[state.offers.length-1]=damageOption.id;
    }
    if(!state.offers.length)state.offers=['fallback'];
    state.phase='upgrade'; emit('levelUp');
  }
  function addXp(amount) {
    const p=state.player;p.xp+=amount;
    while(p.xp>=p.nextXp){p.xp-=p.nextXp;p.level++;p.nextXp=24+(p.level-1)*8;state.pendingLevels++;}
  }
  function finishWave() {
    state.projectiles=[];
    state.completedWaves=state.wave;
    if(state.wave===state.totalWaves){state.phase='victory';emit('victory');}
    else {state.phase='rest';state.restChosen=false;emit('waveClear');}
  }
  function settle() {
    if(state.phase==='defeat')return;
    if(state.pendingLevels>0){offer();return;}
    if(state.resumePhase==='ready'){state.resumePhase=null;state.phase='ready';return;}
    if(!state.spawns.length&&!state.enemies.length&&!state.bossCall){finishWave();return;}
    state.phase='combat';
  }
  function chooseSkill(id) {
    if(state.phase!=='upgrade'||state.paused||!state.offers.includes(id))return false;
    if(id==='fallback')state.player.flatDamage+=6;
    else {
      state.player.skills[id]=rank(id)+1;
      if(id==='vitality'){state.player.maxHp=100+rank(id)*25;heal(25);}
    }
    state.pendingLevels--;state.offers=[];emit('skill',{id});settle();return true;
  }
  function spawn(type,x=11) {
    const scale=selectedStage?.scale||1;
    const d={...ENEMIES[type]};
    if(selectedStage){
      d.hp=Math.round(d.hp*scale);d.damage=Math.max(1,Math.round(d.damage*scale));
      if(type==='boss')Object.assign(d,selectedStage.boss,{bossPattern:selectedStage.boss.pattern});
      if(selectedStage.practice){d.hp=type==='normal'?18:24;d.xp=24;d.damage=1;}
    }
    const e={...d,type,id:++uid,x,maxHp:d.hp,hitCount:0,facing:-1,cooldown:.8+random()*.5,wind:0,attacks:0,action:null,double:0,guard:false,retreat:0,retreatCd:0,enraged:false,phasePending:false,hitAt:-10,attackAt:-10,moving:false};
    state.enemies.push(e);emit('spawn',{enemy:e});return e;
  }
  function startWave() {
    if(state.phase!=='ready'||state.paused||state.wave>=state.totalWaves)return false;
    state.wave++;state.phase='combat';state.waveTime=0;state.player.x=-7;state.waveStartKills=state.kills;
    Object.assign(state.player,{hits:0,firstUsed:false,momentum:false,revenge:false,cooldown:.3});
    state.bossCall=0;state.bossIntro=0;state.bossSummoned=false;state.bossDead=false;
    armor(value('opening',[20,35,50]));
    state.spawns=[];state.enemies=[];
    const formation=waveFormation(state.wave,selectedStage);state.waveTotal=formation.length;
    formation.forEach((type,i)=>spawn(type,-1+i*(12/Math.max(1,formation.length-1))));
    state.waveIntro=1.5;
    if(formation.includes('boss')){state.bossIntro=2;state.waveIntro=0;}
    emit('waveStart');return true;
  }
  function chooseRest(choice) {
    if(state.phase!=='rest'||state.restChosen||state.paused||!['heal','train'].includes(choice))return false;
    if(choice==='heal'&&state.player.hp>=state.player.maxHp)return false;
    state.restChosen=true;
    if(choice==='heal')heal(Math.ceil(state.player.maxHp*.25));
    else addXp(Math.ceil(state.player.nextXp*.3));
    state.phase='ready';state.resumePhase='ready';
    if(state.pendingLevels)offer();else state.resumePhase=null;
    emit('rest',{choice});return true;
  }
  function hurtPlayer(amount) {
    const p=state.player;
    if(state.phase==='defeat')return;
    const blocked=Math.min(p.armor,amount);p.armor-=blocked;
    const lost=Math.min(p.hp,amount-blocked);p.hp-=lost;p.hitAt=state.time;
    if(blocked)emit('float',{x:p.x,text:`−${blocked} ARMOR`,kind:'armor'});
    if(lost){emit('float',{x:p.x,text:`−${lost} HP`,kind:'hurt'});if(rank('revenge'))p.revenge=true;}
    emit('playerHit',{amount:lost});
    if(p.hp<=0){state.phase='defeat';state.projectiles=[];state.offers=[];emit('defeat');}
  }
  function hitEnemy(e) {
    const p=state.player;if(!e||e.hp<=0||state.phase!=='combat')return;
    p.hits++;p.attackAt=state.time;
    const critical=(e.hitCount===0&&rank('first'))||random()<stats().crit;
    e.hitCount++;
    p.firstUsed=true;
    let damage=stats().damage;
    if(p.hp/p.maxHp<.5)damage+=p.baseDamage*value('stand',[.6,.9,1.2]);
    if(p.momentum)damage+=p.baseDamage*value('momentum',[.6,.9,1.2]);
    if(p.revenge)damage+=value('revenge',[12,20,28]);
    if(p.hits%3===0)damage+=value('third',[18,30,42]);
    p.momentum=false;p.revenge=false;
    if(critical)damage*=2;
    const guarded=e.guard;
    if(guarded){damage*=.7;e.guard=false;}
    const lost=Math.min(e.hp,Math.max(1,Math.floor(damage)));e.hp-=lost;e.hitAt=state.time;
    emit('hit',{enemy:e,critical:!!critical,damage:lost});
    emit('float',{x:e.x,text:`${guarded?'GUARD ':critical?'CRIT ':''}−${lost} HP`,kind:critical?'critical':'damage'});
    let healing=0;
    if(rank('touch')&&random()<.5)healing+=value('touch',[8,12,16]);
    if(critical){healing+=value('critHeal',[10,16,22]);armor(value('critArmor',[8,12,18]));}
    const killed=e.hp<=0;
    if(killed){
      healing+=value('killHeal',[8,12,16]);p.momentum=!!rank('momentum');state.kills++;
      if(rank('overflow'))armor(4);
      state.enemies=state.enemies.filter(other=>other!==e);
      if(e.type==='boss'){state.bossDead=true;state.bossCall=0;state.spawns=[];}
      addXp(e.xp);emit('kill',{enemy:e});
    }
    heal(healing,killed);
    if(!killed&&e.type==='boss'&&['warden','sun'].includes(e.bossPattern||'warden')&&e.hp<=e.maxHp/2&&!e.enraged){e.enraged=true;e.phasePending=true;emit('enrage');}
    settle();
  }
  function enemyImpact(e) {
    const p=state.player,action=e.action;
    e.attackAt=state.time;
    if(e.type==='archer') {
      state.projectiles.push({id:++uid,x:e.x,y:1.35,direction:Math.sign(p.x-e.x)||-1,speed:9,damage:action==='aim'?Math.round(e.damage*1.8):e.damage});
      emit('arrow',{x:e.x});
    } else if(action==='slam'||Math.abs(p.x-e.x)<=e.range+.45) {
      const doubleDamage=e.type==='boss'?Math.round(e.damage*.65):Math.max(1,Math.round(e.damage*2/3));
      hurtPlayer(action==='slam'?Math.round(e.damage*22/14):action==='bash'?Math.round(e.damage*4/3):action==='double'?doubleDamage:action==='heavy'?Math.round(e.damage*1.4):e.damage);
      if(action==='double'){e.double=.25;e.doubleDamage=doubleDamage;}
      if(action==='slam')emit('slam');
    }
    if(e.type==='tanker'&&e.attacks%2===0||e.type==='boss'&&e.bossPattern==='guard')e.guard=true;
    const interval=e.type==='boss'&&e.enraged?e.interval*.8:e.interval;
    e.cooldown=Math.max(action==='slam'?1:.35,interval-e.windDuration);
    e.action=null;
  }
  function updateEnemy(e,dt) {
    const p=state.player;
    e.moving=false;e.retreatCd=Math.max(0,e.retreatCd-dt);
    const distance=Math.abs(e.x-p.x);e.facing=Math.sign(p.x-e.x)||-1;
    if(e.double>0){e.double-=dt;if(e.double<=0&&distance<=e.range+.45)hurtPlayer(e.doubleDamage||4);}
    if(e.wind>0){e.wind-=dt;if(e.wind<=0)enemyImpact(e);return;}
    if(e.type==='boss'&&e.phasePending){
      e.phasePending=false;e.cooldown=Math.max(e.cooldown,.5);return;
    }
    if(e.type==='boss'&&state.bossCall>0)return;
    if(e.type==='archer'&&distance<1.75&&e.retreatCd<=0&&e.x<12){e.retreat=.6;e.retreatCd=6;}
    if(e.retreat>0){e.retreat-=dt;e.x=Math.min(12,e.x-e.facing*2*dt);e.moving=true;return;}
    if(distance>e.range+.01){
      let travel=Math.min(e.speed*dt,distance-e.range);
      if(e.type!=='archer'){
        const ahead=state.enemies.filter(other=>other!==e&&other.type!=='archer'&&(other.x-e.x)*e.facing>0&&(p.x-other.x)*e.facing>=0);
        for(const other of ahead)travel=Math.min(travel,Math.max(0,Math.abs(other.x-e.x)-1.05));
      }
      e.x+=e.facing*travel;e.moving=travel>0;return;
    }
    // Waiting in formation cannot pre-charge an immediate attack on arrival.
    e.cooldown=Math.max(0,e.cooldown-dt);
    if(e.cooldown>0)return;
    // All archers are visible from the start, but take firing turns so instant
    // deployment does not multiply ranged pressure by the size of the wave.
    if(e.type==='archer'){
      const archers=state.enemies.filter(other=>other.type==='archer');
      if(archers[Math.floor(state.waveTime/2.4)%archers.length]!==e)return;
    }
    e.attacks++;
    e.action=e.type==='normal'&&e.attacks%3===0?'double':e.type==='tanker'&&e.attacks%3===0?'bash':e.type==='archer'&&e.attacks%3===0?'aim':e.type==='boss'&&e.attacks%3===0?'slam':'basic';
    if(e.type==='boss'){
      const pattern=e.bossPattern||'warden';
      if(pattern==='heavy'||pattern==='guard')e.action='heavy';
      if(pattern==='double'||pattern==='cuts')e.action=e.attacks%2===0?'double':'basic';
      if(pattern==='sun')e.action=e.attacks%2===0?'slam':'basic';
    }
    e.windDuration=e.action==='heavy'?1.4:e.action==='bash'?1:e.action==='aim'?1.2:e.action==='slam'?1.5:e.windup;e.wind=e.windDuration;
    if(e.action==='slam')emit('warning',{text:e.bossPattern==='sun'?'SUNSTONE SHOCKWAVE':'GROUND SLAM',duration:1.5});
  }
  function update(dt) {
    if(!Number.isFinite(dt)||dt<=0||state.paused||state.phase!=='combat')return;
    dt=Math.min(dt,.1);state.time+=dt;
    if(state.bossIntro>0){state.bossIntro=Math.max(0,state.bossIntro-dt);return;}
    if(state.waveIntro>0){state.waveIntro=Math.max(0,state.waveIntro-dt);return;}
    state.waveTime+=dt;
    while(state.spawns.length&&state.spawns[0].at<=state.waveTime)spawn(state.spawns.shift().type);
    for(const arrow of state.projectiles){
      const before=arrow.x;arrow.x+=arrow.direction*arrow.speed*dt;
      if((before-state.player.x)*(arrow.x-state.player.x)<=0||Math.abs(arrow.x-state.player.x)<.4){arrow.dead=true;hurtPlayer(arrow.damage);if(state.phase==='defeat')return;}
      if(Math.abs(arrow.x)>16)arrow.dead=true;
    }
    state.projectiles=state.projectiles.filter(a=>!a.dead);
    // Incoming damage wins ties; a simultaneous kill cannot revive a dead player.
    for(const e of state.enemies){updateEnemy(e,dt);if(state.phase==='defeat')return;}
    const p=state.player;p.moving=false;p.cooldown=Math.max(0,p.cooldown-dt);
    const target=state.enemies.reduce((best,e)=>!best||Math.abs(e.x-p.x)<Math.abs(best.x-p.x)?e:best,null);
    if(target){
      const distance=Math.abs(target.x-p.x);p.facing=Math.sign(target.x-p.x)||1;
      const reach=target.type==='boss'?2:target.type==='tanker'?1.6:1.4;
      if(distance>reach+.01){p.x+=p.facing*Math.min(3.2*dt,distance-reach);p.x=Math.max(-12,Math.min(12,p.x));p.moving=true;}
      else if(p.cooldown<=0){p.cooldown=stats().interval;hitEnemy(target);}
    }
    if(state.phase==='combat'&&!state.enemies.length&&!state.spawns.length&&!state.bossCall)settle();
  }
  function setPaused(value){state.paused=!!value;emit('pause');}
  reset();
  return {state,stats,reset,startWave,chooseSkill,chooseRest,update,setPaused};
}
