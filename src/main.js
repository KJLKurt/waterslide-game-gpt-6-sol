import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {createCourse} from './track.js';
import {makeRacerVisual,PALETTES,COSMETICS} from './racerVisual.js';
import {readSave,writeSave} from './storage.js';
import './style.css';

const $=id=>document.getElementById(id);
const save=readSave();
const scene=new THREE.Scene();scene.background=new THREE.Color(0xd9f4ff);scene.fog=new THREE.FogExp2(0xd9f4ff,.0019);
const sky=new THREE.Mesh(new THREE.SphereGeometry(900,16,8),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,vertexShader:'varying vec3 vDir; void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'varying vec3 vDir; void main(){float t=smoothstep(-0.16,0.75,normalize(vDir).y);gl_FragColor=vec4(mix(vec3(0.68,0.87,0.96),vec3(0.88,0.97,1.0),t),1.0);}' }));sky.renderOrder=-1000;scene.add(sky);
scene.add(new THREE.HemisphereLight(0xffffff,0x73aac3,2.05));
const sun=new THREE.DirectionalLight(0xfff4db,2.45);sun.position.set(-65,120,55);scene.add(sun);
const camera=new THREE.PerspectiveCamera(68,1,.1,1200);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setClearColor(0xd9f4ff);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
$('game').appendChild(renderer.domElement);
const course=createCourse(scene);
const water=new THREE.Mesh(new THREE.PlaneGeometry(1400,1400),new THREE.MeshStandardMaterial({color:0x21b6d0,roughness:.76,metalness:.03}));
water.rotation.x=-Math.PI/2;water.position.y=-20;scene.add(water);
const islandMat=new THREE.MeshStandardMaterial({color:0xd7eccb,roughness:.95});
const islandGeom=new THREE.ConeGeometry(20,10,9);
for(let i=0;i<19;i++){
  const x=Math.sin(i*6.78)*185+20,z=i*28-40;
  const island=new THREE.Mesh(islandGeom,islandMat);island.position.set(x,-17,z);island.scale.set(.55+(i%4)*.23,1,.55+(i%3)*.28);scene.add(island);
}
const buoyMat=new THREE.MeshStandardMaterial({color:0xffebae,roughness:.5});
const buoyGeom=new THREE.CylinderGeometry(.18,.5,2.4,6);
for(let f=.07;f<1;f+=.105){
  const frame=course.main.at(f*course.main.length);
  for(const side of [-1,1]){
    const buoy=new THREE.Mesh(buoyGeom,buoyMat);
    buoy.position.copy(frame.p).addScaledVector(frame.right,side*8).addScaledVector(frame.up,-.15);scene.add(buoy);
  }
}
const raycaster=new THREE.Raycaster();const down=new THREE.Vector3(0,-1,0);
let composer=null,bloom=null;
let mode='menu',returnTo='menu',raceTime=0,countdownTime=0,elapsed=0,player=null,racers=[],finishOrder=[],finishResult=null;
let joystickX=0,joystickPointer=null,jumpQueued=false,toastTimer=0,shownCheckpoint=-1;
const droplets=[];const dropGeo=new THREE.SphereGeometry(.13,5,4);const dropMat=new THREE.MeshBasicMaterial({color:0xd9faff,transparent:true,opacity:.85});
const dropMesh=new THREE.InstancedMesh(dropGeo,dropMat,48);dropMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);dropMesh.count=0;scene.add(dropMesh);
const dropObject=new THREE.Object3D();
function splash(position,count=9){if(!save.vfx)return;for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,k=2+Math.random()*3;droplets.push({p:position.clone(),v:new THREE.Vector3(Math.cos(a)*k,3+Math.random()*4,Math.sin(a)*k),life:.65+Math.random()*.3})}}
function updateVfx(dt){dropMesh.visible=save.vfx;if(!save.vfx){droplets.length=0;return}for(let i=droplets.length-1;i>=0;i--){const d=droplets[i];d.life-=dt;d.v.y-=14*dt;d.p.addScaledVector(d.v,dt);if(d.life<=0)droplets.splice(i,1)}if(player&&mode==='racing'&&player.state==='Sliding'&&player.speed>20&&Math.random()<.25)splash(player.visual.root.position.clone().add(new THREE.Vector3(0,.1,0)),2);while(droplets.length>48)droplets.shift();dropMesh.count=droplets.length;droplets.forEach((d,i)=>{dropObject.position.copy(d.p);dropObject.scale.setScalar(clamp(d.life*2,.15,1));dropObject.updateMatrix();dropMesh.setMatrixAt(i,dropObject.matrix)});dropMesh.instanceMatrix.needsUpdate=true}
const keys=new Set();
const ACC=8.3,GRAV=22,PLAYER_MAX=34.5;
let lastTime=performance.now(),accum=0,slowDevice=false,frameAverage=0,frameSamples=0;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fmt=t=>{const m=Math.floor(t/60),s=t%60;return `${String(m).padStart(2,'0')}:${s.toFixed(1).padStart(4,'0')}`};
const setVisible=(id,on)=>$(id).classList.toggle('hidden',!on);
const isMobile=()=>matchMedia('(pointer:coarse)').matches;

