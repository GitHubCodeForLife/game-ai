import {createGame,SKILLS,waveFormation,progress} from './last-light-game.js';
import {createAudio} from './last-light-audio.js';
import {STAGES,PRACTICE,UPGRADE_COSTS,createCampaign,getStage,isUnlocked,enemyNames,startingStats,rewardFor} from './last-light-campaign.js';
import {createWorld} from './last-light-world.js';

const $=id=>document.getElementById(id);
const make=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e;};
const skillById=id=>SKILLS.find(s=>s.id===id);
let storage;try{storage=localStorage;}catch{storage={getItem(){throw Error('Local saving is unavailable. Enable site storage and reload.');}};}
const campaign=createCampaign(storage),audio=createAudio();
let world=null,ready=false,screen='map',selectedStage=STAGES[0],runId=null,result=null,practice=false,practiceReturn='map',practiceReturnStage=STAGES[0],toastTimer,warningUntil=0,warningText='',modalKey='',buildKey='',restartPending=false,wasPaused=false,saveError=false,lastCheckpoint='',audioArmed=false;
const track=$('wave-track');
let activeRegion='Japan';
const game=createGame({onEvent:event=>{
  world?.event(event);
  if(event.type==='skill')toast(`${skillById(event.id)?.name||'Attack damage'} improved`);
  if(event.type==='rest')toast(event.choice==='heal'?'Health restored. Your next wave awaits.':'A lesson learned. Your next wave awaits.');
  if(event.type==='enrage')toast(`${selectedStage.boss?.name||'The boss'} is enraged.`);
  if(event.type==='warning'){warningUntil=game.state.time+event.duration;warningText=event.text;}
  if(event.type==='reset'){warningUntil=0;modalKey='';buildKey='';}
  audio.effect(event.type,event.critical);
}});
function toast(text){$('toast').textContent=text;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3000);}
function setText(id,text){const e=$(id);if(e.textContent!==String(text))e.textContent=String(text);}
function resource(name,current,max){
  const e=$(`${name}-value`);e.replaceChildren(document.createTextNode(`${Math.ceil(current)} `),make('small','',`/ ${max}`));
  $(`${name}-fill`).style.width=`${Math.max(0,Math.min(100,current/max*100))}%`;
  const bar=$(`${name}-bar`);if(bar){bar.setAttribute('aria-valuenow',String(Math.ceil(current)));bar.setAttribute('aria-valuemax',String(max));}
}

function roster(wave){const f=waveFormation(wave,selectedStage),names=enemyNames(selectedStage);return ['normal','tanker','archer','boss'].map(type=>{const count=f.filter(t=>t===type).length;return count?`${count} ${names[type]||'guardian'}`:'';}).filter(Boolean).join(' · ');}
function renderBuild(){
  const p=game.state.player,key=JSON.stringify(p.skills)+p.flatDamage;if(key===buildKey)return;buildKey=key;
  const list=$('skill-list');list.replaceChildren();
  const owned=SKILLS.filter(s=>p.skills[s.id]);setText('skill-count',`${owned.length} ${owned.length===1?'SKILL':'SKILLS'}`);
  if(!owned.length){const empty=make('div','empty-build');empty.append(make('span','','✦'),make('p','','Every fight leaves a lesson.'),make('small','','Defeat enemies to earn EXP. Level up to choose one of three skills.'));list.append(empty);}
  for(const skill of owned){
    const row=make('details','owned-skill'),summary=make('summary');summary.append(make('span','',skill.icon),make('span','',skill.name),make('small','',`${p.skills[skill.id]} / ${skill.max}`));
    const text=make('p','',`${skill.trigger} — ${skill.text(p.skills[skill.id])}`);row.append(summary,text);list.append(row);
  }
  if(p.flatDamage)list.append(make('p','help-note',`Bonus training: +${p.flatDamage} flat damage.`));
}
function button(text,fn,className='primary'){const b=make('button',className,text);b.type='button';b.addEventListener('click',fn);return b;}
function skillCard(id,index){
  const p=game.state.player,skill=skillById(id)||{name:'Further Training',trigger:'On Pick',category:'damage',icon:'/',max:99,text:()=>'+6 flat attack damage.'};
  const current=p.skills[id]||0,next=current+1;
  const card=button('',()=>{if(game.chooseSkill(id)){modalKey='';renderUi();}},'skill-choice');card.dataset.choice=String(index);
  card.append(make('span','choice-icon',skill.icon),make('span','category',skill.category),make('h3','',skill.name));
  const description=make('p');description.append(make('strong','',skill.trigger+' —'),document.createTextNode(skill.text(next)));card.append(description);
  if(current)description.append(make('span','',` Previously: ${skill.text(current)}`));
  const bottom=make('div','choice-bottom');bottom.append(make('span','',current?`RANK ${current} → ${next}`:skill.max===1?'UNIQUE SKILL':'NEW SKILL'),make('span','',`[${index+1}] SELECT →`));card.append(bottom);return card;
}

