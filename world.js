import * as THREE from './vendor/three.module.js';
import { PATH, PADS, TOWER_TYPES } from './game.js';

const TAU = Math.PI * 2;
const pt = p => Array.isArray(p) ? { x:p[0], z:p[1] } : { x:p.x ?? p.position?.x ?? 0, z:p.z ?? p.position?.z ?? p.y ?? 0 };
const route = PATH.map(pt);
const palette = { grass:0x537c38, lime:0xc6f56a, dark:0x24392c, stone:0x78917b, sand:0xd6bd86, cyan:0x9aeeef, coral:0xff7f66 };

export function createWorld(container, { onPadClick, onTowerClick, onHover } = {}) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-16,16,12,-12,.1,120);
  const renderer = new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,2));
  renderer.setClearColor(0x0c1b14,0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.domElement.className = 'world-canvas';
  renderer.domElement.setAttribute('aria-label','Interactive three-dimensional tower defense battlefield. Select an empty stone pad to build a tower.');
  renderer.domElement.style.touchAction = 'none';
  container.appendChild(renderer.domElement);

  let seed = 2177;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const materials = new Set(), geometries = new Set();
  const mat = (color, extra={}) => { const m = new THREE.MeshStandardMaterial({color,roughness:.85,metalness:0,...extra}); materials.add(m); return m; };
  const basic = (color, extra={}) => { const m = new THREE.MeshBasicMaterial({color,...extra}); materials.add(m); return m; };
  const geo = g => {geometries.add(g);return g;};
  const boxGeo = geo(new THREE.BoxGeometry(1,1,1));
  const cylinderGeo = geo(new THREE.CylinderGeometry(1,1,1,8));
  const coneGeo = geo(new THREE.ConeGeometry(1,1,7));
  const sphereGeo = geo(new THREE.IcosahedronGeometry(1,0));
  const crystalGeo = geo(new THREE.OctahedronGeometry(1,0));
  const planeGeo = geo(new THREE.PlaneGeometry(1,1));
  const circleGeo = geo(new THREE.CircleGeometry(1,32));
  const stone = mat(0x7c8e75), darkStone = mat(0x384c3c), wood = mat(0x65472d), metal = mat(0x243d37,{metalness:.4,roughness:.48});
  const lightStone = mat(0xacb298), gold = mat(0xd7b576,{metalness:.25}), lime = mat(palette.lime,{emissive:0x9fc853,emissiveIntensity:.18});
  const cyan = mat(0x83e1e0,{emissive:0x38afc1,emissiveIntensity:.45,metalness:.2,roughness:.3});
  const orange = mat(0xe6a460,{metalness:.4,roughness:.45});
  const leafMats = [mat(0x315a34),mat(0x3d6837),mat(0x548242),mat(0x668e46),mat(0x77964a)];
  const mesh = (g,m,x=0,y=0,z=0,sx=1,sy=sx,sz=sx,parent=scene) => {
    const o = new THREE.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
  };
  const box = (m,x,y,z,sx,sy,sz,parent=scene) => mesh(boxGeo,m,x,y,z,sx,sy,sz,parent);
  const cyl = (m,x,y,z,r,h,parent=scene) => mesh(cylinderGeo,m,x,y,z,r,h,r,parent);
  const ambient = new THREE.HemisphereLight(0xf6f5d5,0x234531,2.25);scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffe5b1,3.5);sun.position.set(-8,19,10);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-16;sun.shadow.camera.right=16;sun.shadow.camera.top=16;sun.shadow.camera.bottom=-16;sun.shadow.camera.near=.1;sun.shadow.camera.far=55;sun.shadow.bias=-.00035;sun.shadow.normalBias=.045;sun.shadow.radius=4;scene.add(sun);
  const fill = new THREE.DirectionalLight(0xa2cbd5,1.2);fill.position.set(10,9,-10);scene.add(fill);

  // A beveled land mass, with faceted rock below the grassy shelf.
  function roundedShape(w,h,r) {
    const s = new THREE.Shape(),x=-w/2,y=-h/2;
    s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s;
  }
  function slab(w,h,depth,y,m,bevel=.14) {
    const g=geo(new THREE.ExtrudeGeometry(roundedShape(w,h,.65),{depth,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:1,curveSegments:3,steps:1}));
    const o=mesh(g,m);o.rotation.x=-Math.PI/2;o.position.y=y;return o;
  }
  slab(20.8,14,.9,-1.1,mat(0x514b37),.18);
  slab(21,14.1,.32,-.38,mat(0x3c6131),.11);
  slab(20.9,14,.13,-.12,mat(0x567c3b),.10);
  const rockMats=[mat(0x53533e),mat(0x666249),mat(0x454b39)];
  for(let i=0;i<64;i++) {
    const edge=i%4,along=rand(),x=edge<2?(along-.5)*20.2:(edge===2?-10.18:10.18),z=edge<2?(edge===0?-6.83:6.83):(along-.5)*13.1;
    const rock=mesh(sphereGeo,rockMats[i%3],x,-.66-rand()*.36,z,.5+rand()*.5,.5+rand()*.45,.45+rand()*.4);rock.rotation.set(rand(),rand(),rand());
  }
  const grassColors=[0x5c823f,0x608744,0x638748,0x537b3b,0x577f40];
  const patchGeometry=geo(new THREE.PlaneGeometry(1,1));
  for(let c=0;c<grassColors.length;c++) {
    const inst=new THREE.InstancedMesh(patchGeometry,mat(grassColors[c]),70),dummy=new THREE.Object3D();let count=0;
    for(let x=-9.8;x<10;x+=1.2) for(let z=-6.4;z<6.7;z+=1.2) if(Math.floor(rand()*5)===c && count<70){dummy.position.set(x+(rand()-.5)*.2,.122,z);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.set(.8+rand()*.5,.8+rand()*.5,1);dummy.updateMatrix();inst.setMatrixAt(count++,dummy.matrix);}
    inst.count=count;inst.receiveShadow=true;scene.add(inst);
  }

  function roadShape(width) {
    const left=[],right=[];
    route.forEach((p,i)=>{
      const prev=route[Math.max(0,i-1)],next=route[Math.min(route.length-1,i+1)];
      const a=new THREE.Vector2(p.x-prev.x,p.z-prev.z).normalize(),b=new THREE.Vector2(next.x-p.x,next.z-p.z).normalize();
      if(i===0)a.copy(b);if(i===route.length-1)b.copy(a);
      const n1=new THREE.Vector2(-a.y,a.x),n2=new THREE.Vector2(-b.y,b.x),n=n1.clone().add(n2).normalize();
      const len=width/2/Math.max(.2,n.dot(n1));left.push({x:p.x+n.x*len,z:p.z+n.y*len});right.push({x:p.x-n.x*len,z:p.z-n.y*len});
    });
    const pts=left.concat(right.reverse());const s=new THREE.Shape();pts.forEach((p,i)=>i?s.lineTo(p.x,-p.z):s.moveTo(p.x,-p.z));s.closePath();return s;
  }
  const roadBorder=mesh(geo(new THREE.ShapeGeometry(roadShape(1.9))),mat(0x859256));roadBorder.rotation.x=-Math.PI/2;roadBorder.position.y=.132;
  const road=mesh(geo(new THREE.ShapeGeometry(roadShape(1.62))),mat(0xcebb87));road.rotation.x=-Math.PI/2;road.position.y=.142;
  const paverMats=[mat(0xdcc999),mat(0xc9b684),mat(0xd3c18f)];
  for(let j=1;j<route.length;j++) {
    const a=route[j-1],b=route[j],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
    for(let d=.35;d<length-.25;d+=.63) {
      const p=box(paverMats[Math.floor(rand()*3)],a.x+dx*d/length,.15,a.z+dz*d/length,1.32,.025,.48);p.rotation.y=Math.atan2(dx,dz)+(rand()-.5)*.035;
      if(rand()<.38){const pebble=mesh(sphereGeo,lightStone,a.x+dx*d/length-dz/length*.73,.20,a.z+dz*d/length+dx/length*.73,.075,.04,.06);pebble.rotation.y=rand()*TAU;}
    }
  }
  const pathDistance=(x,z)=>Math.min(...route.slice(1).map((b,i)=>{const a=route[i],dx=b.x-a.x,dz=b.z-a.z,t=THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(x-a.x-t*dx,z-a.z-t*dz);}));
  const padList=PADS.map((p,i)=>({...p,...pt(p),id:p.id??i}));
  const pondX=3.1,pondZ=-5.05;
  const clear=(x,z,margin=1.3)=>Math.hypot((x-pondX)/1.4,(z-pondZ)/1.05)>1.2 && pathDistance(x,z)>margin && padList.every(p=>Math.hypot(p.x-x,p.z-z)>1.35) && Math.hypot(x-9,z+1)>1.7 && Math.hypot(x+9,z+3)>1.65;
  function tree(x,z,h,variation) {
    const g=new THREE.Group();g.position.set(x,.12,z);g.rotation.y=rand()*TAU;scene.add(g);
    cyl(wood,0,h*.22,0,.12,h*.44,g);
    mesh(coneGeo,leafMats[variation%5],0,h*.48,0,h*.31,h*.66,h*.31,g);
    mesh(coneGeo,leafMats[(variation+1)%5],0,h*.69,0,h*.245,h*.55,h*.245,g);
    mesh(coneGeo,leafMats[(variation+2)%5],0,h*.88,0,h*.16,h*.43,h*.16,g);
    return g;
  }
  let treeCount=0;
  for(let i=0;i<260&&treeCount<52;i++) {
    const x=(rand()-.5)*19.7,z=(rand()-.5)*12.8;
    const nearEdge=Math.abs(x)>8.1||Math.abs(z)>4.8;
    if(clear(x,z,1.65) && (nearEdge||rand()<.12)) {tree(x,z,(z>3?1.5:2.0)+rand()*1.05,Math.floor(rand()*3));treeCount++;}
  }
  const grassBladeGeo=geo(new THREE.ConeGeometry(.045,.24,3));
  for(let i=0;i<115;i++) {
    const x=(rand()-.5)*19.8,z=(rand()-.5)*13.0;
    if(!clear(x,z,1.12))continue;
    if(i%4===0){const r=mesh(sphereGeo,stone,x,.25,z,.15+rand()*.18,.12+rand()*.13,.18+rand()*.2);r.rotation.set(rand(),rand(),rand());}
    else if(i%6===0){mesh(sphereGeo,leafMats[2],x,.27,z,.25,.22,.25);mesh(sphereGeo,leafMats[3],x+.17,.25,z+.1,.21,.18,.2);}
    else for(let k=0;k<3;k++)mesh(grassBladeGeo,leafMats[3],x+(rand()-.5)*.15,.22,z+(rand()-.5)*.15);
  }
  // A little woodland pond and fallen trunk complete the edge of the island.
  const pond=mesh(circleGeo,mat(0x4c9d93,{roughness:.2,metalness:.3}),pondX,.155,pondZ,1.25,.8,1);pond.rotation.x=-Math.PI/2;
  for(let i=0;i<9;i++){const a=i/9*TAU;const r=mesh(sphereGeo,stone,pondX+Math.cos(a)*1.3,.22,pondZ+Math.sin(a)*.85,.20,.12,.16);r.rotation.y=a;}
  const ripple=mesh(geo(new THREE.RingGeometry(.53,.55,40)),basic(0xa5e2c0,{transparent:true,opacity:.35,side:THREE.DoubleSide}),pondX,.163,pondZ,.95,.55,1);ripple.rotation.x=-Math.PI/2;
  const log=cyl(wood,-6.9,.33,4.6,.21,1.35);log.rotation.z=Math.PI/2;log.rotation.y=.3;
  const logEnd=cyl(mat(0xbd9d60),-6.25,.33,4.40,.175,.02);logEnd.rotation.z=Math.PI/2;logEnd.rotation.y=.3;

  const pads=new Map(), towerVisuals=new Map(), enemyVisuals=new Map(), hitTargets=[];
  const plusMaterial=basic(0xc5d9a0,{transparent:true,opacity:.78});
  const padRimMaterial=basic(0xabc385,{transparent:true,opacity:.8});
  padList.forEach(p=>{
    const g=new THREE.Group();g.position.set(p.x,.14,p.z);scene.add(g);
    const slab=box(darkStone,0,.045,0,1.24,.10,1.24,g);
    box(stone,0,.115,0,1.09,.06,1.09,g);
    const corners=new THREE.Group();g.add(corners);
    for(const x of [-.51,.51])for(const z of [-.51,.51]){box(padRimMaterial,x,.156,z,.26,.025,.035,corners);box(padRimMaterial,x,.156,z,.035,.025,.26,corners);}
    const plus=new THREE.Group();g.add(plus);box(plusMaterial,0,.158,0,.35,.015,.065,plus);box(plusMaterial,0,.158,0,.065,.015,.35,plus);
    const hit=box(basic(0xffffff,{visible:false}),0,.35,0,1.35,.65,1.35,g);hit.userData={kind:'pad',id:p.id};hitTargets.push(hit);
    pads.set(p.id,{group:g,plus,corners,hit,data:p});
  });
  const grid=new THREE.GridHelper(20,20,0xb1c58c,0xa7be88);grid.position.y=.17;grid.material.transparent=true;grid.material.opacity=.13;grid.visible=false;scene.add(grid);

  const gate=new THREE.Group();gate.position.set(route[0].x,.15,route[0].z);scene.add(gate);
  cyl(darkStone,0,.1,0,.95,.2,gate);
  for(const z of [-.78,.78]){box(darkStone,0,.5,z,.44,.9,.43,gate);box(gold,0,.96,z,.5,.13,.5,gate);}
  const portalMat=mat(0xfa8b72,{emissive:0xf15945,emissiveIntensity:.8});
  const portal=mesh(geo(new THREE.TorusGeometry(.72,.105,5,16)),portalMat,0,1.08,0,1,1.17,1,gate);portal.rotation.y=Math.PI/2;
  const portalInner=mesh(circleGeo,basic(0xe66264,{transparent:true,opacity:.22,side:THREE.DoubleSide}),0,1.08,0,.68,.81,1,gate);portalInner.rotation.y=Math.PI/2;
  const portalCore=mesh(geo(new THREE.TorusGeometry(.49,.025,4,24)),basic(0xffba91),.025,1.08,0,1,1.17,1,gate);portalCore.rotation.y=Math.PI/2;

  const core=new THREE.Group();core.position.set(route.at(-1).x,.15,route.at(-1).z);scene.add(core);
  cyl(darkStone,0,.1,0,.95,.2,core);cyl(lightStone,0,.24,0,.7,.13,core);cyl(metal,0,.37,0,.48,.2,core);
  const mainCrystal=mesh(crystalGeo,cyan,0,1.17,0,.47,.9,.47,core);mainCrystal.rotation.z=.1;
  const coreRing=mesh(geo(new THREE.TorusGeometry(.68,.035,5,30)),cyan,0,.65,0,1,1,1,core);coreRing.rotation.x=Math.PI/2;
  for(let i=0;i<3;i++){const a=i*TAU/3;const x=Math.sin(a)*.67,z=Math.cos(a)*.67;cyl(stone,x,.35,z,.13,.4,core);mesh(crystalGeo,cyan,x,.63,z,.12,.24,.12,core);}

  function towerGroup(type,level=1) {
    const group=new THREE.Group(),head=new THREE.Group();
    cyl(darkStone,0,.10,0,.50,.2,group);cyl(lightStone,0,.24,0,.41,.16,group);
    cyl(metal,0,.42,0,.30,.25,group);
    const flavor=String(type).toLowerCase();
    if(flavor==='frost'||flavor==='ice') {
      cyl(stone,0,.63,0,.30,.22,group);cyl(gold,0,.76,0,.33,.10,group);
      head.position.y=.81;group.add(head);
      const crystal=mesh(crystalGeo,cyan,0,.42,0,.27,.6,.27,head);crystal.rotation.z=.12;
      for(let i=0;i<3;i++){const a=i*TAU/3;const c=mesh(crystalGeo,cyan,Math.sin(a)*.29,.15,Math.cos(a)*.29,.13,.31,.13,head);c.rotation.z=Math.sin(a)*-.25;c.rotation.x=Math.cos(a)*.25;}
      const halo=mesh(geo(new THREE.TorusGeometry(.42,.025,4,24)),cyan,0,.14,0,1,1,1,head);halo.rotation.x=Math.PI/2;
    } else if(flavor==='cannon'||flavor==='mortar') {
      cyl(orange,0,.63,0,.35,.28,group);cyl(metal,0,.79,0,.36,.1,group);
      head.position.y=.88;group.add(head);box(orange,0,.06,0,.62,.4,.6,head);
      const barrel=cyl(metal,0,.22,.38,.235,.8,head);barrel.rotation.x=Math.PI/2-.23;
      const muzzle=cyl(orange,0,.30,.73,.26,.13,head);muzzle.rotation.x=Math.PI/2-.23;
      const hole=cyl(basic(0x152622),0,.32,.80,.17,.016,head);hole.rotation.x=Math.PI/2-.23;
      for(const x of [-.35,.35]){const bolt=cyl(gold,x,.08,0,.10,.09,head);bolt.rotation.z=Math.PI/2;}
    } else {
      cyl(wood,0,.65,0,.29,.42,group);cyl(lime,0,.80,0,.33,.10,group);
      head.position.y=.96;group.add(head);box(metal,0,.02,0,.52,.34,.55,head);box(lime,0,.20,-.05,.55,.09,.48,head);
      const barrel=cyl(metal,0,.08,.5,.12,.75,head);barrel.rotation.x=Math.PI/2;
      const end=cyl(lime,0,.08,.83,.15,.16,head);end.rotation.x=Math.PI/2;
      const bore=cyl(basic(0x172d24),0,.08,.918,.08,.01,head);bore.rotation.x=Math.PI/2;
      box(gold,-.31,.02,-.1,.10,.22,.22,head);box(lime,0,.30,-.13,.15,.12,.13,head);
    }
    if(level>1)for(let i=0;i<Math.min(level-1,3);i++)cyl(gold,0,.36+i*.075,0,.32,.025,group);
    group.userData={head,type,level};return group;
  }

  const selection=new THREE.Group();scene.add(selection);selection.visible=false;
  const rangeFill=mesh(circleGeo,basic(0xc6ed87,{transparent:true,opacity:.055,side:THREE.DoubleSide,depthWrite:false}),0,.20,0,1,1,1,selection);rangeFill.rotation.x=-Math.PI/2;
  const rangeLineMat=new THREE.LineDashedMaterial({color:0xc8ee91,transparent:true,opacity:.60,dashSize:.22,gapSize:.14});materials.add(rangeLineMat);
  const points=Array.from({length:129},(_,i)=>new THREE.Vector3(Math.cos(i/128*TAU),0,Math.sin(i/128*TAU)));
  const rangeLine=new THREE.Line(geo(new THREE.BufferGeometry().setFromPoints(points)),rangeLineMat);rangeLine.computeLineDistances();rangeLine.position.y=.205;selection.add(rangeLine);
  const selectedRing=mesh(geo(new THREE.RingGeometry(.66,.70,48)),basic(0xc8f08d,{transparent:true,opacity:.9,side:THREE.DoubleSide}),0,.215,0,1,1,1,selection);selectedRing.rotation.x=-Math.PI/2;
  let buildType=null, selectedTower=null, ghost=null, hovered=null, currentState={towers:[],enemies:[]},time=0;
  const effects=[];
  function makeEnemy(enemy) {
    const group=new THREE.Group();const body=new THREE.Group();group.add(body);
    const kind=String(enemy.type||'').toLowerCase(),heavy=kind.includes('tank')||kind.includes('arm')||kind.includes('brute')||kind.includes('boss'),fast=kind.includes('fast')||kind.includes('runner');
    const size=heavy?1.35:fast?.8:1,bodyMat=mat(heavy?0x748f9c:fast?0xe9b45f:0xe28b7a),eyeMat=basic(0xffefd0);
    mesh(sphereGeo,bodyMat,0,.39,0,.28,.28,.31,body);
    const shell=mesh(sphereGeo,heavy?metal:bodyMat,0,.48,-.04,.30,.23,.27,body);shell.rotation.y=Math.PI/5;
    box(darkStone,0,.43,.255,.30,.12,.06,body);
    for(const x of [-.088,.088]){box(eyeMat,x,.445,.294,.055,.045,.012,body);const ant=cyl(metal,x*1.4,.73,-.07,.018,.20,body);ant.rotation.z=-x*2;mesh(sphereGeo,heavy?orange:lime,x*1.55,.83,-.07,.035,.035,.035,body);}
    const legs=[];for(const x of [-.23,.23])for(const z of [-.16,.16]){const leg=box(metal,x,.18,z,.075,.22,.09,body);legs.push(leg);}
    body.scale.setScalar(size);
    const hp=new THREE.Group();hp.position.y=heavy?1.18:.99;group.add(hp);
    const bg=mesh(planeGeo,basic(0x24372b,{depthTest:false}),0,0,0,.57,.065,1,hp);
    const health=mesh(planeGeo,basic(0xd5e9a4,{depthTest:false}),0,0,.002,.53,.035,1,hp);bg.renderOrder=5;health.renderOrder=6;
    scene.add(group);return {group,body,legs,hp,health,lastX:enemy.x,lastZ:enemy.z,phase:rand()*TAU,size};
  }
  function removeObject(obj) {obj.parent?.remove(obj);}
  function syncTowers(towers) {
    const ids=new Set(towers.map(t=>t.id));
    for(const [id,v]of towerVisuals)if(!ids.has(id)){removeObject(v.group);hitTargets.splice(hitTargets.indexOf(v.hit),1);towerVisuals.delete(id);}
    for(const p of pads.values())p.plus.visible=true;
    towers.forEach(t=>{
      let v=towerVisuals.get(t.id);const p=pads.get(t.padId),pos=pt(t.x===undefined?p?.data||t:t);
      if(p)p.plus.visible=false;
      if(!v||v.level!==(t.level||1)||v.type!==t.type){
        if(v){removeObject(v.group);hitTargets.splice(hitTargets.indexOf(v.hit),1);}
        const g=towerGroup(t.type,t.level||1);scene.add(g);const hit=box(basic(0xffffff,{visible:false}),0,.75,0,.9,1.5,.9,g);hit.userData={kind:'tower',id:t.id};hitTargets.push(hit);
        v={group:g,head:g.userData.head,hit,type:t.type,level:t.level||1,kick:0};towerVisuals.set(t.id,v);
      }
      v.group.position.set(pos.x,.31,pos.z);v.data=t;
    });
  }
  function refreshSelection() {
    const selected = typeof selectedTower==='object'?currentState.towers.find(t=>t.id===selectedTower?.id)||selectedTower:currentState.towers.find(t=>t.id===selectedTower);
    const hoveringPad=hovered?.kind==='pad'?pads.get(hovered.id):null;
    const occupied=hoveringPad&&currentState.towers.some(t=>t.padId===hoveringPad.data.id);
    const placing=!!(buildType&&hoveringPad&&!occupied);
    if(ghost){ghost.visible=placing;if(placing)ghost.position.set(hoveringPad.data.x,.31,hoveringPad.data.z);}
    if(placing){selection.visible=true;selection.position.set(hoveringPad.data.x,0,hoveringPad.data.z);const def=TOWER_TYPES[buildType]||{};const range=def.range||3.2;rangeFill.scale.set(range,range,1);rangeLine.scale.set(range,1,range);}
    else if(selected){const p=pt(selected);selection.visible=true;selection.position.set(p.x,0,p.z);const range=selected.range||TOWER_TYPES[selected.type]?.range||3.2;rangeFill.scale.set(range,range,1);rangeLine.scale.set(range,1,range);}
    else selection.visible=false;
    for(const p of pads.values())p.corners.scale.setScalar(hoveringPad===p?1.1:1);
  }
  function setBuildType(type) {
    buildType=type;if(ghost){removeObject(ghost);ghost=null;}
    if(type){ghost=towerGroup(type);ghost.traverse(o=>{if(o.isMesh){o.material=o.material.clone();materials.add(o.material);o.material.transparent=true;o.material.opacity=.42;o.material.depthWrite=false;o.castShadow=false;}});ghost.visible=false;scene.add(ghost);}
    refreshSelection();
  }
  function setSelectedTower(tower) {selectedTower=tower;refreshSelection();}
  const effectMaterials=new Map();
  const effectMaterial=color=>{if(!effectMaterials.has(color))effectMaterials.set(color,basic(color));return effectMaterials.get(color);};
  function burst(x,z,color,count=9,y=.6) {
    if(!Number.isFinite(x)||!Number.isFinite(z))return;
    const material=effectMaterial(color);
    for(let i=0;i<count;i++){const m=mesh(sphereGeo,material,x,y,z,.04+rand()*.06);m.castShadow=false;effects.push({kind:'particle',mesh:m,v:new THREE.Vector3((rand()-.5)*3,1+rand()*2,(rand()-.5)*3),life:.5+rand()*.3,maxLife:.8});}
  }
  function handleEvent(event) {
    if(event.type==='change') {
      if(!['build','upgrade','reset'].includes(event.reason))return;
      event={...event,type:event.reason};
    }
    if(event.type==='shoot'){
      const v=towerVisuals.get(event.towerId);if(v)v.kick=.15;
      const from=pt(event.from||v?.data||{}),enemy=currentState.enemies.find(e=>e.id===event.enemyId),to=pt(event.to||enemy||{}),type=event.towerType||v?.type||'sentry';
      const color=type==='frost'?0x9eeeff:type==='cannon'?0xffc375:0xd7f18a;
      const m=mesh(sphereGeo,effectMaterial(color),from.x,1.25,from.z,type==='cannon'?.13:.065);m.castShadow=false;
      effects.push({kind:'shot',mesh:m,from:new THREE.Vector3(from.x,1.25,from.z),to:new THREE.Vector3(to.x,.6,to.z),life:type==='cannon'?.32:.15,maxLife:type==='cannon'?.32:.15,arc:type==='cannon'?1.2:0,color});
    }else if(event.type==='kill')burst(event.x,event.z,0xe8ce85,7);
    else if(event.type==='leak')burst(event.x??route.at(-1).x,event.z??route.at(-1).z,0x87f1ef,10);
    else if(event.type==='build'||event.type==='upgrade'){const t=event.tower||currentState.towers.find(t=>t.id===event.towerId);if(t)burst(t.x,t.z,0xd1f192,12,.5);}
    else if(event.type==='reset'){for(const e of effects)removeObject(e.mesh);effects.length=0;setSelectedTower(null);}
  }

  let yaw=.64,zoomFactor=1,dragging=false,pointerStart=null,didDrag=false;
  const target=new THREE.Vector3(0,.1,0),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  function positionCamera(){camera.position.set(Math.sin(yaw)*32,28,Math.cos(yaw)*32);camera.lookAt(target);camera.updateProjectionMatrix();}
  function resize() {
    const w=Math.max(1,container.clientWidth),h=Math.max(1,container.clientHeight);renderer.setSize(w,h,false);
    const aspect=w/h,vertical=Math.max(18.2,28/aspect)/zoomFactor;camera.left=-vertical*aspect/2;camera.right=vertical*aspect/2;camera.top=vertical/2;camera.bottom=-vertical/2;positionCamera();
  }
  function pick(e) {
    const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
    const hits=raycaster.intersectObjects(hitTargets,false);return hits.length?hits[0].object.userData:null;
  }
  function pointerDown(e){if(e.button!==0)return;pointerStart={x:e.clientX,y:e.clientY,yaw};dragging=true;didDrag=false;renderer.domElement.setPointerCapture?.(e.pointerId);}
  function pointerMove(e){
    if(dragging&&pointerStart){const delta=e.clientX-pointerStart.x;if(Math.hypot(delta,e.clientY-pointerStart.y)>5)didDrag=true;if(didDrag){yaw=pointerStart.yaw-delta*.006;positionCamera();renderer.domElement.style.cursor='grabbing';return;}}
    hovered=pick(e);renderer.domElement.style.cursor=hovered?'pointer':'grab';
    onHover?.(hovered?{padId:hovered.kind==='pad'?hovered.id:null,towerId:hovered.kind==='tower'?hovered.id:null,x:e.clientX,y:e.clientY}:null);refreshSelection();
  }
  function pointerUp(e){if(!dragging)return;dragging=false;renderer.domElement.releasePointerCapture?.(e.pointerId);if(!didDrag){const hit=pick(e);if(hit?.kind==='tower')onTowerClick?.(hit.id);else if(hit?.kind==='pad')onPadClick?.(hit.id);}renderer.domElement.style.cursor=hovered?'pointer':'grab';pointerStart=null;}
  function pointerLeave(){if(dragging)return;hovered=null;onHover?.(null);refreshSelection();}
  function wheel(e){e.preventDefault();zoom(e.deltaY>0?-.08:.08);}
  function zoom(delta){zoomFactor=THREE.MathUtils.clamp(zoomFactor+delta,.75,1.5);resize();}
  function resetView(){yaw=.64;zoomFactor=1;resize();}
  function setView(angle){yaw=angle===undefined?yaw+Math.PI/2:angle;positionCamera();}
  renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointermove',pointerMove);renderer.domElement.addEventListener('pointerup',pointerUp);renderer.domElement.addEventListener('pointercancel',pointerUp);renderer.domElement.addEventListener('pointerleave',pointerLeave);renderer.domElement.addEventListener('wheel',wheel,{passive:false});
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(container);resize();

  function update(state,dt=1/60) {
    dt=Math.min(dt,.08);time+=dt;currentState=state||currentState;const towers=currentState.towers||[],enemies=currentState.enemies||[];
    syncTowers(towers);
    const ids=new Set(enemies.map(e=>e.id));for(const [id,v]of enemyVisuals)if(!ids.has(id)){removeObject(v.group);enemyVisuals.delete(id);}
    for(const enemy of enemies){
      let v=enemyVisuals.get(enemy.id);if(!v){v=makeEnemy(enemy);enemyVisuals.set(enemy.id,v);}
      const p=pt(enemy),dx=p.x-v.lastX,dz=p.z-v.lastZ;v.group.position.set(p.x,.17,p.z);
      if(Math.abs(dx)+Math.abs(dz)>.00005)v.body.rotation.y=Math.atan2(dx,dz);
      v.body.position.y=Math.sin(time*13+v.phase)*.035;v.legs.forEach((leg,i)=>leg.rotation.x=Math.sin(time*13+v.phase+i*Math.PI)*.45);
      v.hp.quaternion.copy(camera.quaternion);const hp=Math.max(0,(enemy.hp??enemy.health??1)/(enemy.maxHp??enemy.maxHealth??1));v.health.scale.x=.53*hp;v.health.position.x=-.265*(1-hp);v.health.material.color.setHex(hp<.3?0xf2a174:0xd5e9a4);
      v.lastX=p.x;v.lastZ=p.z;
      v.body.rotation.z=enemy.slowed||enemy.slowUntil>currentState.time?Math.sin(time*5)*.03:0;
    }
    for(const v of towerVisuals.values()){
      const t=v.data;let nearest=null,distance=Infinity;for(const enemy of enemies){const d=Math.hypot(enemy.x-t.x,enemy.z-t.z);if(d<distance&&d<(t.range||4)+.5){nearest=enemy;distance=d;}}
      if(v.type==='frost'){v.head.rotation.y+=dt*.6;v.head.position.y=.81+Math.sin(time*2+t.x)*.045;}
      else if(nearest){const angle=Math.atan2(nearest.x-t.x,nearest.z-t.z),diff=Math.atan2(Math.sin(angle-v.head.rotation.y),Math.cos(angle-v.head.rotation.y));v.head.rotation.y+=diff*Math.min(1,dt*14);}
      v.kick=Math.max(0,v.kick-dt*1.5);v.head.scale.z=1-v.kick;
    }
    for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.life-=dt;if(e.life<=0){removeObject(e.mesh);if(e.kind==='shot'&&e.arc)burst(e.to.x,e.to.z,e.color,7,.35);effects.splice(i,1);continue;}
      if(e.kind==='shot'){const f=1-e.life/e.maxLife;e.mesh.position.lerpVectors(e.from,e.to,f);e.mesh.position.y+=Math.sin(f*Math.PI)*e.arc;}
      else {e.v.y-=dt*5;e.mesh.position.addScaledVector(e.v,dt);e.mesh.scale.multiplyScalar(1-dt*1.6);}
    }
    mainCrystal.rotation.y=time*.25;mainCrystal.position.y=1.17+Math.sin(time*1.8)*.09;coreRing.rotation.z=Math.sin(time*.5)*.12;portalInner.material.opacity=.18+Math.sin(time*2)*.06;portalCore.scale.setScalar(.98+Math.sin(time*2.3)*.04);ripple.scale.set(1+Math.sin(time)*.04,.58+Math.sin(time)*.03,1);
    refreshSelection();renderer.render(scene,camera);
  }
  function dispose(){resizeObserver.disconnect();renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointermove',pointerMove);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.domElement.removeEventListener('pointercancel',pointerUp);renderer.domElement.removeEventListener('pointerleave',pointerLeave);renderer.domElement.removeEventListener('wheel',wheel);for(const g of geometries)g.dispose();for(const m of materials)m.dispose();renderer.dispose();renderer.domElement.remove();}
  return {update,handleEvent,setBuildType,setSelectedTower,setGrid:value=>{grid.visible=value;},setView,zoom,resetView,resize,dispose,renderer,scene,camera};
}
