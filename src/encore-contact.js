// Static stage electricity: geometry decides contact; a bounded effect reports confirmed hits.
import * as THREE from 'three';
import { ExtendedTriangle } from 'three-mesh-bvh';
import { LOOK } from './look.js';

export const CONTACT_DMG=4,CONTACT_GAP=1;
export class EncoreContact {
  constructor(scene,solids,{onShock=()=>{}}={}){
    this.onShock=onShock;this.cooldown=0;this.life=0;this.triangles=[];
    this.line=new THREE.Line3();this.point=new THREE.Vector3();this.onBody=new THREE.Vector3();this.center=new THREE.Vector3();this.hitPoint=new THREE.Vector3();
    for(const m of solids){m.updateWorldMatrix(true,false);const p=m.geometry.attributes.position,idx=m.geometry.index;
      for(let i=0;i<(idx?.count??p.count);i+=3){const t=new ExtendedTriangle();for(let k=0;k<3;k++)[t.a,t.b,t.c][k].fromBufferAttribute(p,idx?idx.getX(i+k):i+k).applyMatrix4(m.matrixWorld);t.needsUpdate=true;this.triangles.push(t);}}
    this.color=LOOK.color('encore-contact','#ffb52e');
    this.duration=LOOK.num('encore-contact-life',.32);
    this.root=new THREE.Group();this.root.name='Encore contact electricity';scene.add(this.root);
    this.positions=new THREE.Float32BufferAttribute(new Float32Array(4*5*2*3),3);this.positions.setUsage(THREE.DynamicDrawUsage);
    this.geometry=new THREE.BufferGeometry();this.geometry.setAttribute('position',this.positions);
    this.material=new THREE.LineBasicMaterial({color:this.color,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
    this.bolts=new THREE.LineSegments(this.geometry,this.material);this.bolts.frustumCulled=false;this.root.add(this.bolts);
    this.flashGeometry=new THREE.IcosahedronGeometry(1,1);this.flashMaterial=new THREE.MeshBasicMaterial({color:this.color,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
    this.flash=new THREE.Mesh(this.flashGeometry,this.flashMaterial);this.root.add(this.flash);
    // Constant thin warning traces make the energized surface readable before touching it.
    this.edgeGeometry=new THREE.BufferGeometry();const edges=[];
    for(const m of solids){const g=new THREE.EdgesGeometry(m.geometry,25);g.applyMatrix4(m.matrixWorld);edges.push(...g.attributes.position.array);g.dispose();}
    this.edgeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(edges,3));
    this.warning=LOOK.num('encore-contact-warning',.36);
    this.edgeMaterial=new THREE.LineBasicMaterial({color:this.color,transparent:true,opacity:this.warning,depthWrite:false,toneMapped:false});
    this.edges=new THREE.LineSegments(this.edgeGeometry,this.edgeMaterial);this.root.add(this.edges);
    this.root.traverse(o=>{o.userData.noCollide=true;});
  }
  // The same body radius/height as movement, tested against the actual closed hull triangles.
  touching(player){
    const p=player.position,c=player.cfg,r=Math.min(c.radius,c.height/2);
    this.line.start.set(p.x,p.y+r,p.z);this.line.end.set(p.x,p.y+c.height-r,p.z);
    let distance=Infinity;
    for(const t of this.triangles){const d=t.closestPointToSegment(this.line,this.point,this.onBody);if(d<distance){distance=d;this.hitPoint.copy(this.point);}}
    return distance<=r+.003;
  }
  update(dt,player,active=true,quiet=false){
    this.cooldown=Math.max(0,this.cooldown-dt);this.life=Math.max(0,this.life-dt);
    let hit=false;
    if(active&&this.cooldown===0&&this.touching(player)){this.cooldown=CONTACT_GAP;this.life=this.duration;this.onShock(CONTACT_DMG,this.hitPoint);hit=true;}
    const fade=this.life/this.duration;
    this.edgeMaterial.opacity=this.warning+fade*(quiet?.12:.5);
    this.material.opacity=fade*(quiet?.55:1);this.flashMaterial.opacity=fade*(quiet?.06:.16);
    if(this.life>0){
      const p=player.position,c=player.cfg;this.center.set(p.x,p.y+c.height*.55,p.z);this.flash.position.copy(this.center);this.flash.scale.set(c.radius*1.2,c.height*.6,c.radius*1.2);
      for(let branch=0;branch<4;branch++)for(let k=0;k<5;k++)for(let end=0;end<2;end++){
        const u=(k+end)/5,a=branch*Math.PI/2,w=Math.sin(u*Math.PI)*(quiet?.002:.008),j=(k+end)%2?1:-1;
        const i=(branch*10+k*2+end),sx=branch?this.center.x+Math.cos(a)*c.radius:this.hitPoint.x,sz=branch?this.center.z+Math.sin(a)*c.radius:this.hitPoint.z;
        this.positions.setXYZ(i,THREE.MathUtils.lerp(sx,branch?sx:this.center.x,u)+Math.cos(a)*w*j,branch?p.y+c.height*(.9-u*.8):THREE.MathUtils.lerp(this.hitPoint.y,this.center.y,u)+Math.sin(a)*w*j,THREE.MathUtils.lerp(sz,branch?sz:this.center.z,u)+w*j*.5);
      }this.positions.needsUpdate=true;
    }
    return hit;
  }
  reset(){this.cooldown=this.life=0;this.material.opacity=this.flashMaterial.opacity=0;this.edgeMaterial.opacity=this.warning;}
  dispose(){this.root.removeFromParent();for(const r of [this.geometry,this.material,this.flashGeometry,this.flashMaterial,this.edgeGeometry,this.edgeMaterial])r.dispose();}
}
