// A shallow sheet in one draw: four analytic wave trains for the normals, Schlick Fresnel over a fake
// reflected room, two-lobe glints, procedural caustics on the quilt beneath, crest/rim/flood-front foam.
// No mirror camera, scene copy, texture, fluid simulation or extra light: only fragment math.
import * as THREE from 'three';
import { LOOK } from './look.js';

let shared=null;
export function sharkWaterMaterial(){
  if(shared)return shared;
  shared=new THREE.ShaderMaterial({
    uniforms:{
      uTime:{value:0},uFill:{value:0},uReach:{value:1},uMurky:{value:0},uCircular:{value:0},
      uCenter:{value:new THREE.Vector2()},uExtent:{value:new THREE.Vector2(1,1)},uSource:{value:new THREE.Vector2()},
      uPlayer:{value:new THREE.Vector2(1000,1000)},uWake:{value:0},
      uClear:{value:new THREE.Color(LOOK.color('shark-water','#304c51'))},
      uDeep:{value:new THREE.Color(LOOK.color('shark-pool-deep','#30281d'))},
      uShallow:{value:new THREE.Color(LOOK.color('shark-pool-shallow','#796644'))},
      uFoam:{value:new THREE.Color(LOOK.color('shark-water-foam','#b1bca4'))},
      uGlint:{value:LOOK.num('shark-water-glint',.16)},
    },
    vertexShader:`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vWorld; varying float vUp;
      void main(){
        vec4 w=modelMatrix*vec4(position,1.0);vWorld=w.xyz;vUp=normal.y;
        gl_Position=projectionMatrix*viewMatrix*w;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader:`
      #include <logdepthbuf_pars_fragment>
      uniform float uTime,uFill,uReach,uMurky,uCircular,uWake,uGlint;
      uniform vec2 uCenter,uExtent,uSource,uPlayer;
      uniform vec3 uClear,uDeep,uShallow,uFoam;
      varying vec3 vWorld;varying float vUp;
      // one directional wave: adds its slope (sharpened toward the crest, Gerstner-like) and returns its height
      float wave(vec2 p,vec2 dir,float k,float speed,float amp,inout vec2 slope){
        float ph=dot(p,dir)*k-uTime*speed,s=.5+.5*sin(ph);
        slope+=dir*k*amp*cos(ph)*(.4+1.2*s);return s;
      }
      // procedural caustics, no texture: three folds of the classic "tileable water caustic"
      // (Shadertoy MdlXz8), the light the ripples focus onto the quilt under the sheet
      float caustic(vec2 p,float t){
        vec2 i=p;float c=1.;
        for(int n=0;n<3;n++){
          float tt=t*(1.-(3.5/float(n+1)));
          i=p+vec2(cos(tt-i.x)+sin(tt+i.y),sin(tt-i.y)+cos(tt+i.x));
          c+=1./length(vec2(p.x/(sin(i.x+tt)/.005),p.y/(cos(i.y+tt)/.005)));
        }
        c=1.17-pow(c/3.,1.4);return pow(abs(c),8.);
      }
      void main(){
        #include <logdepthbuf_fragment>
        vec2 p=vWorld.xz,local=(p-uCenter)/uExtent;
        float rad=length(local);
        float edge=mix(max(abs(local.x),abs(local.y)),rad,uCircular);
        float front=uFill*uReach,dist=distance(p,uSource);
        float spread=1.-smoothstep(front-.025,front,dist);
        if(uFill<.001||spread<.001)discard;
        // four crossing wave trains, long to short: a richer surface than two, still a few sines
        vec2 slope=vec2(0.);
        float h=wave(p,vec2(.83,.55),57.,1.5,.0016,slope)+wave(p,vec2(-.80,.60),89.,1.1,.0011,slope)
               +wave(p,vec2(.20,-.98),131.,2.3,.0006,slope)+wave(p,vec2(-.45,-.89),197.,3.1,.0004,slope);
        vec2 wake=p-uPlayer;float d=length(wake);
        slope+=wake/max(d,.001)*cos(d*145.-uTime*7.)*exp(-d*13.)*uWake*.045;
        // feeding-frenzy pools (uMurky > 0): deep abyssal ocean vortex, organic swirling crimson/coral
        // chum currents, domain-warped froth streaks, and a sharp pulsing danger rim
        float swirlArms=0.,frenzyRim=0.,froth=0.;
        if(uMurky>.01){
          float ang=atan(local.y,local.x);
          float spin=ang-uTime*(2.9+1.7/(rad+.20))+log(rad+.07)*4.2;
          float warp=sin(rad*14.-uTime*4.2)*1.1+cos(ang*3.+uTime*2.1)*.6;
          swirlArms=smoothstep(.25,1.,.5+.5*sin(spin*3.+warp))*smoothstep(1.,.14,rad);
          float veins=smoothstep(.66,1.,.5+.5*sin(spin*7.-warp*1.3+rad*10.));
          swirlArms=clamp(swirlArms*.65+veins*.6,0.,1.);
          // swirling surface froth ribbons (no regular grid)
          froth=smoothstep(.76,1.,.5+.5*sin(spin*5.+rad*16.-uTime*5.5))*smoothstep(.96,.25,rad);
          // radial churn ripples pushing outward from the vortex
          float pulse=.5+.5*sin(rad*16.-uTime*7.0);
          slope+=normalize(local+vec2(1e-4))*cos(rad*16.-uTime*7.0)*.055*uMurky;
          // sharp foaming danger ring around the exact hazard perimeter
          float rimWave=.5+.5*sin(ang*7.+uTime*5.5);
          frenzyRim=smoothstep(.82,.97,rad)*smoothstep(1.02,.95,rad)*(.6+.4*rimWave+.2*pulse);
        }
        vec3 n=normalize(vec3(-slope.x,1.,-slope.y)),view=normalize(cameraPosition-vWorld);
        // Schlick Fresnel: looking down you see into it, at a glance it mirrors the room
        float fresnel=.02+.98*pow(1.-max(dot(n,view),0.),5.);
        vec3 reflected=reflect(-view,n);
        // a fake room to reflect: dim walls toward the horizon, the warm ceiling lamp band above
        vec3 room=mix(uClear*.6,uFoam*.55,smoothstep(-.1,.8,reflected.y))+uFoam*pow(max(0.,sin(reflected.x*6.+reflected.z*4.)),16.)*.35;
        vec3 sun=normalize(vec3(-.5,1.,.3));
        float spec=pow(max(dot(reflect(-sun,n),view),0.),90.)*1.6+pow(max(dot(reflect(-sun,n),view),0.),18.)*.18;
        float eddy=.5+.5*sin(h*1.7+sin(dot(p,vec2(-71.,53.))*.65+uTime));
        // under the sheet: the quilt lit by moving caustics (the clear bed water); pools churn deep abyssal-indigo to crimson
        float lightLines=caustic(p*70.+slope*500.,uTime*.9);
        vec3 under=uClear*(.85+.3*eddy)+uFoam*lightLines*.5;
        vec3 poolCore=mix(uDeep,uShallow,clamp(.12+swirlArms*.72+rad*.18,0.,1.));
        poolCore=mix(poolCore,uDeep*.35,smoothstep(.42,0.,rad));   // dark abyssal vortex eye
        poolCore+=uShallow*lightLines*.22+mix(uFoam,uShallow,.55)*froth*.45;
        vec3 body=mix(under,poolCore,uMurky);
        vec3 col=mix(body,room,fresnel*(1.-uMurky*.82));
        float crest=smoothstep(2.6,3.4,h);   // where the wave trains pile up: a little white water
        float wakeRing=pow(.5+.5*sin(d*145.-uTime*7.),12.)*exp(-d*13.)*uWake;
        float rim=smoothstep(.89,.99,edge),foam=rim*(.25+.75*pow(.5+.5*sin(h*2.1),4.));
        // the spreading edge as the bed floods: a bright foam line that thins out once it's full
        float lip=(1.-smoothstep(0.,.03,abs(dist-front+.012)))*(1.-smoothstep(.85,1.,uFill));
        col+=uFoam*(crest*.05+wakeRing*.05+foam*.14+lip*.35)+uFoam*spec*uGlint;
        col+=mix(uShallow,uFoam,.35)*frenzyRim*.95*uMurky;
        float alpha=mix(.30+fresnel*.45,.90*smoothstep(1.02,.88,rad)+frenzyRim*.22,uMurky)*spread+lip*.2;
        if(abs(vUp)<.5){col*=.8;alpha*=.8;}
        gl_FragColor=vec4(col,clamp(alpha,0.,1.));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:true,
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
  });
  return shared;
}
