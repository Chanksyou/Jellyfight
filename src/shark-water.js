// A shallow sheet: analytic ripple normals, Fresnel and foam in one draw.
// No mirror camera, scene copy, fluid simulation or extra light.
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
      void main(){
        #include <logdepthbuf_fragment>
        vec2 p=vWorld.xz,local=(p-uCenter)/uExtent;
        float edge=mix(max(abs(local.x),abs(local.y)),length(local),uCircular);
        float spread=1.0-smoothstep(uFill*uReach-.025,uFill*uReach,distance(p,uSource));
        if(uFill<.001||spread<.001)discard;
        float a=dot(p,vec2(47.,31.))-uTime*1.5,b=dot(p,vec2(-71.,53.))+uTime*1.1;
        vec2 slope=vec2(47.,31.)*cos(a)*.0007+vec2(-71.,53.)*cos(b)*.0004;
        vec2 wake=p-uPlayer;float d=length(wake);
        slope+=wake/max(d,.001)*cos(d*145.-uTime*7.)*exp(-d*13.)*uWake*.045;
        vec3 n=normalize(vec3(-slope.x,1.,-slope.y)),view=normalize(cameraPosition-vWorld);
        float fresnel=pow(1.-max(dot(n,view),0.),4.);
        float spec=pow(max(dot(reflect(-normalize(vec3(-.5,1.,.3)),n),view),0.),48.);
        float eddy=.5+.5*sin(a*.55+sin(b*.65));
        vec3 clear=uClear+vec3(.10,.13,.14)*fresnel;
        vec3 mud=mix(uDeep,uShallow,.18+eddy*.18);
        vec3 col=mix(clear,mud,uMurky);
        float ripple=pow(.5+.5*sin(a+sin(b)*.7),12.);
        float wakeRing=pow(.5+.5*sin(d*145.-uTime*7.),12.)*exp(-d*13.)*uWake;
        col+=uFoam*(ripple*.025+wakeRing*.045);
        float rim=smoothstep(.89,.99,edge),foam=rim*(.25+.75*pow(.5+.5*sin(a+b),4.));
        col+=uFoam*(spec*uGlint+foam*.13);
        // Sparse pale bubbles in the murk; the fish remain the brightest moving shapes.
        vec2 cells=fract(local*7.+vec2(uTime*.025,-uTime*.018))-.5;
        float bubble=(1.-smoothstep(.035,.065,abs(length(cells)-.12)))*.045*uMurky;
        col+=uFoam*bubble;
        float alpha=mix(.28+fresnel*.13,.70,uMurky)*spread;
        if(abs(vUp)<.5){col*=.8;alpha*=.8;}
        gl_FragColor=vec4(col,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:true,
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
  });
  return shared;
}