function updateHeader(){
  const p=campaign.profile;setText('wallet',campaign.test?'◈ ∞':`◈ ${p.gold}`);$('wallet').setAttribute('aria-label',campaign.test?'Unlimited test gold':`${p.gold} gold`);
  for(const id of ['wallet','map-button','shop-button'])$(id).hidden=screen==='intro';
  $('test-badge').hidden=!campaign.test;setText('chapter-name',screen==='battle'?`${selectedStage.region.toUpperCase()} / ${selectedStage.name.toUpperCase()}`:'ROADS OF DAWN');
  $('shop-button').disabled=screen==='battle';document.body.dataset.region=screen==='map'?activeRegion:selectedStage.region;
  for(const [id,view] of [['map-button','map'],['shop-button','shop']])$(id).setAttribute('aria-current',screen===view?'page':'false');
}
function closeChoices(){if($('choice-dialog').open)$('choice-dialog').close();modalKey='';}
function navigate(next){
  if(next==='intro'){practiceReturn=screen==='preview'?'preview':'map';practiceReturnStage=selectedStage.practice?STAGES[0]:selectedStage;}
  if(next==='map'&&screen!=='intro')activeRegion=selectedStage.region;
  screen=next;closeChoices();$('battle-screen').hidden=next!=='battle';$('campaign-screen').hidden=next==='battle';updateHeader();
  code='';taps=0;
  if(next==='battle'){world?.render(game.state,0);renderBattle();}else renderMenu();
  window.scrollTo(0,0);
  const title=(next==='battle'?$('battle-screen'):$('campaign-screen')).querySelector('h1');
  if(title){title.tabIndex=-1;title.focus({preventScroll:true});}
}
function heading(kicker,title,description){
  const e=make('div','campaign-heading');e.append(make('p','eyebrow',kicker),make('h1','',title),make('p','campaign-lead',description));return e;
}
function card(title,description){const e=make('article','campaign-card');e.append(make('h3','',title),make('p','',description));return e;}
function menuAction(label,fn,secondary=false){return button(label,fn,secondary?'secondary':'primary');}
function saveFailure(error,retry){
  saveError=true;game.setPaused(true);
  const dialog=$('utility-dialog'),body=$('utility-content');body.replaceChildren(make('p','eyebrow','PROGRESS NOT SAVED'),make('h2','', 'The road is on hold.'));
  body.querySelector('h2').id='utility-title';body.append(make('p','help-note',error.message||'Saving failed. Your last stored progress is preserved.'));
  body.append(button('Retry save',()=>{try{retry();saveError=false;dialog.close();modalKey='';renderUi();}catch(e){saveFailure(e,retry);}}));
  if(!dialog.open)dialog.showModal();
}
function safe(action){try{action();return true;}catch(error){saveFailure(error,action);return false;}}

function art(region,className='chapter-art'){
  const image=make('img',className);image.src=region==='Egypt'?'./last-light-egypt.svg':'./last-light-japan.svg';
  image.alt=region==='Egypt'?'A lone swordsman approaches ancient gates beneath the desert sun.':'A lone swordsman follows a bamboo path to a mountain gate.';return image;
}
function pathSteps(current){
  const steps=make('ol','journey-steps');steps.setAttribute('aria-label','Journey flow');
  ['Choose a stage','Prepare your fighter','Fight','Collect rewards'].forEach((label,index)=>{
    const item=make('li',index===current?'current':index<current?'done':'');
    if(index===current)item.setAttribute('aria-current','step');
    item.append(make('span','step-index',index<current?'✓':String(index+1).padStart(2,'0')),make('span','',label));steps.append(item);
  });return steps;
}
function metric(label,value){const e=make('div','brief-metric');e.append(make('span','',label),make('strong','',value));return e;}
function equipmentArt(kind){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 180 180');svg.setAttribute('aria-hidden','true');svg.classList.add('equipment-art');
  const paths=kind==='blade'?[['M46 138 130 26l12-7-2 19-80 113Z','#c4cbb3'],['m52 143 85-115-6 1-81 110Z','#f3f3da'],['m35 129 37 28 5-7-38-28Z','#ab8751'],['m42 145-16 22 9 7 16-23Z','#476449']]:[['M90 26 145 47v42q0 41-55 66-55-25-55-66V47Z','#56715d'],['M90 35 135 53v36q0 34-45 56Z','#8fa487'],['M90 35v110M47 65h86','#d1bc7d']];
  for(const [d,color] of paths){const p=document.createElementNS(ns,'path');p.setAttribute('d',d);if(d.includes('M47')){p.setAttribute('stroke',color);p.setAttribute('stroke-width','5');p.setAttribute('fill','none');}else p.setAttribute('fill',color);svg.append(p);}return svg;
}