function updateQuality(){
  const low=save.graphics==='low'||(save.graphics==='auto'&&(isMobile()||slowDevice));
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,low?1:1.5));
  renderer.shadowMap.enabled=!!save.shadows;sun.castShadow=!!save.shadows;
  if(save.shadows){sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-70;sun.shadow.camera.right=70;sun.shadow.camera.top=70;sun.shadow.camera.bottom=-70;sun.shadow.bias=-.0004}
  if(save.postprocessing&&!composer){
    composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
    bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.42,.4,.9);composer.addPass(bloom);composer.addPass(new OutputPass());
  }
  resize();
}
function resize(){
  const w=innerWidth,h=innerHeight;camera.aspect=w/h;
  camera.fov=h>w?74:66;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
  if(composer)composer.setSize(w,h);
}
addEventListener('resize',resize);
function render(){save.postprocessing&&composer?composer.render():renderer.render(scene,camera)}

function createRacer(id,isPlayer=false){
  const skill=isPlayer?1:.48+Math.random()*.49,risk=isPlayer?0:.15+Math.random()*.77,aggression=isPlayer?0:.2+Math.random()*.75;
  const palette=isPlayer?save.palette:(id+Math.floor(id/3))%4;
  const cosmetic=isPlayer?save.cosmetic:id%4;
  const visual=makeRacerVisual(palette,cosmetic);scene.add(visual.root);
  const racer={id,isPlayer,skill,risk,aggression,visual,route:course.main,s:Math.max(0,4-Math.floor(id/3)*2.1),u:((id%3)-1)*2.5,
    speed:0,vy:0,airHeight:0,airTime:0,state:'Sliding',miss:0,checkpoint:0,checkpointIndex:0,
    lean:0,targetU:0,phase:Math.random()*6.28,shortcutIntent:false,shortcutDecided:false,
    failureRoll:Math.random(),jumpedGap:false,jumpedRamp:false,finishTime:null,fallTimer:0};
  placeVisual(racer,0);return racer;
}
function resetRace(){
  for(const racer of racers)scene.remove(racer.visual.root);
  racers=Array.from({length:13},(_,i)=>createRacer(i,i===0));player=racers[0];
  finishOrder=[];finishResult=null;raceTime=0;countdownTime=3.6;shownCheckpoint=-1;jumpQueued=false;joystickX=0;droplets.length=0;nextMusicAt=0;
  mode='countdown';setVisible('menu',false);setVisible('result',false);setVisible('pause',false);setVisible('settings',false);setVisible('hud',true);setVisible('countdown',true);
  updateHud();
  try{audioContext?.resume()}catch{}
}
function normalized(r){
  if(r.route===course.main)return clamp(r.s/course.main.length,0,1);
  return clamp((course.branchStart+(course.branchEnd-course.branchStart)*r.s/course.shortcut.length)/course.main.length,0,1);
}
function rank(){
  const sorted=[...racers].sort((a,b)=>{
    if(a.finishTime!=null&&b.finishTime!=null)return a.finishTime-b.finishTime;
    if(a.finishTime!=null)return -1;if(b.finishTime!=null)return 1;
    if(a.state==='Falling'&&b.state!=='Falling')return 1;
    if(b.state==='Falling'&&a.state!=='Falling')return -1;
    return normalized(b)-normalized(a)||b.speed-a.speed;
  });
  return sorted.indexOf(player)+1;
}
function surfaceHit(route,s,u,referenceY){
  const expected=route.surface(s,u);
  raycaster.set(new THREE.Vector3(expected.x,Math.max(expected.y,referenceY)+5,expected.z),down);
  raycaster.far=18;
  const hits=raycaster.intersectObjects(course.floorMeshes,false);
  const hit=hits.find(h=>h.object===route.floor&&Math.abs(h.point.y-expected.y)<2.2);
  return hit?.point||null;
}
function launch(r,power=8.4){if(r.state!=='Sliding')return;r.state='Airborne';r.vy=power;r.airHeight=.12;r.airTime=0;r.miss=0;if(r.isPlayer){beep(580,.07,'sine');splash(r.visual.root.position,7)}}
function fall(r){
  if(r.state==='Falling'||r.state==='Finished')return;
  r.state='Falling';r.fallTimer=0;r.vy=-3;if(r.isPlayer){splash(r.visual.root.position,20);beep(190,.28,'sawtooth');showToast(save.practice?'WIPED OUT!':'OFF THE SLIDE!')}
}
function finish(r){
  if(r.state==='Finished')return;
  r.state='Finished';r.finishTime=raceTime;finishOrder.push(r);
  if(r.isPlayer){
    const place=finishOrder.length;
    const key=save.practice?'practice':'race';
    const old=save.bestTimes[key];if(!old||raceTime<old)save.bestTimes[key]=raceTime;
    let unlock='';
    if(!save.practice){
      const which=place===1?3:place<=3?2:1;
      if(!save.unlocks.includes(which)){save.unlocks.push(which);unlock=`NEW PALETTE UNLOCKED: ${PALETTES[which].name.toUpperCase()}!`}
    }
    writeSave(save);
    finishResult={place,time:raceTime,unlock};showResult(true);
  }
}
function showResult(won){
  mode='result';setVisible('hud',false);setVisible('countdown',false);setVisible('result',true);
  $('result-kicker').textContent=won?'RACE COMPLETE':save.practice?'PRACTICE RUN':'RACE OVER';
  $('result-title').textContent=won?(finishResult.place===1?'CHAMPION!':'FINISHED!'):'SPLASHDOWN!';
  $('result-subtitle').textContent=won?(finishResult.place===1?'You owned the slide.':'The next run is yours.'):'You missed the slide. Try the line again!';
  $('result-place').textContent=won?`${finishResult.place} / 13`:'— / 13';
  $('result-time').textContent=fmt(raceTime);
  $('result-unlock').textContent=finishResult?.unlock||'';
  refreshMenu();
}
function showToast(text){const el=$('checkpoint');el.textContent=text;setVisible('checkpoint',true);toastTimer=1.4}
function respawn(r){
  r.route=course.main;r.s=r.checkpoint;r.u=0;r.speed=Math.max(18,r.speed*.65);r.airHeight=0;r.vy=0;r.airTime=0;r.miss=0;r.state='Sliding';r.fallTimer=0;r.jumpedGap=r.s>course.main.length*.602;r.jumpedRamp=r.s>course.main.length*.75;
  if(r.isPlayer)showToast('BACK IN THE FLOW');
}
function npcSteer(r,dt){
  if(!r.shortcutDecided&&normalized(r)>.105){
    r.shortcutDecided=true;
    const behind=rankFor(r)>6;
    r.shortcutIntent=Math.random()<r.risk*(behind?1.4:1)*(r.skill*.7+.3);
  }
  const p=normalized(r);
  let target=Math.sin(r.phase+raceTime*.6)*(.4+(1-r.skill)*2.3);
  if(r.shortcutIntent&&r.route===course.main&&p>.135&&p<.23)target=3.9;
  else if(r.route===course.main&&p>.59&&p<.66)target+=(r.aggression-.5)*1.2;
  if(r.route===course.shortcut)target=.1+(r.aggression-.5)*.7;
  r.targetU=target;
  return clamp((target-r.u)*(.55+r.skill*.7),-1,1);
}
function rankFor(r){return [...racers].sort((a,b)=>normalized(b)-normalized(a)).indexOf(r)+1}
function updateRacer(r,dt){
  if(r.state==='Finished')return;
  if(r.state==='Falling'){
    r.fallTimer+=dt;r.vy-=GRAV*dt;r.visual.root.position.y+=r.vy*dt;
    if(r.isPlayer){if(save.practice&&r.fallTimer>.85)respawn(r);else if(!save.practice&&r.fallTimer>1.15){finishResult={place:null,time:raceTime,failed:true};showResult(false)}}
    return;
  }
  const steer=r.isPlayer?clamp((Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft')))+joystickX,-1,1):npcSteer(r,dt);
  const factor=r.state==='Airborne'?.39:1;
  r.u+=steer*(6.3*save.sensitivity)*factor*dt;
  r.lean=THREE.MathUtils.lerp(r.lean,steer,.14);
  const maxSpeed=r.isPlayer?PLAYER_MAX:27+r.skill*6.5+r.aggression*1.4;
  r.speed=Math.min(maxSpeed,r.speed+ACC*dt);
  const previousS=r.s;r.s+=r.speed*dt;
  if(r.route===course.main&&previousS<course.branchStart&&r.s>=course.branchStart&&r.u>2.4){
    r.route=course.shortcut;r.s=0;r.u=0;launch(r,5.8);
    if(r.isPlayer)showToast('SKYWAY SHORTCUT!');
  }
  if(r.route===course.shortcut&&r.s>=course.shortcut.length){r.route=course.main;r.s=course.branchEnd;r.u=1.5;r.airHeight=Math.max(0,r.airHeight);}
  if(r.route===course.main&&r.s>=course.main.length*.99){finish(r);return}
  const p=r.s/r.route.length;
  if(r.state==='Sliding'){
    if(r.isPlayer&&jumpQueued){launch(r,8.6);jumpQueued=false}
    else if(r.route===course.main&&previousS/course.main.length<.595&&p>=.595){launch(r,!r.isPlayer&&Math.random()<(1-r.skill)*.65?2.3:9.2);r.jumpedGap=true}
    else if(r.route===course.main&&previousS/course.main.length<.75&&p>=.75){launch(r,8.0);r.jumpedRamp=true}
    else if(r.route===course.shortcut&&previousS/course.shortcut.length<.44&&p>=.44){
      launch(r,r.isPlayer?8.1:7.4+r.skill*1.5);
      if(!r.isPlayer&&r.failureRoll>r.skill+.12)r.u=r.route.width/2+.4;
    }
  }
  const route=r.route;
  if(r.state==='Airborne'){
    if(r.isPlayer)jumpQueued=false;
    r.airTime+=dt;r.vy-=GRAV*dt;r.airHeight+=r.vy*dt;
    const hit=surfaceHit(route,Math.min(r.s,route.length),r.u,route.surface(Math.min(r.s,route.length),r.u).y+r.airHeight);
    if(r.vy<=0&&r.airHeight<=.26&&hit&&Math.abs(r.u)<route.width/2-.45){
      r.state='Sliding';r.airHeight=0;r.vy=0;r.airTime=0;r.miss=0;r.snapY=hit.y;splash(r.visual.root.position,6);
    }else if(r.airHeight<-8||r.airTime>2.8||Math.abs(r.u)>route.width/2+1.4){fall(r)}
  }else if(r.state==='Sliding'){
    const hit=surfaceHit(route,r.s,r.u,route.surface(r.s,r.u).y);
    if(!hit)r.miss+=dt;else {r.miss=0;r.snapY=hit.y;}
    if(Math.abs(r.u)>route.width/2-.42||r.miss>.12)fall(r);
  }
  if(r.isPlayer&&r.state!=='Falling'&&route===course.main){
    const markers=[.23,.47,.69,.86];
    for(let i=0;i<markers.length;i++)if(r.s>markers[i]*course.main.length&&i>r.checkpointIndex-1){
      r.checkpointIndex=i+1;r.checkpoint=markers[i]*course.main.length;
      if(save.practice&&i>shownCheckpoint){shownCheckpoint=i;showToast('CHECKPOINT!')}
    }
  }
  placeVisual(r,dt);
}
function placeVisual(r,dt){
  if(r.state==='Falling')return;
  const route=r.route,f=route.at(Math.min(r.s,route.length));
  const base=route.surface(Math.min(r.s,route.length),r.u);
  r.visual.root.position.copy(base).addScaledVector(f.up,r.airHeight+.18);
  if(r.state==='Sliding'&&Number.isFinite(r.snapY))r.visual.root.position.y=r.snapY+.18;
  const forward=f.tan.clone();forward.y=0;forward.normalize();
  r.visual.root.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),forward);
  r.visual.root.rotateZ(-Math.atan2(f.right.y,f.up.y)*.65);
  r.visual.animate(elapsed,r.lean,r.state==='Airborne',r.speed);
}
function updateCamera(dt){
  if(!player)return;
  const r=player,f=r.route.at(Math.min(r.s,r.route.length));
  const portrait=innerHeight>innerWidth;
  const distance=portrait?17.5:21,up=portrait?10.7:9;
  const target=r.visual.root.position.clone().addScaledVector(f.tan,-distance).add(new THREE.Vector3(0,up,0));
  const look=r.visual.root.position.clone().addScaledVector(f.tan,portrait?15:19).add(new THREE.Vector3(0,1.6,0));
  camera.position.lerp(target,1-Math.exp(-dt*4.5));
  const currentLook=window._cameraLook||(window._cameraLook=look.clone());currentLook.lerp(look,1-Math.exp(-dt*4.2));camera.lookAt(currentLook);
}
function updateHud(){
  if(!player)return;
  $('place').innerHTML=`${rank()}<span>/13</span>`;
  $('time').textContent=fmt(raceTime);
  $('progress').textContent=`${Math.floor(normalized(player)*100)}%`;
  $('speed').innerHTML=`${Math.floor(player.speed*3.6)} <small>km/h</small>`;
  $('progress-fill').style.width=`${normalized(player)*100}%`;
  setVisible('shortcut-hint',mode==='racing'&&player.route===course.main&&normalized(player)>.14&&normalized(player)<.22);
}
function update(dt){
  elapsed+=dt;
  if(mode==='countdown'){
    countdownTime-=dt;
    const n=Math.ceil(countdownTime);
    $('countdown').textContent=n>0?String(n):'GO!';
    if(countdownTime<=-.45){mode='racing';setVisible('countdown',false)}
  }else if(mode==='racing'){
    raceTime+=dt;
    for(const r of racers)updateRacer(r,dt);
    if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)setVisible('checkpoint',false)}
    updateHud();
    musicTick();
  }
  if(player)updateCamera(dt);
  updateVfx(dt);
}
function frame(now){
  const dt=Math.min(.05,(now-lastTime)/1000);lastTime=now;
  if(mode==='racing'&&save.graphics==='auto'&&!slowDevice){frameAverage+=dt;frameSamples++;if(frameSamples>=120){if(frameAverage/frameSamples>.028){slowDevice=true;updateQuality()}frameAverage=0;frameSamples=0}}
  if(mode!=='paused'){accum+=dt;let steps=0;while(accum>=1/60&&steps<4){update(1/60);accum-=1/60;steps++}}
  render();requestAnimationFrame(frame);
}
window.advanceTime=ms=>{const count=Math.max(1,Math.round(ms/(1000/60)));for(let i=0;i<count;i++)update(1/60);render()};
window.render_game_to_text=()=>JSON.stringify({coordinateSystem:'Track s is metres forward from start; u is metres right of center; y is world height.',mode,practice:save.practice,time:Number(raceTime.toFixed(2)),countdown:Number(countdownTime.toFixed(2)),place:player?rank():null,player:player?{state:player.state,route:player.route.name,s:Number(player.s.toFixed(1)),u:Number(player.u.toFixed(2)),speed:Number(player.speed.toFixed(1)),verticalVelocity:Number(player.vy.toFixed(1)),progress:Number(normalized(player).toFixed(3)),checkpoint:Number(player.checkpoint.toFixed(1))}:null,finished:finishOrder.length,npcs:racers.slice(1).map(r=>({state:r.state,progress:Number(normalized(r).toFixed(3))})),result:finishResult});

