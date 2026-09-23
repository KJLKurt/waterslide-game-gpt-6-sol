import * as THREE from 'three';

export const PALETTES=[
  {name:'Coral',body:0xf66b5a,accent:0xffd37b},
  {name:'Lagoon',body:0x157fc8,accent:0xbaf5fa},
  {name:'Lime',body:0x82bd4a,accent:0xe9f897},
  {name:'Violet',body:0x9360c7,accent:0xffb7e2}
];
export const COSMETICS=['Goggles','Float ring','Swim cap','Visor'];
const geom={
  head:new THREE.SphereGeometry(.48,10,8),torso:new THREE.CapsuleGeometry(.5,.65,4,8),
  arm:new THREE.CapsuleGeometry(.16,.78,3,7),leg:new THREE.CapsuleGeometry(.19,.72,3,7),
  nose:new THREE.SphereGeometry(.13,7,6),eye:new THREE.SphereGeometry(.06,6,5),
  glass:new THREE.BoxGeometry(.42,.18,.09),strap:new THREE.BoxGeometry(.9,.09,.14),
  cap:new THREE.SphereGeometry(.5,10,7,0,Math.PI*2,0,Math.PI/2),
  ring:new THREE.TorusGeometry(.76,.2,7,16),visor:new THREE.BoxGeometry(1.02,.1,.38)
};
const skin=new THREE.MeshStandardMaterial({color:0xffc697,roughness:.72});
const dark=new THREE.MeshStandardMaterial({color:0x143b56,roughness:.4});
const glass=new THREE.MeshStandardMaterial({color:0x3b8fc2,roughness:.18,metalness:.15});
const mats=PALETTES.map(p=>({body:new THREE.MeshStandardMaterial({color:p.body,roughness:.48}),accent:new THREE.MeshStandardMaterial({color:p.accent,roughness:.46})}));
const part=(parent,g,m,x,y,z)=>{const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh};

export function makeRacerVisual(paletteIndex=0,accessoryIndex=0){
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const m=mats[paletteIndex%4];
  const torso=part(body,geom.torso,m.body,0,1.65,0);torso.scale.set(1,.85,.68);
  const head=part(body,geom.head,skin,0,2.75,.17);
  part(body,geom.nose,skin,0,2.69,.62);
  for(const side of [-1,1]){
    part(body,geom.eye,dark,side*.19,2.84,.59);
  }
  const arms=[],legs=[];
  for(const side of [-1,1]){
    const armPivot=new THREE.Group();armPivot.position.set(side*.57,2.12,.03);body.add(armPivot);
    const arm=part(armPivot,geom.arm,skin,side*.16,-.49,.05);arm.rotation.z=side*.18;arms.push(armPivot);
    const legPivot=new THREE.Group();legPivot.position.set(side*.27,1.1,0);body.add(legPivot);
    part(legPivot,geom.leg,m.accent,0,-.43,0);legs.push(legPivot);
  }
  if(accessoryIndex===0){
    part(body,geom.strap,dark,0,2.89,.26);
    for(const side of [-1,1])part(body,geom.glass,glass,side*.22,2.88,.57);
  }else if(accessoryIndex===1){
    const ring=part(body,geom.ring,m.accent,0,1.28,0);ring.rotation.x=Math.PI/2;
  }else if(accessoryIndex===2){
    part(body,geom.cap,m.accent,0,2.89,.16);
  }else{
    part(body,geom.cap,m.accent,0,2.89,.16);
    part(body,geom.visor,m.accent,0,3.04,.53);
  }
  return {root,body,arms,legs,animate(time,lean,airborne,speed){
    const b=Math.sin(time*10+paletteIndex)*.06*(.5+speed/35);
    body.position.y=airborne?.2:b;
    body.rotation.z=THREE.MathUtils.lerp(body.rotation.z,-lean*.2,.18);
    body.rotation.x=THREE.MathUtils.lerp(body.rotation.x,airborne?-.26:.12,.16);
    arms[0].rotation.z=THREE.MathUtils.lerp(arms[0].rotation.z,airborne?.85:.38+lean*.12,.15);
    arms[1].rotation.z=THREE.MathUtils.lerp(arms[1].rotation.z,airborne?-.85:-.38+lean*.12,.15);
    arms[0].rotation.x=arms[1].rotation.x=airborne?-.5:0;
    legs[0].rotation.x=airborne?.28:Math.sin(time*8)*.06;
    legs[1].rotation.x=airborne?-.28:-Math.sin(time*8)*.06;
  }};
}