function renderMenu(){
  const root=$('campaign-screen');root.replaceChildren();root.dataset.view=screen;updateHeader();
  if(campaign.error){root.append(heading('SAVE RECOVERY','Your progress is preserved.',campaign.error.message),make('p','campaign-lead','This page will not overwrite an unreadable save. Restore site storage access or a saved backup, then reload.'),button('Reload',()=>location.reload()));return;}
  if(screen==='intro'){
    const intro=make('div','welcome-layout'),visual=make('div','welcome-art');visual.append(art('Japan'),make('span','art-caption','CHAPTER I / THE IRON ROAD'));
    const copy=make('div','welcome-copy');copy.append(heading(campaign.needsIntroduction?'WELCOME TO LAST LIGHT':'AN AUTO-COMBAT ADVENTURE','Survive. Adapt. Repeat.','The blade moves on its own. The choices are yours.'));
    const lessons=make('div','welcome-lessons');
    [['01','Fight automatically','Watch enemy HP fall. Blue armor protects your health.'],['02','Choose your advantage','Pick one of three skills, then rest between waves.'],['03','Return stronger','Earn gold and upgrade before your next journey.']].forEach(([n,title,text])=>{const row=make('div','welcome-lesson'),details=make('div');details.append(make('h3','',title),make('p','',text));row.append(make('span','lesson-number',n),details);lessons.append(row);});
    const actions=make('div','campaign-actions');actions.append(button('Begin the first lesson →',()=>startStage(PRACTICE)),button('Skip to regions',()=>safe(()=>{campaign.onboarding();navigate('map');}),'secondary'));
    copy.append(lessons,actions,make('p','welcome-footnote','Two regions · Six stages · One wandering swordsman'));intro.append(visual,copy);root.append(intro);return;
  }
  if(screen==='lesson-complete'){
    root.append(heading('THE FIRST LESSON','You know the way.','You watched automatic combat, chose a skill, and rested between waves. Practice never changes your gold or stage records.'));
    root.append(button('Continue to the region map →',()=>safe(()=>{campaign.onboarding(true);practice=false;navigate(practiceReturn);})));return;
  }
  if(screen==='map'){
    const p=campaign.profile,cleared=p.clears.length,top=make('div','map-heading');
    top.append(heading('THE WORLD OF LAST LIGHT',cleared===6?'A journey worth repeating.':'Choose your road.','Every road ends with a different challenge.'));
    const total=make('div','journey-total');total.append(make('strong','',String(cleared).padStart(2,'0')),make('span','','/ 06'),make('small','','STAGES CLEARED'));top.append(total);root.append(top,pathSteps(0));
    const tabs=make('div','region-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','Choose a region');
    for(const [index,region]of ['Japan','Egypt'].entries()){
      const count=STAGES.filter(stage=>stage.region===region&&p.clears.includes(stage.id)).length;
      const tab=button('',()=>{activeRegion=region;renderMenu();},'region-tab');tab.setAttribute('aria-pressed',String(activeRegion===region));
      tab.append(make('span','region-tab-number','0'+(index+1)),make('strong','',region),make('small','',campaign.test?'ALL STAGES OPEN':count+' / 3 CLEARED'));tabs.append(tab);
    }
    root.append(tabs);const region=activeRegion,layout=make('div','chapter-layout'),visual=make('div','chapter-cover '+(region==='Egypt'?'egypt':'japan'));
    visual.append(art(region));const caption=make('div','chapter-caption');caption.append(make('p','eyebrow',region==='Japan'?'REGION I · JAPAN':'REGION II · EGYPT'),make('h2','',region==='Japan'?'The Iron Road':'Sands of Dawn'),make('p','',region==='Japan'?'Beyond the bamboo, a fortress waits.':'Follow the sun into forgotten halls.'));visual.append(caption);
    const list=make('div','chapter-stages');const listHeader=make('div','chapter-list-heading');listHeader.append(make('span','eyebrow','SELECT A STAGE'),make('span','small',campaign.test?'Test access · all difficulties':'Easy → Normal → Hard'));list.append(listHeader);
    for(const [index,stage]of STAGES.filter(item=>item.region===region).entries()){
      const unlocked=isUnlocked(p,stage,campaign.test),won=p.clears.includes(stage.id),row=button('',()=>{selectedStage=stage;navigate('preview');},'stage-row '+(!unlocked?'locked':won?'cleared':'available'));
      row.setAttribute('aria-label','Preview '+stage.name);row.dataset.stage=stage.id;
      const number=make('span','stage-number',String(index+1).padStart(2,'0')),body=make('span','stage-row-body'),topline=make('span','stage-topline');
      topline.append(make('span','difficulty '+stage.difficulty.toLowerCase(),stage.difficulty),make('span','stage-status',won?'✓ Cleared':unlocked?campaign.test?'Test access':'Available':'Locked'));
      body.append(topline,make('strong','stage-title',stage.name),make('span','stage-boss',stage.boss.name+' · Final boss'));
      const bottom=make('span','stage-row-meta');bottom.append(make('span','',stage.waves.length+' waves'),make('span','',`◈ ${rewardFor(stage,stage.waves.length,'victory',!won).total} gold`));body.append(bottom);
      if(!unlocked)body.append(make('span','lock-note','Clear '+getStage(stage.requires).name+' first'));
      row.append(number,body,make('span','stage-arrow',unlocked?'↗':'—'));list.append(row);
    }
    layout.append(visual,list);root.append(layout);
    const bottom=make('div','map-bottom'),stats=startingStats(p);bottom.append(make('span','',`YOUR FIGHTER  ·  ${stats.damage} ATK  ·  ${stats.armor} ARMOR`));
    const actions=make('div','map-actions');actions.append(button('Visit the workshop ↗',()=>navigate('shop'),'text-button'),button('Replay introduction',()=>navigate('intro'),'text-button'));
    if(p.lastResult)actions.append(button('Last result',()=>{result=p.lastResult;selectedStage=getStage(result.stageId);navigate('results');},'text-button'));
    if(campaign.test)actions.append(button('Exit test mode',toggleTest,'text-button'));bottom.append(actions);root.append(bottom);return;
  }
  if(screen==='preview'){
    const stage=selectedStage,p=campaign.profile,unlocked=isUnlocked(p,stage,campaign.test),won=p.clears.includes(stage.id),stats=startingStats(p),rewards=rewardFor(stage,stage.waves.length,'victory',!won);
    const nav=make('div','briefing-nav');nav.append(button('← '+stage.region+' stages',()=>navigate('map'),'text-button'),make('span','eyebrow','STAGE BRIEFING'));root.append(nav,pathSteps(1));
    const layout=make('div','briefing-layout'),main=make('div','briefing-main'),cover=make('div','stage-cover '+stage.theme);cover.append(art(stage.region));
    const title=make('div','stage-cover-title');title.append(make('span','difficulty '+stage.difficulty.toLowerCase(),stage.difficulty),make('h1','',stage.name),make('p','',stage.region==='Japan'?'THE IRON ROAD':'SANDS OF DAWN'));cover.append(title);main.append(cover);
    const meta=make('div','stage-facts');meta.append(metric('WAVES',stage.waves.length),metric('REST CHOICES',stage.waves.length-1),metric('GOLD / WAVE','◈ '+stage.rewards[0]));main.append(meta);
    const boss=make('div','boss-brief');boss.append(make('span','boss-emblem','✦'),make('div','boss-copy'));boss.lastChild.append(make('p','eyebrow','FINAL ENCOUNTER'),make('h2','',stage.boss.name),make('p','',stage.description));main.append(boss);
    const names=enemyNames(stage),enemies=make('div','enemy-lineup');enemies.append(make('span','eyebrow','ON THIS ROAD'));
    for(const type of ['normal','tanker','archer'])if(stage.waves.some(w=>w.includes(type)))enemies.append(make('span','enemy-chip',names[type]));main.append(enemies);
    const route=make('div','brief-route');route.append(make('p','eyebrow','THE PATH · ENEMIES PER WAVE'));
    const waves=make('ol','brief-waves');stage.waves.forEach((formation,index)=>{const item=make('li',index===stage.waves.length-1?'final':'');item.title=`Wave ${index+1}: ${formation.length} enemies${index===stage.waves.length-1?', including the boss':''}`;item.append(make('span','',String(index+1).padStart(2,'0')),make('small','',index===stage.waves.length-1?'BOSS':formation.length+' foes'));waves.append(item);});route.append(waves);main.append(route);
    const side=make('aside','ready-panel');side.setAttribute('aria-label','Prepare for this stage');side.append(make('p','eyebrow','YOUR STARTING BUILD'),make('h2','','The Wanderer'));
    const fighter=make('div','fighter-seal');fighter.append(equipmentArt('blade'));side.append(fighter);
    const metrics=make('div','ready-metrics');metrics.append(metric('HEALTH','100'),metric('ATTACK',stats.damage),metric('ARMOR',stats.armor+' / 50'),metric('CRITICAL','5%'));side.append(metrics);
    side.append(button('Improve equipment ↗',()=>navigate('shop'),'ready-upgrade'));
    const reward=make('div','ready-reward');reward.append(make('span','',won?'REPLAY REWARD':'FIRST-CLEAR REWARD'),make('strong','','◈ '+rewards.total),make('small','',`${rewards.wave+rewards.victory} stage gold${won?' · First-clear bonus earned':' + '+rewards.first+' first-clear bonus'}`));side.append(reward);
    const start=button(unlocked?'Enter stage →':'Stage locked',()=>startStage(stage));start.disabled=!unlocked;side.append(start);
    side.append(make('p','ready-note',unlocked?'All enemies appear at wave start. Your run skills start fresh.':'Clear '+getStage(stage.requires).name+' to open this road.'));
    if(campaign.test)side.append(make('p','test-notice','TEST MODE · All regions unlocked'));
    layout.append(main,side);root.append(layout);return;
  }
  if(screen==='shop'){
    const p=campaign.profile;root.append(heading('THE WORKSHOP','A sharper edge. A stronger guard.',campaign.test?'Free upgrades for testing. Choose any region when you are ready.':'Small advantages for every journey ahead.'),pathSteps(1));
    const grid=make('div','workshop-grid');
    for(const [id,name] of [['blade','Sharpen Blade'],['armor','Reinforce Armor']]){
      const rank=p.upgrades[id],cost=UPGRADE_COSTS[rank],c=make('article','equipment-card'),artwork=make('div','equipment-visual');artwork.append(equipmentArt(id));const content=make('div','equipment-copy');
      content.append(make('p','eyebrow',id==='blade'?'OFFENSE / PERMANENT':'DEFENSE / PERMANENT'),make('h2','',name),make('p','',id==='blade'?'+2 starting attack for every rank.':' +5 starting armor for every rank.'));
      const dots=make('div','rank-dots');dots.setAttribute('aria-label','Rank '+rank+' of 5');for(let i=0;i<5;i++)dots.append(make('span',i<rank?'filled':''));dots.append(make('small','',rank+' / 5'));content.append(dots);
      const benefit=make('div','equipment-benefit');benefit.append(make('strong','',id==='blade'?18+rank*2:rank*5),make('span','',rank===5?'MAXIMUM':`→ ${id==='blade'?20+rank*2:(rank+1)*5}`),make('small','',id==='blade'?'STARTING DAMAGE':'STARTING ARMOR'));content.append(benefit);
      const buy=button(rank===5?'Fully upgraded':campaign.test?'Upgrade · Free in test mode':'Upgrade · ◈ '+cost,()=>safe(()=>{campaign.buy(id);toast(name+' improved');renderMenu();}));buy.disabled=rank===5||!campaign.test&&p.gold<cost;content.append(buy);
      if(!campaign.test&&rank<5&&p.gold<cost)content.append(make('p','equipment-note',`Earn ${cost-p.gold} more gold to unlock this rank.`));
      else content.append(make('p','equipment-note',id==='blade'?'Damage skills scale with your starting attack.':'Applied at stage entry; does not refill each wave.'));
      c.append(artwork,content);grid.append(c);
    }
    root.append(grid);const actions=make('div','workshop-footer');actions.append(make('p','','Your equipment stays with you. Each run brings a new skill build.'),button('Prepare '+selectedStage.name+' →',()=>navigate('preview')),button('Region map',()=>navigate('map'),'text-button'));root.append(actions);return;
  }
  if(screen==='results'){
    if(!result){navigate('map');return;}
    const win=result.outcome==='victory',stage=getStage(result.stageId),p=campaign.profile;
    root.append(heading(`${stage.region} · ${stage.name} · ${stage.difficulty}`,win?'Still standing.':result.outcome==='defeat'?'The road remembers.':result.outcome==='interrupted'?'Your journey was interrupted.':'A moment to return.',win?'The boss and every escort are defeated.':`Wave ${result.wave||1} reached. Gold from completed waves is yours to keep.`));
    root.append(pathSteps(3));
    const panel=make('div','campaign-card result-panel'),metrics=make('div','campaign-metrics');
    for(const [label,value]of [['Waves completed',`${result.completed} / ${stage.waves.length}`],['Enemies defeated',result.kills],['Final level',result.level]]){const c=make('div');c.append(make('span','',label),make('strong','',value));metrics.append(c);}panel.append(metrics);
    panel.append(make('h3','','Your final build'));const chips=make('div','result-build');
    for(const [id,rank]of Object.entries(result.skills))chips.append(make('span','',`${skillById(id)?.name||id} · Rank ${rank}`));
    if(!chips.children.length)chips.append(make('span','','No skills chosen'));panel.append(chips);
    const receipt=make('div','gold-receipt');
    for(const [label,value] of [['Completed waves',result.reward.wave],['Victory bonus',result.reward.victory],['First-clear bonus',result.reward.first],['Gold earned',result.reward.total],['Wallet balance',campaign.test?'∞':p.gold]]){const row=make('div');row.append(make('span','',label),make('strong','',`◈ ${value}`));receipt.append(row);}panel.append(receipt);
    if(result.test)panel.append(make('p','test-notice','TEST RUN · Real progress unchanged.'));
    else panel.append(make('p','small','Reward saved once. Reopening this screen will not award it again.'));
    if(p.clears.length===6)panel.append(make('h3','','Journey complete — 6 / 6 stages cleared'));
    else if(win)panel.append(make('p','small',`${p.clears.length} / 6 stages cleared. Check the map for your next road.`));
    const actions=make('div','campaign-actions'),next=STAGES.find(s=>isUnlocked(p,s,campaign.test)&&!p.clears.includes(s.id));
    if(win&&next)actions.append(button('Next stage preview →',()=>{selectedStage=next;navigate('preview');}));
    actions.append(button(win?'Replay stage':'Retry stage',()=>{selectedStage=stage;navigate('preview');},'secondary'),button('Upgrade equipment',()=>navigate('shop'),'secondary'),button('Region map',()=>navigate('map'),'secondary'));const resultLayout=make('div','end-layout'),scene=make('div','end-art');scene.append(art(stage.region),make('span','end-art-title',win?'A new dawn.':'The road will wait.'));resultLayout.append(scene,panel);root.append(resultLayout,actions);
  }
}
function summary(outcome='active'){
  const s=game.state;return {id:runId,stageId:selectedStage.id,completed:s.completedWaves,wave:s.wave,kills:s.kills,level:s.player.level,skills:{...s.player.skills},outcome};
}
function checkpointRun(){
  if(screen!=='battle'||saveError)return saveError;
  const s=game.state;
  if(practice){if(s.phase==='victory'){practice=false;selectedStage=practiceReturnStage;navigate('lesson-complete');return true;}if(s.phase==='defeat'){practice=false;selectedStage=practiceReturnStage;navigate('intro');return true;}return false;}
  if(!runId)return false;
  const outcome=['victory','defeat'].includes(s.phase)?s.phase:'active',record=summary(outcome),key=JSON.stringify(record);
  if(key===lastCheckpoint)return false;
  const commit=()=>{
    if(outcome==='active')campaign.checkpoint(record);
    else{result=campaign.settle(record);runId=null;navigate('results');}
    lastCheckpoint=key;
  };
  try{commit();}catch(error){saveFailure(error,commit);return true;}
  return outcome!=='active';
}
function startStage(stage){
  const run=()=>{if(!stage.practice){const record=campaign.begin(stage.id);runId=record.id;}else runId=null;
    selectedStage=stage;practice=!!stage.practice;lastCheckpoint='';result=null;restartPending=false;game.reset({stage,upgrades:practice?{}:campaign.profile.upgrades});
    world?.dispose();world=null;ready=false;
    try{world=createWorld($('world'),$('labels'),{stage,motion:campaign.profile.settings.motion});ready=true;$('loading').hidden=true;$('fatal').hidden=true;}
    catch(error){$('loading').hidden=true;$('fatal').hidden=false;setText('fatal-message','WebGL could not start. Enable hardware acceleration, then reload. Saved completed-wave rewards are preserved.');}
    track.replaceChildren();for(let i=1;i<=stage.waves.length;i++){const segment=make('span','wave-segment');segment.title=`Wave ${i}${i===stage.waves.length?' · Final encounter':''}`;track.append(segment);}
    setText('location-name',stage.name.toUpperCase());setText('battle-title',stage.name);setText('battle-eyebrow',`${stage.region.toUpperCase()} · ${stage.difficulty.toUpperCase()} · ${stage.waves.length} WAVES`);audio.setRegion(stage.region);navigate('battle');
    if(practice)toast('Lesson 1: press Start wave 1. Watch HP and the blue armor bar.');
  };
  safe(run);
}
function leaveRun(){
  if(practice){practice=false;runId=null;selectedStage=practiceReturnStage;navigate(campaign.needsIntroduction?'intro':practiceReturn);return;}
  safe(()=>{result=campaign.settle(summary('abandoned'));runId=null;restartPending=false;navigate('results');});
}
function renderModal(){
  if($('help-dialog').open||$('utility-dialog').open)return;
  const s=game.state,phase=restartPending?'restart':s.paused?'paused':s.phase;
  const key=phase+'|'+s.pendingLevels+'|'+s.offers.join(',')+'|'+s.wave;
  if(key===modalKey)return;modalKey=key;
  const dialog=$('choice-dialog'),content=$('choice-content');
  if(!['upgrade','rest','paused','restart'].includes(phase)){if(dialog.open)dialog.close();return;}
  content.replaceChildren();setText('dialog-footer','The world waits while you choose.');
  if(phase==='upgrade'){
    setText('dialog-kicker',practice?'LESSON 2 · CHOOSE AN ADVANTAGE':`LEVEL ${s.player.level} · ${s.pendingLevels} CHOICE${s.pendingLevels>1?'S':''} EARNED`);
    setText('dialog-title','A little stronger.');setText('dialog-description',practice?'Each card says when it activates and what it does. Choose exactly one.':'One choice. A different way to survive.');
    const grid=make('div','choice-grid');s.offers.forEach((id,i)=>grid.append(skillCard(id,i)));content.append(grid);
  }else if(phase==='rest'){
    setText('dialog-kicker',practice?'LESSON 3 · PREPARE FOR THE NEXT WAVE':`WAVE ${s.wave} CLEARED`);setText('dialog-title','Catch your breath.');setText('dialog-description','Choose health or EXP. Armor does not refill automatically.');
    const grid=make('div','rest-grid');
    for(const choice of ['heal','train']){
      const hp=s.player.hp,max=s.player.maxHp,amount=choice==='heal'?Math.min(max-hp,Math.ceil(max*.25)):Math.ceil(s.player.nextXp*.3);
      const c=button('',()=>{if(game.chooseRest(choice)){modalKey='';renderUi();}},'skill-choice');
      c.append(make('span','choice-icon',choice==='heal'?'+':'↗'),make('h3','',choice==='heal'?'Recover':'Train'),make('p','',choice==='heal'?`Restore ${amount} HP. ${hp} → ${hp+amount} / ${max}.`:`Gain ${amount} EXP. Earned levels give another skill choice.`));
      c.disabled=choice==='heal'&&hp===max;if(c.disabled)c.append(make('small','','HP is full'));grid.append(c);
    }content.append(grid);setText('dialog-footer','Choose once, then start the next wave when ready.');
  }else if(phase==='paused'){
    setText('dialog-kicker','THE ROAD CAN WAIT');setText('dialog-title','A quiet moment.');setText('dialog-description','Combat, projectiles, and choices are paused.');
    content.append(button('Resume journey →',()=>{game.setPaused(false);modalKey='';renderUi();}),button('Settings',openSettings,'secondary'),button('Leave stage',requestMap,'secondary'));
  }else{
    setText('dialog-kicker',practice&&campaign.needsIntroduction?'RETURN TO THE INTRODUCTION':'RETURN TO THE MAP');setText('dialog-title','Leave this journey?');setText('dialog-description',practice?'Practice progress will end. Your real progress stays unchanged.':`Combat progress will end. Keep ${s.completedWaves*selectedStage.rewards[0]} gold from ${s.completedWaves} completed waves.`);
    content.append(button('Keep playing',()=>{restartPending=false;game.setPaused(wasPaused);modalKey='';renderUi();},'secondary'),button(practice?'Leave practice':'Leave and collect gold',leaveRun));
  }
  if(!dialog.open)dialog.showModal();content.querySelector('button:not(:disabled)')?.focus({preventScroll:true});
}
function renderBattle(){
  if(checkpointRun())return;
  const s=game.state,p=s.player,stats=game.stats();
  resource('hp',p.hp,p.maxHp);resource('armor',p.armor,stats.armorCap);resource('xp',p.xp,p.nextXp);
  setText('damage-value',Number(stats.damage.toFixed(1)));setText('crit-value',`${Math.round(stats.crit*100)}%`);setText('interval-value',`${stats.interval.toFixed(2)}s`);
  setText('level-label',`LEVEL ${p.level} · SWORDSMAN`);setText('kill-count',String(s.kills).padStart(2,'0'));setText('wave-number',String(s.wave).padStart(2,'0'));
  const next=s.phase==='ready'||s.phase==='rest',wave=Math.min(s.totalWaves,next?s.wave+1:Math.max(1,s.wave));
  const completed=progress(s),upcoming=waveFormation(wave,selectedStage).length;
  setText('hud-hp',`${Math.ceil(p.hp)} / ${p.maxHp}`);setText('hud-armor',`${p.armor} / ${stats.armorCap}`);
  $('hud-hp-fill').style.width=`${p.hp/p.maxHp*100}%`;$('hud-armor-fill').style.width=`${p.armor/stats.armorCap*100}%`;
  setText('hud-stats',`ATK ${Number(stats.damage.toFixed(1))} · CRIT ${Math.round(stats.crit*100)}% · LV ${p.level}`);
  setText('hud-wave',`${next?'NEXT: ':''}WAVE ${wave} / ${s.totalWaves}`);setText('hud-enemies',next?`${upcoming} enemies ready`:`${completed.defeated} / ${completed.total} defeated`);
  setText('hud-progress',`${completed.stagePercent}%`);$('hud-progress-fill').style.width=`${completed.stagePercent}%`;$('stage-progress-bar').setAttribute('aria-valuenow',String(completed.stagePercent));
  $('hud-start-button').hidden=s.phase!=='ready';$('hud-start-button').disabled=!ready||s.paused;setText('hud-start-button',`Start wave ${wave}${wave===s.totalWaves&&!practice?' · Boss':''} →`);
  $('hud-wave-status').hidden=s.phase==='ready';setText('hud-wave-status',s.phase==='combat'?`${completed.remaining} enemies remaining`:s.phase==='upgrade'?'Choose your skill':s.phase==='rest'?'Choose a rest reward':s.phase==='victory'?'Stage complete':'Run ended');
  setText('wave-kicker',`${next?'UP NEXT':'CURRENT'} · WAVE ${String(wave).padStart(2,'0')}${wave===s.totalWaves&&!practice?' · BOSS':''}`);setText('wave-name',wave===s.totalWaves?(selectedStage.boss?.name||'The last lesson'):`${selectedStage.name} · Wave ${wave}`);setText('wave-roster',roster(wave));
  [...track.children].forEach((e,i)=>{e.className='wave-segment'+(i+1<s.wave||i+1===s.wave&&['rest','ready','victory'].includes(s.phase)?' complete':i+1===s.wave?' active':'');});
  const labels={ready:'AWAITING YOUR COMMAND',combat:s.wave===s.totalWaves&&!practice?'BOSS ENCOUNTER':'AUTO-ATTACK ACTIVE',upgrade:'CHOOSING A SKILL',rest:'WAVE CLEARED',victory:'STAGE COMPLETE',defeat:'JOURNEY ENDED'};
  setText('phase-pill',s.paused?'PAUSED':labels[s.phase]);
  $('start-button').disabled=!ready||s.phase!=='ready'||s.paused;
  setText('start-button',s.phase==='ready'?(s.wave===0?'Begin the journey →':s.wave===s.totalWaves-1&&!practice?'Face the final boss →':`Start wave ${s.wave+1} →`):s.phase==='combat'?'Battle in progress':s.phase==='upgrade'?'Choose your skill':s.phase==='rest'?'Choose a rest reward':'Run complete');
  $('pause-button').disabled=!ready||['victory','defeat','ready'].includes(s.phase);setText('pause-button',s.paused?'▶ Resume':'Ⅱ Pause');
  setText('enemy-count',s.phase==='combat'?`${completed.defeated} / ${completed.total} defeated · all enemies deployed`:'All enemies appear together at wave start.');setText('speed-button',`${s.speed}×`);$('speed-button').setAttribute('aria-label',`Set combat speed to ${s.speed===1?2:1} times`);
  const boss=s.enemies.find(e=>e.type==='boss');$('boss-hud').hidden=!boss;
  if(boss){setText('boss-hp-text',`${boss.hp} / ${boss.maxHp}`);$('boss-hp-fill').style.width=`${boss.hp/boss.maxHp*100}%`;setText('boss-phase',boss.enraged?'PHASE II · ENRAGED':'PHASE I · THE GATEKEEPER');}
  if(s.bossIntro>0){$('warning').hidden=false;setText('warning',selectedStage.boss?.name.toUpperCase()||'FINAL WAVE');}
  else if(s.waveIntro>0){$('warning').hidden=false;setText('warning',`WAVE ${s.wave} · ${s.waveTotal} ENEMIES`);}
  else {$('warning').hidden=!(s.phase==='combat'&&s.time<warningUntil);if(s.time<warningUntil)setText('warning',warningText);}
  const hints={ready:'Choose your path. The blade will do the rest.',combat:s.wave===s.totalWaves&&!practice?'Defeat the boss and every escort.':'Your blade moves on its own. Every hit leaves a mark.',upgrade:'Combat is frozen. Choose one advantage.',rest:'The road ahead is yours to prepare for.',victory:'The pass is quiet. Morning is yours.',defeat:'The road ends here. Another journey awaits.'};setText('combat-hint',hints[s.phase]);
  setText('field-note',s.wave>=s.totalWaves-1?selectedStage.description:s.wave>=3?'Tankers can Guard. Faster kills reach archers sooner and trigger on-kill healing.':'Your fighter moves and attacks automatically. Your choices shape what happens next.');
  setText('wave-total',' / '+s.totalWaves);setText('boss-name',selectedStage.boss?.name.toUpperCase()||'FINAL WAVE');
  setText('run-earnings',practice?'Practice · no gold':`◈ ${s.completedWaves*selectedStage.rewards[0]} earned this run`);
  renderBuild();renderModal();
}