let audioContext=null,nextMusicAt=0,musicStep=0;
function musicTick(){
  if(!save.music)return;
  try{audioContext ||=new (window.AudioContext||window.webkitAudioContext)();if(audioContext.state!=='running')return;
    if(audioContext.currentTime<nextMusicAt)return;
    const notes=[196,246.94,293.66,246.94,220,261.63,329.63,261.63];
    const o=audioContext.createOscillator(),g=audioContext.createGain();o.type='triangle';o.frequency.value=notes[musicStep++%notes.length];
    const t=audioContext.currentTime;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.012,t+.025);g.gain.exponentialRampToValueAtTime(.0001,t+.35);o.connect(g).connect(audioContext.destination);o.start(t);o.stop(t+.36);nextMusicAt=t+.43;
  }catch{}
}
function beep(freq,duration,type='sine'){
  if(!save.audio)return;
  try{audioContext ||=new (window.AudioContext||window.webkitAudioContext)();const o=audioContext.createOscillator(),g=audioContext.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.035,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+duration);o.connect(g).connect(audioContext.destination);o.start();o.stop(audioContext.currentTime+duration)}catch{}
}
function refreshMenu(){
  $('practice-toggle').checked=save.practice;
  $('best-time').textContent=save.bestTimes[save.practice?'practice':'race']?fmt(save.bestTimes[save.practice?'practice':'race']):'—';
  $('unlock-count').textContent=`${String(save.unlocks.length).padStart(2,'0')} / 04`;
  $('palette-options').innerHTML='';
  PALETTES.forEach((p,i)=>{
    const b=document.createElement('button');b.className=`palette-btn ${save.palette===i?'selected':''} ${save.unlocks.includes(i)?'':'locked'}`;
    b.style.setProperty('--swatch',`#${p.body.toString(16).padStart(6,'0')}`);b.setAttribute('aria-label',`${p.name}${save.unlocks.includes(i)?'':' locked'}`);
    b.onclick=()=>{if(!save.unlocks.includes(i)){showToast('FINISH RACES TO UNLOCK');return}save.palette=i;writeSave(save);refreshMenu();previewRacer()};
    $('palette-options').appendChild(b);
  });
  $('cosmetic-name').textContent=COSMETICS[save.cosmetic];
}
function previewRacer(){
  if(!player||mode!=='menu')return;
  scene.remove(player.visual.root);player.visual=makeRacerVisual(save.palette,save.cosmetic);scene.add(player.visual.root);placeVisual(player,0);
}
$('play-btn').onclick=()=>{beep(440,.08);resetRace()};
$('practice-toggle').onchange=e=>{save.practice=e.target.checked;writeSave(save);refreshMenu()};
$('cosmetic-prev').onclick=()=>{save.cosmetic=(save.cosmetic+COSMETICS.length-1)%COSMETICS.length;writeSave(save);refreshMenu();previewRacer()};
$('cosmetic-next').onclick=()=>{save.cosmetic=(save.cosmetic+1)%COSMETICS.length;writeSave(save);refreshMenu();previewRacer()};
function openSettings(){returnTo=mode;mode='settings';setVisible('settings',true);setVisible('pause',false);syncSettings()}
function closeSettings(){setVisible('settings',false);mode=returnTo;if(mode==='paused')setVisible('pause',true)}
$('settings-open').onclick=openSettings;$('pause-settings').onclick=openSettings;$('settings-close').onclick=closeSettings;$('settings-done').onclick=closeSettings;
function syncSettings(){for(const key of ['graphics','sensitivity','handedness'])$(key).value=save[key];for(const key of ['audio','music','shadows','postprocessing','vfx'])$(key).checked=save[key];$('sensitivity-value').textContent=Number(save.sensitivity).toFixed(1)}
for(const key of ['graphics','sensitivity','handedness','audio','music','shadows','postprocessing','vfx']){
  $(key).addEventListener(key==='sensitivity'?'input':'change',e=>{
    save[key]=e.target.type==='checkbox'?e.target.checked:e.target.type==='range'?Number(e.target.value):e.target.value;
    writeSave(save);$('sensitivity-value').textContent=Number(save.sensitivity).toFixed(1);
    $('controls').classList.toggle('right-handed',save.handedness==='right');
    if(['graphics','shadows','postprocessing'].includes(key))updateQuality();
  });
}
function pause(){if(mode!=='racing'&&mode!=='countdown')return;returnTo=mode;mode='paused';setVisible('pause',true);setVisible('countdown',false)}
function resume(){mode=returnTo==='countdown'?'countdown':'racing';setVisible('pause',false);setVisible('countdown',mode==='countdown');lastTime=performance.now()}
$('pause-btn').onclick=pause;$('resume-btn').onclick=resume;
function menu(){mode='menu';setVisible('pause',false);setVisible('result',false);setVisible('settings',false);setVisible('hud',false);setVisible('countdown',false);setVisible('menu',true);refreshMenu()}
$('quit-btn').onclick=menu;$('result-menu').onclick=menu;$('retry-btn').onclick=resetRace;
addEventListener('keydown',e=>{
  const key=e.key.toLowerCase();if(['arrowleft','arrowright',' ','spacebar','f','p','escape'].includes(key))e.preventDefault();
  keys.add(key);
  if((key===' '||key==='spacebar')&&!e.repeat&&mode==='racing')jumpQueued=true;
  if((key==='p'||key==='escape')&&!e.repeat){if(mode==='paused')resume();else pause()}
  if(key==='f'&&!e.repeat){if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen?.()}
});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
addEventListener('blur',()=>{keys.clear();joystickX=0;if(mode==='racing')pause()});
function setStick(e){const rect=$('joystick').getBoundingClientRect();const cx=rect.left+rect.width/2;const radius=rect.width*.32;joystickX=clamp((e.clientX-cx)/radius,-1,1);$('joystick-knob').style.left=`calc(50% + ${joystickX*radius}px)`}
$('joystick').addEventListener('pointerdown',e=>{e.preventDefault();joystickPointer=e.pointerId;$('joystick').setPointerCapture(e.pointerId);setStick(e)});
$('joystick').addEventListener('pointermove',e=>{if(e.pointerId===joystickPointer)setStick(e)});
const releaseStick=e=>{if(e.pointerId!==joystickPointer)return;joystickPointer=null;joystickX=0;$('joystick-knob').style.left='50%'};
$('joystick').addEventListener('pointerup',releaseStick);$('joystick').addEventListener('pointercancel',releaseStick);
$('jump-btn').addEventListener('pointerdown',e=>{e.preventDefault();if(mode==='racing')jumpQueued=true});
for(const event of ['touchmove','gesturestart'])document.addEventListener(event,e=>{if(mode==='racing'||mode==='countdown')e.preventDefault()},{passive:false});

$('controls').classList.toggle('right-handed',save.handedness==='right');
refreshMenu();syncSettings();updateQuality();
player=createRacer(0,true);racers=[player];
const first=course.main.at(8);camera.position.copy(first.p).addScaledVector(first.tan,-23).add(new THREE.Vector3(0,13,0));camera.lookAt(first.p);
requestAnimationFrame(frame);
