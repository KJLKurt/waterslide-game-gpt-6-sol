import * as THREE from 'three';
import {acceleratedRaycast,computeBoundsTree} from 'three-mesh-bvh';

const V = (x,y,z) => new THREE.Vector3(x,y,z);
const mainWaypoints = [
  V(0,52,0),V(0,49,38),V(23,45,79),V(69,41,111),V(86,37,145),
  V(47,33,187),V(-8,29,207),V(-31,25,247),V(-12,20,286),
  V(47,16,309),V(70,12,350),V(30,8,390),V(-10,5,421)
];

export class SlideRoute {
  constructor(points,{width=12,bank=0.13,gaps=[],name='main'}={}){
    this.name=name;this.width=width;this.gaps=gaps;
    this.curve=new THREE.CatmullRomCurve3(points,false,'centripetal',.5);
    this.length=this.curve.getLength();this.count=Math.max(220,Math.ceil(this.length*1.5));
    this.samples=[];
    for(let i=0;i<=this.count;i++){
      const t=i/this.count,p=this.curve.getPointAt(t),tan=this.curve.getTangentAt(t).normalize();
      const right=V(tan.z,0,-tan.x).normalize();
      const flatUp=new THREE.Vector3().crossVectors(tan,right).normalize();
      const curveTurn=i>0&&i<this.count?this.curve.getTangentAt((i+1)/this.count).x-this.curve.getTangentAt((i-1)/this.count).x:0;
      const angle=Math.max(-.23,Math.min(.23,curveTurn*7))*bank/.13;
      const r=right.clone().multiplyScalar(Math.cos(angle)).addScaledVector(flatUp,Math.sin(angle));
      const up=flatUp.clone().multiplyScalar(Math.cos(angle)).addScaledVector(right,-Math.sin(angle));
      this.samples.push({p,tan,right:r,up,bank:angle});
    }
    this.floor=this.makeFloor();this.rails=this.makeRails();
  }
  at(s){
    const n=Math.max(0,Math.min(this.count,s/this.length*this.count)),i=Math.min(this.count-1,Math.floor(n)),a=n-i;
    const x=this.samples[i],y=this.samples[i+1];
    return {p:x.p.clone().lerp(y.p,a),tan:x.tan.clone().lerp(y.tan,a).normalize(),right:x.right.clone().lerp(y.right,a).normalize(),up:x.up.clone().lerp(y.up,a).normalize()};
  }
  isGap(s){return this.gaps.some(([a,b])=>s/this.length>=a&&s/this.length<=b)}
  surface(s,u){const f=this.at(s);return f.p.addScaledVector(f.right,u).addScaledVector(f.up,0.08+0.012*u*u)}
  makeFloor(){
    const positions=[],normals=[],indices=[],uv=[];let vertex=0;
    const divisions=8;
    for(let i=0;i<this.count;i++){
      if(this.isGap((i+.5)/this.count*this.length))continue;
      for(const k of [i,i+1]){
        const f=this.samples[k];
        for(let j=0;j<=divisions;j++){
          const u=(j/divisions-.5)*this.width;
          const p=f.p.clone().addScaledVector(f.right,u).addScaledVector(f.up,.08+.012*u*u);
          positions.push(p.x,p.y,p.z);normals.push(f.up.x,f.up.y,f.up.z);uv.push(j/divisions,k/this.count);
        }
      }
      for(let j=0;j<divisions;j++){
        const a=vertex+j,b=vertex+divisions+1+j;
        indices.push(a,b,a+1,b,b+1,a+1);
      }
      vertex+=(divisions+1)*2;
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
    const mat=new THREE.MeshStandardMaterial({color:this.name==='shortcut'?0xffbc75:0x25b9d8,roughness:.28,metalness:.1,side:THREE.DoubleSide});
    g.computeBoundsTree=computeBoundsTree;g.computeBoundsTree();
    const mesh=new THREE.Mesh(g,mat);mesh.raycast=acceleratedRaycast;mesh.receiveShadow=true;mesh.name=`${this.name}-floor`;return mesh;
  }
  makeRails(){
    const group=new THREE.Group();
    const railMat=new THREE.MeshStandardMaterial({color:this.name==='shortcut'?0xffdd9d:0xb2f7ff,roughness:.27,metalness:.06});
    for(const sign of [-1,1]){
      const points=[];
      for(let i=0;i<=this.count;i+=3){
        if(this.isGap(i/this.count*this.length)){if(points.length>2)this.addRailSegment(group,points,railMat);points.length=0;continue}
        const f=this.samples[i];points.push(f.p.clone().addScaledVector(f.right,sign*(this.width/2-.15)).addScaledVector(f.up,1.15));
      }
      if(points.length>2)this.addRailSegment(group,points,railMat);
    }
    return group;
  }
  addRailSegment(group,points,mat){const g=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.max(8,points.length*2),.28,5,false);group.add(new THREE.Mesh(g,mat))}
}

export function createCourse(scene){
  const main=new SlideRoute(mainWaypoints,{gaps:[[.602,.647]]});
  const start=.22*main.length,end=.45*main.length;
  const a=main.at(start),b=main.at(end),middle=a.p.clone().lerp(b.p,.52).add(V(0,3,0));
  const shortcut=new SlideRoute([
    a.p.clone().addScaledVector(a.right,3.8),
    a.p.clone().lerp(middle,.45).add(V(0,1,0)),
    middle,
    middle.clone().lerp(b.p,.55).add(V(0,-1,0)),
    b.p.clone().addScaledVector(b.right,1.5)
  ],{width:8,bank:.08,name:'shortcut',gaps:[[.46,.55]]});
  scene.add(main.floor,main.rails,shortcut.floor,shortcut.rails);
  const floorMeshes=[main.floor,shortcut.floor];
  const markerMat=new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide});
  const rampMat=new THREE.MeshStandardMaterial({color:0xffd47f,roughness:.36,side:THREE.DoubleSide});
  const mark=(route,fraction,color=markerMat,size=1.2)=>{
    const f=route.at(fraction*route.length);const mesh=new THREE.Mesh(new THREE.BoxGeometry(route.width-.8,.08,size),color);
    mesh.position.copy(route.surface(fraction*route.length,0)).addScaledVector(f.up,.08);
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.right,f.up,f.tan));scene.add(mesh);return mesh;
  };
  for(const f of [.18,.36,.56,.77,.93])mark(main,f,markerMat,.55);
  mark(main,.596,rampMat,2.8);mark(main,.75,rampMat,2.8);mark(shortcut,.445,rampMat,2.2);
  const finish=main.at(main.length*.987);
  for(let u=-main.width/2+1;u<main.width/2-1;u+=2){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(1.9,.09,1.4),new THREE.MeshBasicMaterial({color:(Math.round(u/2)%2===0)?0xffffff:0x0a4773}));
    mesh.position.copy(main.surface(main.length*.987,u)).addScaledVector(finish.up,.12);
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(finish.right,finish.up,finish.tan));scene.add(mesh);
  }
  const archMat=new THREE.MeshStandardMaterial({color:0xffe6a4,roughness:.4});
  for(const u of [-main.width/2,main.width/2]){
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,6,7),archMat);
    pole.position.copy(finish.p).addScaledVector(finish.right,u).addScaledVector(finish.up,3);scene.add(pole);
  }
  const arch=new THREE.Mesh(new THREE.BoxGeometry(main.width+1,.55,.55),archMat);
  arch.position.copy(finish.p).addScaledVector(finish.up,6);arch.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(finish.right,finish.up,finish.tan));scene.add(arch);
  return {main,shortcut,floorMeshes,branchStart:start,branchEnd:end};
}