function renderUi(){updateHeader();if(screen==='battle')renderBattle();}
function beginWave(){if(ready&&!saveError){game.startWave();renderUi();}}
function requestMap(){if(screen==='intro'&&campaign.needsIntroduction)return;if(screen==='battle'){wasPaused=game.state.paused;restartPending=true;game.setPaused(true);modalKey='';renderUi();}else navigate('map');}
async function applyAudio(){
  const pref=campaign.profile.settings;audio.setVolumes(pref.music,pref.sfx);
  if(audioArmed)try{await audio.setMusic(!pref.musicMuted&&pref.music>0);await audio.setSfx(!pref.sfxMuted&&pref.sfx>0);}catch{toast('Audio is unavailable in this browser.');}
}
function applyMotion(){const value=campaign.profile.settings.motion,reduced=value==='on'||value==='system'&&matchMedia('(prefers-reduced-motion: reduce)').matches;document.body.classList.toggle('reduced-motion',reduced);world?.setMotion(value);}
function openSettings(){
  if(saveError)return;
  if(screen==='battle')game.setPaused(true);
  const dialog=$('utility-dialog'),body=$('utility-content');body.replaceChildren(make('p','eyebrow','MAKE THE ROAD YOURS'));const title=make('h2','','Settings');title.id='utility-title';body.append(title);
  const p=campaign.profile.settings;
  for(const [kind,label] of [['music','Music'],['sfx','Sound effects']]){
    const row=make('div','settings-control'),labelEl=make('label','',label+' volume'),input=make('input');input.type='range';input.min='0';input.max='100';input.step='1';input.value=p[kind];input.id=kind+'-volume';labelEl.htmlFor=input.id;
    const output=make('output','',p[kind]+'%');output.htmlFor=input.id;row.append(labelEl,output,input);
    const mute=button(p[kind+'Muted']?'Enable '+label:'Mute '+label,()=>safe(()=>{const settings=campaign.profile.settings;campaign.preferences({[kind+'Muted']:!settings[kind+'Muted'],[kind]:settings[kind]||settings[kind==='music'?'lastMusic':'lastSfx']});applyAudio();openSettings();}),'secondary');
    input.addEventListener('input',()=>{output.textContent=input.value+'%';const settings=campaign.profile.settings;audio.setVolumes(kind==='music'?+input.value:settings.music,kind==='sfx'?+input.value:settings.sfx);});
    input.addEventListener('change',()=>safe(()=>{campaign.preferences({[kind]:+input.value,[kind+'Muted']:+input.value===0});applyAudio();openSettings();}));
    row.append(mute);body.append(row);
  }
  const motionLabel=make('label','settings-label','Reduced motion'),select=make('select');select.id='motion-select';motionLabel.htmlFor=select.id;
  for(const [value,text]of [['system','Follow system'],['on','On'],['off','Off']]){const opt=make('option','',text);opt.value=value;select.append(opt);}select.value=p.motion;select.addEventListener('change',()=>safe(()=>{campaign.preferences({motion:select.value});applyMotion();}));body.append(motionLabel,select,make('p','help-note','Reduced motion removes camera shake, particles, and rising damage numbers. Attack timing stays the same.'));
  const preview=button('Preview sound effect',async()=>{try{audioArmed=true;audio.setSuspended(false);audio.setVolumes(campaign.profile.settings.music,campaign.profile.settings.sfx);await audio.setSfx(true);audio.effect('skill');await applyAudio();}catch{toast('Audio is unavailable.');}},'secondary');body.append(preview);
  const replay=button('Replay tutorial',()=>{dialog.close();practiceReturn=screen==='preview'?'preview':'map';navigate('intro');},'secondary');replay.disabled=screen==='battle';body.append(replay);
  if(replay.disabled)body.append(make('p','help-note','Tutorial replay is available after finishing or leaving this run.'));
  body.append(button(screen==='battle'?'Close · keep game paused':'Done',()=>{dialog.close();modalKey='';renderUi();}));
  if(!dialog.open)dialog.showModal();
}
function toggleTest(){safe(()=>{const enabled=campaign.toggleTest();toast(enabled?'Test mode: unlimited gold and every region unlocked.':'Test mode ended. Real progress restored.');applyAudio();applyMotion();renderMenu();});}
let code='',codeAt=0,taps=0,tapAt=0;
function openCode(){
  const body=$('utility-content'),dialog=$('utility-dialog');body.replaceChildren();const h=make('h2','','Access code');h.id='utility-title';const label=make('label','','Code'),input=make('input');input.type='text';input.autocomplete='off';input.id='access-code';label.htmlFor=input.id;
  body.append(h,label,input,button('Apply code',()=>{if(input.value.trim().toUpperCase()==='TUGAME'){dialog.close();toggleTest();}else toast('Code not recognized.');}),button('Cancel',()=>dialog.close(),'secondary'));dialog.showModal();input.focus();
}
$('brand-home').addEventListener('click',e=>{e.preventDefault();if(screen==='map'){const now=performance.now();if(!taps||now-tapAt>=3000){taps=1;tapAt=now;}else taps++;if(taps>=5){taps=0;openCode();}}else requestMap();});
$('map-button').addEventListener('click',requestMap);$('shop-button').addEventListener('click',()=>{if(screen!=='battle')navigate('shop');});$('settings-button').addEventListener('click',openSettings);
$('start-button').addEventListener('click',beginWave);$('hud-start-button').addEventListener('click',beginWave);
$('pause-button').addEventListener('click',()=>{game.setPaused(!game.state.paused);renderUi();});$('speed-button').addEventListener('click',()=>{game.state.speed=game.state.speed===1?2:1;renderUi();});
$('restart-button').addEventListener('click',requestMap);
$('help-button').addEventListener('click',()=>{if(screen==='battle')game.setPaused(true);$('help-dialog').showModal();});
function closeHelp(){$('help-dialog').close();modalKey='';renderUi();}
$('close-help').addEventListener('click',closeHelp);$('help-dialog').addEventListener('cancel',e=>{e.preventDefault();closeHelp();});
$('utility-dialog').addEventListener('cancel',e=>{if(saveError){e.preventDefault();return;}modalKey='';setTimeout(renderUi,0);});
$('choice-dialog').addEventListener('cancel',e=>{e.preventDefault();if(restartPending){restartPending=false;game.setPaused(wasPaused);}else if(game.state.paused)game.setPaused(false);modalKey='';renderUi();});
document.addEventListener('keydown',e=>{
  if(e.repeat||e.altKey||e.ctrlKey||e.metaKey||e.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
  if(['map','preview'].includes(screen)&&!$('utility-dialog').open&&!$('help-dialog').open){
    const now=performance.now();if(now-codeAt>5000)code='';if(!code)codeAt=now;code+=(e.key.length===1?e.key.toUpperCase():'');if(!'TUGAME'.startsWith(code))code=e.key.toUpperCase()==='T'?'T':'';if(code==='TUGAME'){code='';toggleTest();}return;
  }
  code='';if(screen!=='battle'||$('help-dialog').open||$('utility-dialog').open||restartPending)return;
  if(e.code==='Space'&&ready&&!['ready','defeat','victory'].includes(game.state.phase)){e.preventDefault();game.setPaused(!game.state.paused);renderUi();}
  if(game.state.phase==='upgrade'&&!game.state.paused&&['1','2','3'].includes(e.key)){e.preventDefault();const id=game.state.offers[Number(e.key)-1];if(id)game.chooseSkill(id);renderUi();}
});
function armAudio(){if(!audioArmed){audioArmed=true;applyAudio();}}
document.addEventListener('pointerdown',armAudio,{capture:true});
document.addEventListener('keydown',armAudio,{capture:true});
document.addEventListener('visibilitychange',()=>{audio.setSuspended(document.hidden);if(document.hidden&&screen==='battle'){game.setPaused(true);renderUi();}});
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',applyMotion);
$('reload-button').addEventListener('click',()=>location.reload());
function boot(){
  if(campaign.error){navigate('map');return;}
  const active=campaign.profile.active;
  if(active){safe(()=>{result=campaign.settle({...active,outcome:active.outcome==='active'?'interrupted':active.outcome});selectedStage=getStage(result.stageId);navigate('results');});}
  else navigate(campaign.needsIntroduction?'intro':'map');
  applyMotion();
}
boot();
let previous=performance.now(),accumulator=0,lastUi=0;
function frame(now){
  const dt=Math.min((now-previous)/1000,.1);previous=now;
  const inBattle=screen==='battle';
  audio.setSuspended(document.hidden||(inBattle&&game.state.paused&&!$('utility-dialog').open));audio.tick(inBattle&&!practice&&game.state.wave===game.state.totalWaves);
  if(inBattle&&ready&&!game.state.paused&&!saveError&&game.state.phase==='combat'){
    accumulator+=dt*game.state.speed;
    while(accumulator>=1/60){game.update(1/60);accumulator-=1/60;if(game.state.phase!=='combat'){accumulator=0;break;}}
  }else accumulator=0;
  if(inBattle&&ready)world.render(game.state,dt);
  if(now-lastUi>90){if(inBattle)renderUi();lastUi=now;}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
