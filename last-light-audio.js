// Original, locally synthesized pentatonic score. No downloads or autoplay.
export function createAudio({Audio=globalThis.AudioContext||globalThis.webkitAudioContext}={}) {
  let context=null,musicBus=null,sfxBus=null,music=false,sfx=false,suspended=false,step=0,nextBeat=0,boss=false;
  const voices=new Set();
  let musicVolume=1,sfxVolume=1,region='Japan';
  async function unlock(){
    if(!Audio)throw new Error('Web Audio is unavailable');
    if(!context){context=new Audio();musicBus=context.createGain();sfxBus=context.createGain();musicBus.gain.value=0;sfxBus.gain.value=0;musicBus.connect(context.destination);sfxBus.connect(context.destination);}
    await context.resume();
  }
  function volume(bus,value){if(!bus)return;bus.gain.cancelScheduledValues(context.currentTime);bus.gain.setTargetAtTime(value,context.currentTime,.12);}
  function note(frequency,start,duration,gain,type,bus,slide=0){
    if(!context||voices.size>48)return;
    const osc=context.createOscillator(),env=context.createGain();osc.type=type;osc.frequency.setValueAtTime(frequency,start);
    if(slide)osc.frequency.exponentialRampToValueAtTime(slide,start+duration);
    env.gain.setValueAtTime(.0001,start);env.gain.exponentialRampToValueAtTime(gain,start+.02);env.gain.exponentialRampToValueAtTime(.0001,start+duration);
    osc.connect(env);env.connect(bus);voices.add(osc);osc.onended=()=>{osc.disconnect();env.disconnect();voices.delete(osc);};osc.start(start);osc.stop(start+duration+.02);
  }
  function applyVolume(){volume(musicBus,music&&!suspended?.42*musicVolume:0);volume(sfxBus,sfx&&!suspended?.65*sfxVolume:0);}
  async function setMusic(enabled){await unlock();music=!!enabled;applyVolume();if(music){nextBeat=context.currentTime+.03;step=0;}return music;}
  async function setSfx(enabled){await unlock();sfx=!!enabled;applyVolume();return sfx;}
  function setVolumes(musicPercent,sfxPercent){musicVolume=Math.max(0,Math.min(100,musicPercent))/100;sfxVolume=Math.max(0,Math.min(100,sfxPercent))/100;applyVolume();}
  function setRegion(value){region=value;}
  function setSuspended(value){if(suspended===!!value)return;suspended=!!value;applyVolume();if(context&&!suspended)nextBeat=context.currentTime+.03;}
  function tick(isBoss=false){
    boss=isBoss;if(!context||context.state!=='running'||!music||suspended)return;
    if(nextBeat<context.currentTime-.5)nextBeat=context.currentTime+.03;
    const melody=region==='Egypt'?[0,1,4,7,8,7,4,1,0,4,7,12,13,12,8,7]:[0,7,12,14,7,4,2,7,0,4,7,12,14,12,7,2],bassline=[0,-5,-3,-7];
    while(nextBeat<context.currentTime+.15){
      const root=boss?146.832:164.814,beat=boss?.38:.52;
      const semitone=melody[step%melody.length];
      note(root*2**(semitone/12),nextBeat,beat*1.5,.075,'triangle',musicBus);
      if(step%4===0){const base=root/2*2**(bassline[Math.floor(step/8)%4]/12);note(base,nextBeat,beat*4,.12,'sine',musicBus);note(base*1.5,nextBeat,beat*3.8,.035,'sine',musicBus);}
      if(boss&&step%2===0)note(90,nextBeat,.13,.1,'sine',musicBus,38);
      step++;nextBeat+=beat;
    }
  }
  function effect(type,critical=false){
    if(!sfx||suspended||!context||context.state!=='running')return;
    const now=context.currentTime;
    if(type==='hit'){note(critical?850:520,now,.09,critical?.11:.075,'triangle',sfxBus,150);}
    else if(type==='arrow')note(700,now,.12,.04,'sine',sfxBus,260);
    else if(type==='playerHit')note(110,now,.14,.12,'sine',sfxBus,48);
    else if(type==='slam')note(130,now,.4,.2,'sine',sfxBus,28);
    else if(type==='waveStart')note(180,now,.25,.1,'triangle',sfxBus,360);
    else if(['levelUp','skill','waveClear','victory'].includes(type)){
      [330,440,660].forEach((f,i)=>note(f,now+i*.09,.3,.07,'sine',sfxBus));
    }else if(type==='defeat')note(150,now,.6,.1,'triangle',sfxBus,65);
  }
  function status(){return {music,sfx,suspended,running:context?.state==='running',voices:voices.size};}
  return {setMusic,setSfx,setVolumes,setRegion,setSuspended,tick,effect,status};
}
