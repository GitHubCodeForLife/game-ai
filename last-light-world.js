import * as THREE from './vendor/three.module.js';
import {enemyNames} from './last-light-campaign.js';

export function createWorld(container, labels, {stage=null,motion='system'}={}) {
  const egypt=stage?.region==='Egypt',night=stage?.theme==='lantern';
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x8a9d82);scene.fog=new THREE.FogExp2(0x8a9d82,.027);
  if(egypt||night){scene.background.set(egypt?0xc8ad78:0x3a505b);scene.fog.color.copy(scene.background);}
  const camera=new THREE.OrthographicCamera(-17,17,10,-10,.1,150);
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
  renderer.domElement.setAttribute('aria-label','The Wanderer fights along a stone path through a misty forest.');
  container.append(renderer.domElement);
  const geometries=[],materials=[];
  const geo=g=>(geometries.push(g),g);
  const box=geo(new THREE.BoxGeometry(1,1,1)),sphere=geo(new THREE.IcosahedronGeometry(1,1)),cone=geo(new THREE.ConeGeometry(1,1,6)),cylinder=geo(new THREE.CylinderGeometry(1,1,1,8));
  const material=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.85,...extra});materials.push(m);return m;};
  const colors={ground:material(0x647952),grass:material(0x829361),stone:material(0xa9a583),darkStone:material(0x657464),wood:material(0x564c39),bark:material(0x424c38),leaves:material(0x46644b),leaves2:material(0x68805a),leaves3:material(0x879566),red:material(0x8a4d36),metal:material(0x48574d,{metalness:.55,roughness:.4}),sword:material(0xe3e4cb,{metalness:.6,roughness:.26}),skin:material(0xc5b18c),black:material(0x27392f),hero:material(0xd6d4a5),sash:material(0x94734b),normal:material(0x947158),tanker:material(0x596a62),archer:material(0x71805a),boss:material(0x423f35),gold:material(0xc6a15d,{metalness:.3}),glow:material(0xe5ca8a,{emissive:0xe7b85e,emissiveIntensity:.7})};
  if(egypt){
    const palette={ground:0xa98750,grass:0xbca166,stone:0xd7bf8c,darkStone:0xa18c62,wood:0x624f36,leaves:0x6c7850,red:0x9c673e,hero:0xe1d6b3,normal:0xb1844f,tanker:0x95825c,archer:0x698e8c,boss:0xb6965a,metal:0x567d81,black:0x374744};
    for(const [key,color] of Object.entries(palette))colors[key].color.set(color);
    renderer.domElement.setAttribute('aria-label','The Wanderer fights on a sandstone path among dunes, pyramids, and ancient columns.');
  }
  const ringGeo=geo(new THREE.RingGeometry(.48,.52,36)),bowGeo=geo(new THREE.TorusGeometry(.5,.035,5,16,Math.PI));
  const heroRing=new THREE.MeshBasicMaterial({color:0xe3e6b5,transparent:true,opacity:.5,side:THREE.DoubleSide});
  const enemyRing=new THREE.MeshBasicMaterial({color:0xb97955,transparent:true,opacity:.5,side:THREE.DoubleSide});materials.push(heroRing,enemyRing);
  const mesh=(parent,g,m,x,y,z,sx=1,sy=1,sz=1)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
  scene.add(new THREE.HemisphereLight(0xf5e7be,0x465c46,2.3));
  const sun=new THREE.DirectionalLight(0xffe5b0,3.1);sun.position.set(-9,17,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-24;sun.shadow.camera.right=24;sun.shadow.camera.top=17;sun.shadow.camera.bottom=-17;sun.shadow.normalBias=.04;sun.shadow.bias=-.00015;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xafc9bb,.65);fill.position.set(10,5,-12);scene.add(fill);
  mesh(scene,box,colors.ground,0,-.65,-3,100,1,50);
  mesh(scene,box,material(0x8f956e),0,-.11,0,60,.1,3.8);
  let seed=9342;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let x=-27;x<28;x+=1.25){const m=mesh(scene,box,rand()>.3?colors.stone:colors.darkStone,x,-.015,(rand()-.5)*.15,1.14,.15,2.3+rand()*.7);m.rotation.y=(rand()-.5)*.13;}
  function tree(x,z,size) {
    const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(size);scene.add(g);
    mesh(g,cylinder,colors.bark,0,2,0,.22,4,.22);
    for(let i=0;i<3;i++)mesh(g,cone,i===2?colors.leaves2:colors.leaves,0,2.3+i*.85,0,1.6-i*.27,2.4,1.2-i*.18);
    return g;
  }
  if(!egypt){
    for(let i=0;i<42;i++)tree((rand()-.5)*72,-7-rand()*18,1+rand()*1.6);
    for(let i=0;i<24;i++){
      const x=(rand()-.5)*52,z=rand()>.5?2.6+rand()*4:-3-rand()*2;
      mesh(scene,sphere,colors.darkStone,x,.1,z,.3+rand()*.8,.2+rand()*.45,.3+rand()*.6);
    }
    const gate=new THREE.Group();gate.position.set(2,0,-5.8);scene.add(gate);
    for(const x of [-2.5,2.5]){mesh(gate,cylinder,colors.red,x,2.3,0,.21,4.6,.21);mesh(gate,box,colors.darkStone,x,.2,0,.65,.4,.65);}
    mesh(gate,box,colors.red,0,4,0,6.3,.25,.4);mesh(gate,box,colors.black,0,4.65,0,7,.25,.65);mesh(gate,box,colors.red,0,4.38,0,6.6,.2,.4);mesh(gate,box,colors.gold,0,4.12,.25,.48,.75,.12);
    if(stage?.theme==='bamboo')for(let i=0;i<28;i++){const x=(rand()-.5)*44,z=-4-rand()*9;mesh(scene,cylinder,colors.leaves,x,3,z,.09,6,.09);for(let j=1;j<6;j++)mesh(scene,cylinder,colors.leaves2,x,j,z,.12,.1,.12);}
    if(stage?.theme==='fortress')for(let x=-18;x<20;x+=2){mesh(scene,box,colors.darkStone,x,1.4,-9,1.9,2.8,1.2);mesh(scene,box,colors.stone,x,3,-9,1,1,1.2);}
    for(const x of night?[-11,-7,-3,3,7,11]:[-7,9]){
      mesh(scene,box,colors.darkStone,x,.15,-3,.85,.3,.85);mesh(scene,box,colors.stone,x,.75,-3,.3,1,.3);mesh(scene,box,colors.glow,x,1.4,-3,.55,.5,.5);mesh(scene,cone,colors.darkStone,x,1.85,-3,.65,.5,.65);
      if(night){const lamp=new THREE.PointLight(0xffb45b,7,5);lamp.position.set(x,1.5,-2.5);scene.add(lamp);}
    }
    for(let i=0;i<12;i++)mesh(scene,cone,material(i%2?0x83977e:0x758c78),-45+i*8,3,-32-rand()*10,8,9+rand()*10,7);
    if(night)sun.intensity=1.1;
  }else{
    const pyramid=geo(new THREE.ConeGeometry(1,1,4));
    for(let i=0;i<4;i++){const p=mesh(scene,pyramid,colors.stone,-18+i*12,4,-22-(i%2)*5,8,8+i%2*4,8);p.rotation.y=Math.PI/4;}
    for(let i=0;i<15;i++)mesh(scene,sphere,colors.ground,-35+i*5,-.5,-12-rand()*12,5,1.3,5);
    const temple=stage.theme!=='desert';
    for(const x of temple?[-12,-7,0,7,12]:[-8,8]){
      const h=temple?5:3;
      mesh(scene,cylinder,colors.stone,x,h/2,-6,.5,h,.5);mesh(scene,box,colors.gold,x,h,-6,1.3,.45,1.3);mesh(scene,box,colors.darkStone,x,.25,-6,1.6,.5,1.6);
      if(temple)mesh(scene,box,colors.darkStone,x,2.2,-5.47,.1,1.8,.04);
    }
    if(temple){mesh(scene,box,colors.stone,0,5.5,-6,27,.8,1.8);mesh(scene,box,colors.darkStone,0,3,-9,34,6,1);}
    if(stage.theme==='sanctuary'){scene.background.set(0x6e6751);scene.fog.color.copy(scene.background);sun.intensity=1.5;for(const x of [-10,10]){mesh(scene,box,colors.glow,x,1.4,-3,.35,1,.35);const lamp=new THREE.PointLight(0xffbd61,12,10);lamp.position.set(x,2,-3);scene.add(lamp);}}
  }
  const dustGeo=geo(new THREE.BufferGeometry()),dustPositions=new Float32Array(90*3);
  for(let i=0;i<90;i++){dustPositions[i*3]=(rand()-.5)*42;dustPositions[i*3+1]=rand()*8+.4;dustPositions[i*3+2]=(rand()-.5)*14;}
  dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPositions,3));
  const dustMat=new THREE.PointsMaterial({color:0xf5e6b2,size:.045,transparent:true,opacity:.5});materials.push(dustMat);const dust=new THREE.Points(dustGeo,dustMat);scene.add(dust);
  const characters=new Map(),arrows=new Map(),floats=[],sparks=[];
  let width=1,height=1,center=0,shake=0,realTime=0;
  let reduced=false;
  function setMotion(value){motion=value;reduced=value==='on'||value==='system'&&matchMedia('(prefers-reduced-motion: reduce)').matches;dust.visible=!reduced;if(reduced){shake=0;for(const p of sparks)scene.remove(p.o);sparks.length=0;}}
  setMotion(motion);
  function humanoid(type,id) {
    const root=new THREE.Group(),body=new THREE.Group();root.add(body);scene.add(root);
    const size=type==='boss'?1.65:type==='tanker'?1.15:1;
    const cloth=colors[type]||colors.hero;
    body.scale.setScalar(size);
    const torso=mesh(body,box,cloth,0,1.25,0,.62,.8,.4);
    mesh(body,box,colors.sash,0,.99,.015,.66,.13,.44);
    mesh(body,sphere,colors.skin,0,1.96,0,.25,.28,.23);
    mesh(body,sphere,colors.black,-.035,2.12,-.02,.27,.17,.25);
    mesh(body,box,colors.black,.24,1.98,.13,.03,.035,.08);
    mesh(body,box,colors.black,.24,1.98,-.13,.03,.035,.08);
    const leftLeg=new THREE.Group(),rightLeg=new THREE.Group();leftLeg.position.set(-.17,.95,0);rightLeg.position.set(.17,.95,0);body.add(leftLeg,rightLeg);
    for(const leg of [leftLeg,rightLeg]){mesh(leg,box,colors.black,0,-.35,0,.23,.7,.27);mesh(leg,box,colors.wood,.07,-.77,.01,.34,.15,.35);}
    const arm=new THREE.Group();arm.position.set(.17,1.6,.24);body.add(arm);
    mesh(arm,box,cloth,.12,-.24,0,.23,.52,.25);mesh(arm,sphere,colors.skin,.18,-.49,0,.12,.12,.12);
    const offarm=mesh(body,box,cloth,-.2,1.33,-.25,.23,.65,.25);offarm.rotation.z=-.17;
    const weapon=new THREE.Group();weapon.position.set(.18,-.48,0);arm.add(weapon);
    if(type==='archer'){
      const bow=mesh(weapon,bowGeo,colors.wood,.1,.25,0);bow.rotation.z=-Math.PI/2;mesh(weapon,box,colors.sword,.1,.25,0,.015,1,.015);
      mesh(body,box,colors.wood,-.3,1.4,-.24,.22,.8,.27);
    }else{
      const length=type==='normal'?.6:type==='boss'?1.5:1.05;
      mesh(weapon,box,colors.wood,0,.02,0,.1,.28,.1);
      mesh(weapon,box,colors.gold,0,.18,0,.28,.07,.12);
      mesh(weapon,box,colors.sword,0,.23+length/2,0,.11,length,.045);
    }
    if(type==='hero'){
      mesh(body,cone,colors.sash,0,2.24,0,.53,.2,.45);
      mesh(body,box,colors.hero,-.4,1.54,-.03,.35,.7,.42).rotation.z=-.3;
      const scarf=mesh(body,box,colors.red,-.44,1.65,-.17,.7,.13,.12);scarf.rotation.z=-.18;
    }
    if(type==='tanker'){
      mesh(body,box,colors.metal,.4,1.15,.46,.7,.95,.16);mesh(body,box,colors.gold,.4,1.15,.56,.08,.82,.035);
      mesh(body,box,colors.metal,0,2.15,0,.55,.28,.52);
    }
    if(type==='boss'){
      mesh(body,box,colors.metal,0,1.4,.06,.75,.66,.45);
      for(const x of [-.45,.45])mesh(body,sphere,colors.gold,x,1.72,0,.27,.18,.3);
      mesh(body,cone,colors.black,0,2.28,0,.39,.4,.35);
      if(!egypt)for(const x of [-.32,.32]){const horn=mesh(body,cone,colors.gold,x,2.36,0,.09,.48,.1);horn.rotation.z=x>0?-.6:.6;}
    }
    if(egypt&&type!=='hero'){mesh(body,box,colors.gold,0,2.12,0,.57,.22,.52);mesh(body,box,cloth,0,.8,.06,.64,.45,.43);}
    const ring=mesh(root,ringGeo,type==='hero'?heroRing:enemyRing,0,.08,0,size,size,size);ring.rotation.x=-Math.PI/2;
    const label=document.createElement('div');label.className=`enemy-label ${type==='hero'?'player':''}`;
    const name=document.createElement('div');name.className='enemy-name';name.textContent=type==='hero'?'WANDERER':stage?(enemyNames(stage)[type]||type).toUpperCase():type==='normal'?'RAIDER':type==='tanker'?'BULWARK':type==='archer'?'LONGBOW':'IRON WARDEN';
    const hp=document.createElement('span');hp.className='enemy-health';
    const bar=document.createElement('div');bar.className='enemy-bar';const fill=document.createElement('span');bar.append(fill);
    label.append(name,hp,bar);
    let armorBar,armorFill,armorText;
    if(type==='hero'){
      armorBar=document.createElement('div');armorBar.className='character-armor-bar';
      armorBar.setAttribute('role','progressbar');armorBar.setAttribute('aria-label','Wanderer armor');armorBar.setAttribute('aria-valuemin','0');
      armorFill=document.createElement('span');armorBar.append(armorFill);
      armorText=document.createElement('span');armorText.className='character-armor-text';
      label.append(armorBar,armorText);
    }
    const status=document.createElement('div');status.className='enemy-status';label.append(status);labels.append(label);
    const c={root,body,torso,arm,leftLeg,rightLeg,label,hp,fill,armorBar,armorFill,armorText,status,size,type,id};characters.set(id,c);return c;
  }
  function project(x,y,z=0){const v=new THREE.Vector3(x,y,z).project(camera);return {x:(v.x*.5+.5)*width,y:(-.5*v.y+.5)*height};}
  function float(event) {
    const el=document.createElement('div');el.className=`damage-float ${event.kind||''}`;el.textContent=event.text;labels.append(el);
    const same=floats.filter(f=>Math.abs(f.x-event.x)<1&&f.age<.25).length;
    floats.push({el,x:event.x+(same%2?.45:-.25),y:2.8+same*.35,age:0});
    while(floats.length>70)floats.shift().el.remove();
  }
  function burst(x,critical=false) {
    if(reduced)return;
    for(let i=0;i<(critical?10:5);i++){
      const o=mesh(scene,box,critical?colors.glow:colors.gold,x,1.25,.3,.04,.12,.04);
      sparks.push({o,vx:(rand()-.5)*5,vy:2+rand()*2,age:0});
    }
  }
  function event(e) {
    if(e.type==='float')float(e);
    if(e.type==='hit'){burst(e.enemy.x,e.critical);if(e.critical&&!reduced)shake=.06;}
    if(e.type==='playerHit'&&!reduced)shake=.07;
    if(e.type==='slam'&&!reduced)shake=.18;
    if(e.type==='reset'){
      for(const c of characters.values()){scene.remove(c.root);c.label.remove();}characters.clear();
      for(const a of arrows.values())scene.remove(a);arrows.clear();
      for(const f of floats)f.el.remove();floats.length=0;
      for(const p of sparks)scene.remove(p.o);sparks.length=0;
      center=0;
    }
  }
  const resize=()=>{
    width=Math.max(1,container.clientWidth);height=Math.max(1,container.clientHeight);
    const aspect=width/height,span=Math.max(26,aspect*14);
    camera.left=-span/2;camera.right=span/2;camera.top=span/aspect/2;camera.bottom=-span/aspect/2;camera.updateProjectionMatrix();renderer.setSize(width,height,false);
  };
  const observer=new ResizeObserver(resize);observer.observe(container);resize();
  function render(state,dt) {
    realTime+=dt;
    const frozen=state.paused||state.phase!=='combat';const t=state.time;
    const valid=new Set(['hero',...state.enemies.map(e=>e.id)]);
    for(const [id,c] of characters)if(!valid.has(id)){scene.remove(c.root);c.label.remove();characters.delete(id);}
    for(const entity of [{...state.player,id:'hero',type:'hero'},...state.enemies]){
      const c=characters.get(entity.id)||humanoid(entity.type,entity.id);
      c.root.position.x=entity.x;c.root.position.z=entity.type==='hero'?.3:(entity.id%3-1)*.35;
      const dir=entity.facing||1;c.body.rotation.y=dir<0?Math.PI:0;
      const moving=entity.moving&&!frozen;const stride=moving?Math.sin(t*11)*.55:reduced?0:Math.sin(t*2+(typeof entity.id==='number'?entity.id:0))*.015;
      c.leftLeg.rotation.z=stride;c.rightLeg.rotation.z=-stride;c.body.position.y=moving&&!reduced?Math.abs(Math.sin(t*11))*.055:0;
      const attackAge=t-entity.attackAt,hitAge=t-entity.hitAt;
      c.arm.rotation.z=entity.wind>0?-.85:attackAge<.32?-1.1+Math.sin(attackAge/.32*Math.PI)*2.1:-.35;
      c.torso.rotation.z=hitAge<.16?-.12:0;
      if(entity.type==='boss'&&entity.enraged)c.root.scale.setScalar(1.04);
      c.hp.textContent=`${Math.ceil(entity.hp)} / ${entity.maxHp}`;c.fill.style.width=`${Math.max(0,entity.hp/entity.maxHp*100)}%`;
      if(c.armorBar){
        const cap=Math.floor(entity.maxHp/2);
        c.armorFill.style.width=`${Math.max(0,Math.min(100,entity.armor/cap*100))}%`;
        c.armorBar.setAttribute('aria-valuenow',entity.armor);c.armorBar.setAttribute('aria-valuemax',cap);
        c.armorText.textContent=`ARMOR ${entity.armor} / ${cap}`;
      }
      c.status.textContent=entity.guard?'◇ GUARD':entity.wind>0?(entity.action==='slam'?'GROUND SLAM':entity.action==='aim'?'AIMED SHOT':'ATTACKING'):'';
    }
    const targetCenter=Math.max(-1,Math.min(2,state.player.x*.1));center+=(targetCenter-center)*Math.min(1,dt*2);
    shake=Math.max(0,shake-dt*.5);const offset=shake?Math.sin(realTime*71)*shake:0;
    camera.position.set(center+offset,8,21);camera.lookAt(center,1.5,-1.5);camera.updateMatrixWorld();
    // Stack nearby health labels vertically, keeping every enemy's HP readable.
    const placed=[],labelWidth=characters.values().next().value?.label.offsetWidth||72;
    for(const c of characters.values()){
      const p=project(c.root.position.x,2.68*c.size,c.root.position.z);
      p.x=Math.max(38,Math.min(width-38,p.x));
      const labelHeight=c.label.offsetHeight;
      for(let attempts=0;attempts<20;attempts++){
        const overlap=placed.find(other=>Math.abs(other.x-p.x)<labelWidth+4&&p.y>other.y-other.height-5&&p.y-labelHeight<other.y+5);
        if(!overlap)break;p.y=overlap.y-overlap.height-6;
      }
      placed.push({...p,height:labelHeight});c.label.style.left=`${p.x}px`;c.label.style.top=`${p.y}px`;c.label.hidden=false;
    }
    const active=new Set(state.projectiles.map(a=>a.id));
    for(const [id,o] of arrows)if(!active.has(id)){scene.remove(o);arrows.delete(id);}
    for(const a of state.projectiles){let o=arrows.get(a.id);if(!o){o=mesh(scene,box,colors.sword,a.x,a.y,.1,.65,.025,.025);arrows.set(a.id,o);}o.position.x=a.x;}
    for(let i=floats.length-1;i>=0;i--){
      const f=floats[i];if(!frozen)f.age+=dt;
      // Let final-hit feedback settle on result/rest screens instead of remaining forever.
      if(['defeat','victory','rest','ready'].includes(state.phase))f.age+=dt;
      if(f.age>1){f.el.remove();floats.splice(i,1);continue;}
      const p=project(f.x,f.y+(reduced?0:f.age*1.1),.5);f.el.style.left=`${p.x}px`;f.el.style.top=`${p.y}px`;f.el.style.opacity=String(Math.min(1,(1-f.age)*3));
    }
    if(!frozen)for(let i=sparks.length-1;i>=0;i--){const p=sparks[i];p.age+=dt;p.o.position.x+=p.vx*dt;p.o.position.y+=p.vy*dt;p.vy-=9*dt;p.o.rotation.z+=dt*5;if(p.age>.45){scene.remove(p.o);sparks.splice(i,1);}}
    if(!reduced&&!frozen){dust.rotation.y=t*.003;dust.position.y=Math.sin(t*.2)*.12;}
    renderer.render(scene,camera);
  }
  function dispose(){observer.disconnect();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();renderer.dispose();renderer.domElement.remove();labels.replaceChildren();}
  return {render,event,dispose,setMotion};
}
