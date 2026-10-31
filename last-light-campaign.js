// Campaign content and atomic, versioned local progression. No rendering dependencies.
const formation = (normal=0,tanker=0,archer=0) => [...Array(normal).fill('normal'),...Array(tanker).fill('tanker'),...Array(archer).fill('archer')];
const waves = (rows,bossEscorts=[1,0,0]) => [...rows.map(row=>formation(...row)),[...formation(bossEscorts[0],bossEscorts[1]),'boss',...formation(0,0,bossEscorts[2])]];
export const STAGES = [
  {id:'jp-bamboo',region:'Japan',theme:'bamboo',name:'Bamboo Pass',difficulty:'Easy',requires:null,scale:.8,boss:{name:'Pass Sentinel',pattern:'heavy',hp:210,damage:9,interval:3.6},description:'A quiet bamboo road. Learn the blade before facing a slow, powerful guardian.',waves:waves([[2],[3],[3,0,1],[3,1]], [1,0,0]),rewards:[10,40,30]},
  {id:'jp-lantern',region:'Japan',theme:'lantern',name:'Lantern Village',difficulty:'Normal',requires:'jp-bamboo',scale:.95,boss:{name:'Lantern Captain',pattern:'double',hp:420,damage:12,interval:2.8},description:'A moonlit village. Archers hide behind guards; the Captain strikes twice.',waves:waves([[3],[4,0,1],[3,1],[4,1,1],[4,1,2],[4,2,1],[5,2,2]],[2,0,1]),rewards:[14,56,42]},
  {id:'jp-fortress',region:'Japan',theme:'fortress',name:'Mountain Fortress',difficulty:'Hard',requires:'jp-lantern',scale:1,boss:{name:'Iron Warden',pattern:'warden',hp:650,damage:14,interval:3},description:'The end of the Iron Road. Survive Ground Slam and the Warden’s half-health enrage.',waves:waves([[3],[4,0,1],[3,1],[4,1,1],[4,1,2],[4,2,1],[5,2,2],[6,2,2],[6,2,3]],[2,0,1]),rewards:[18,72,54]},
  {id:'eg-desert',region:'Egypt',theme:'desert',name:'Desert Crossing',difficulty:'Easy',requires:'jp-lantern',scale:.82,boss:{name:'Dune Guardian',pattern:'cuts',hp:280,damage:10,interval:3.4},description:'Cross the golden dunes. The guardian’s quick cuts leave a long recovery.',waves:waves([[2],[3,0,1],[4],[3,1],[4,0,2]],[1,0,1]),rewards:[10,40,30]},
  {id:'eg-temple',region:'Egypt',theme:'temple',name:'Temple Gates',difficulty:'Normal',requires:'eg-desert',scale:1,boss:{name:'Gate Colossus',pattern:'guard',hp:480,damage:13,interval:3.3},description:'Stone sentinels defend the gates. Break the Colossus’s Guard between heavy strikes.',waves:waves([[3],[3,0,1],[3,1],[4,1,1],[4,2],[4,1,2],[5,2,1]],[1,1,1]),rewards:[14,56,42]},
  {id:'eg-sanctuary',region:'Egypt',theme:'sanctuary',name:'Buried Sanctuary',difficulty:'Hard',requires:'eg-temple',scale:1.08,boss:{name:'Sunstone Guardian',pattern:'sun',hp:780,damage:15,interval:3.2},description:'A buried hall of gold and stone. The guardian’s shockwave grows faster below half health.',waves:waves([[3],[4,0,1],[3,1],[4,1,1],[4,2],[4,1,2],[5,2,1],[5,2,2],[6,2,2],[6,2,3],[6,3,2]],[2,0,2]),rewards:[18,72,54]},
];
export const PRACTICE = {id:'practice',region:'Japan',theme:'bamboo',name:'The First Lesson',description:'Your fighter attacks automatically. Choose a skill, rest, then complete the final practice wave. No gold or upgrades are changed.',difficulty:'Practice',practice:true,scale:.45,boss:null,waves:[['normal'],['normal','archer']],rewards:[0,0,0]};
export const UPGRADE_COSTS=[25,50,90,140,200];
export const SAVE_KEY='last-light.profile.v1';
export const getStage=id=>STAGES.find(stage=>stage.id===id);
export const isUnlocked=(profile,stage,testMode=false)=>testMode||!stage.requires||profile.clears.includes(stage.requires);
export const enemyNames=stage=>stage.region==='Egypt'?{normal:'Skirmisher',tanker:'Stone Sentinel',archer:'Bow Scout',boss:stage.boss?.name}:{normal:'Raider',tanker:'Bulwark',archer:'Longbow',boss:stage.boss?.name};
export const startingStats=profile=>({damage:18+2*profile.upgrades.blade,armor:5*profile.upgrades.armor,hp:100});
export function rewardFor(stage,completed,outcome,firstClear=false){
  const count=Math.min(stage.waves.length,Math.max(0,Math.floor(completed)));
  const win=outcome==='victory'&&count===stage.waves.length;
  const [perWave,bonus,first]=stage.rewards;
  return {wave:count*perWave,victory:win?bonus:0,first:win&&firstClear?first:0,total:count*perWave+(win?bonus:0)+(win&&firstClear?first:0)};
}
const clone=value=>JSON.parse(JSON.stringify(value));
export function freshProfile(){return {version:1,revision:0,gold:0,upgrades:{blade:0,armor:0},clears:[],onboarding:{dismissed:false,complete:false},settings:{music:60,sfx:80,lastMusic:60,lastSfx:80,musicMuted:false,sfxMuted:true,motion:'system'},active:null,lastResult:null,settled:[]};}
const integer=(n,min,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
function validateSummary(s){
  const stage=getStage(s?.stageId);
  return !!stage&&typeof s.id==='string'&&s.id.length<150&&integer(s.completed,0,stage.waves.length)&&integer(s.wave,0,stage.waves.length)&&integer(s.kills,0)&&integer(s.level,1,1000)&&s.skills&&typeof s.skills==='object'&&!Array.isArray(s.skills)&&Object.values(s.skills).every(n=>integer(n,0,3))&&['active','victory','defeat','abandoned','interrupted'].includes(s.outcome);
}
export function validateProfile(p){
  if(!p||p.version!==1||!integer(p.revision,0)||!integer(p.gold,0)||!integer(p.upgrades?.blade,0,5)||!integer(p.upgrades?.armor,0,5)||!Array.isArray(p.clears)||!p.clears.every(id=>getStage(id))||new Set(p.clears).size!==p.clears.length)throw Error('This save is not readable. Your stored data has been preserved.');
  if(!p.settings||!integer(p.settings.music,0,100)||!integer(p.settings.sfx,0,100)||!['system','on','off'].includes(p.settings.motion)||typeof p.settings.musicMuted!=='boolean'||typeof p.settings.sfxMuted!=='boolean'||typeof p.onboarding?.complete!=='boolean'||typeof p.onboarding?.dismissed!=='boolean'||!Array.isArray(p.settled)||!p.settled.every(id=>typeof id==='string'))throw Error('Saved preferences are not readable. Your stored data has been preserved.');
  if(p.active&&!validateSummary(p.active))throw Error('The saved run record is not readable. Your stored data has been preserved.');
  if(p.lastResult&&(!validateSummary(p.lastResult)||!integer(p.lastResult.reward?.total,0)||!integer(p.lastResult.balance,0)))throw Error('The last result is not readable. Your stored data has been preserved.');
  p.settings.lastMusic=p.settings.lastMusic??(p.settings.music||60);p.settings.lastSfx=p.settings.lastSfx??(p.settings.sfx||80);
  if(!integer(p.settings.lastMusic,1,100)||!integer(p.settings.lastSfx,1,100))throw Error('Saved volume preferences are not readable.');
  return p;
}
export function createCampaign(storage){
  let profile,loadError=null,testProfile=null;
  try{const raw=storage.getItem(SAVE_KEY);profile=raw?validateProfile(JSON.parse(raw)):freshProfile();}catch(error){loadError=error;profile=freshProfile();}
  const current=()=>testProfile||profile;
  function transact(fn){
    if(loadError)throw loadError;
    const next=clone(current());const result=fn(next);next.revision++;
    validateProfile(next);
    if(testProfile){testProfile=next;return result;}
    // A second tab must not overwrite a newer wallet or run receipt.
    const raw=storage.getItem(SAVE_KEY);
    if(raw&&JSON.parse(raw).revision!==profile.revision)throw Error('Progress changed in another tab. Reload this page before continuing.');
    storage.setItem(SAVE_KEY,JSON.stringify(next));profile=next;return result;
  }
  function begin(stageId){
    const stage=getStage(stageId);if(!stage||!isUnlocked(current(),stage,!!testProfile))throw Error('This stage is locked.');
    if(current().active)throw Error('Finish the current run first.');
    const id=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const summary={id,stageId,completed:0,wave:0,kills:0,level:1,skills:{},outcome:'active'};
    transact(p=>{p.active=summary;});return clone(summary);
  }
  function checkpoint(summary){
    if(!validateSummary(summary))throw Error('Invalid run record.');
    if(current().settled.includes(summary.id))return;
    transact(p=>{if(p.active?.id!==summary.id)throw Error('This run is no longer active.');p.active=clone(summary);});
  }
  function settle(summary){
    if(current().settled.includes(summary.id))return current().lastResult?.id===summary.id?clone(current().lastResult):null;
    if(!validateSummary(summary)||summary.outcome==='active')throw Error('A completed result is required.');
    let receipt;
    transact(p=>{
      if(p.active?.id!==summary.id)throw Error('This run is no longer active.');
      const stage=getStage(summary.stageId),win=summary.outcome==='victory';
      if(win&&summary.completed!==stage.waves.length)throw Error('A victory must clear every wave.');
      const reward=rewardFor(stage,summary.completed,summary.outcome,!p.clears.includes(stage.id));
      p.gold+=reward.total;if(win&&!p.clears.includes(stage.id))p.clears.push(stage.id);
      receipt={...clone(summary),reward,balance:p.gold,test:!!testProfile};
      p.active=null;p.lastResult=receipt;p.settled.push(summary.id);
    });return clone(receipt);
  }
  function buy(track){
    if(!['blade','armor'].includes(track))throw Error('Unknown upgrade.');
    if(current().active)throw Error('Upgrades are available between runs.');
    transact(p=>{const rank=p.upgrades[track];if(rank>=5)throw Error('Maximum rank reached.');const cost=testProfile?0:UPGRADE_COSTS[rank];if(p.gold<cost)throw Error('Not enough gold.');p.gold-=cost;p.upgrades[track]++;});
  }
  function preferences(patch){transact(p=>{Object.assign(p.settings,patch);if(patch.music>0)p.settings.lastMusic=patch.music;if(patch.sfx>0)p.settings.lastSfx=patch.sfx;});}
  function onboarding(complete=false){transact(p=>{p.onboarding.dismissed=true;if(complete)p.onboarding.complete=true;});}
  function toggleTest(){if(current().active)throw Error('Finish or leave the current run before switching test mode.');if(loadError)throw loadError;testProfile=testProfile?null:clone(profile);return !!testProfile;}
  return {get profile(){return clone(current());},get needsIntroduction(){return !current().onboarding.dismissed&&!current().onboarding.complete;},get test(){return !!testProfile;},get error(){return loadError;},begin,checkpoint,settle,buy,preferences,onboarding,toggleTest};
}
