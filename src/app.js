// ================= app =================
const $=id=>document.getElementById(id);
const store={get(k,d){try{const v=localStorage.getItem('rfc.'+k);return v===null?d:JSON.parse(v);}catch(e){return d;}},set(k,v){try{localStorage.setItem('rfc.'+k,JSON.stringify(v));}catch(e){}}};
const IS_TOUCH=!!(window.matchMedia&&matchMedia('(pointer: coarse)').matches);
const G={mode:'menu',S:null,demo:null,paused:false,acc:0,autoCam:store.get('autoCam',IS_TOUCH),sound:store.get('sound',true),hq:store.get('hq',true),
  name:store.get('name',''),myIdx:-1,lastPhase:'',lastGoalSeq:-1,lastTouchSeq:-1,goTimer:0,shake:0,time:0,perfectT:0,touchUsed:IS_TOUCH};
const hasThree=typeof THREE!=='undefined';
const KIT=[{main:0x4f7cff,trim:0x1d2e6e,shorts:0xf2f5fb,socks:0x2e4fb8,ring:0x6f95ff},{main:0xff6b57,trim:0x6e1f16,shorts:0x1d2438,socks:0xc94a3a,ring:0xff8a7a}];
let helpBack='sc-main';
function show(id){
  if(id==='sc-help')helpBack=G.mode==='menu'?'sc-main':G.mode==='lobby'?'sc-lobby':'sc-pause';
  if(id!=='sc-none')try{document.exitPointerLock();}catch(_){}
  document.querySelectorAll('.screen').forEach(s=>s.hidden=s.id!==id);
}
function hideScreens(){document.querySelectorAll('.screen').forEach(s=>s.hidden=true);}
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>{ensureAudio();show(b.dataset.go);}));
$('helpBack').onclick=()=>show(helpBack);
const nameIn=$('nameIn');nameIn.value=G.name;
nameIn.addEventListener('input',()=>{G.name=nameIn.value.trim().slice(0,12);store.set('name',G.name);});
function myName(){return (G.name||'Player').slice(0,12);}
function cleanName(n){return typeof n==='string'?n.replace(/[^\p{L}\p{N} _.\-]/gu,'').trim().slice(0,12)||'Player':'Player';}

// ================= scene =================
let renderer,scene,camera,ballMesh,ballShadow,parts,crowd=null;
const rigs=[];let rigKey='';
function initScene(){
  renderer=new THREE.WebGLRenderer({canvas:$('c'),antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,G.hq?2:1.25));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
  scene=new THREE.Scene();scene.fog=new THREE.Fog(0x2a3354,140,420);
  camera=new THREE.PerspectiveCamera(62,1,0.05,1200);
  const sky=makeSky(600);scene.add(sky);
  try{const pm=new THREE.PMREMGenerator(renderer);const es=new THREE.Scene();es.add(makeSky(50));
    es.add(new THREE.HemisphereLight(0xffffff,0x334422,1));scene.environment=pm.fromScene(es,0.04).texture;}catch(e){}
  scene.add(new THREE.HemisphereLight(0xc9d8ff,0x2b3a25,0.55));
  const sun=new THREE.DirectionalLight(0xffe6cc,1.35);sun.position.set(-55,85,-35);sun.castShadow=true;
  sun.shadow.mapSize.set(G.hq?2048:1024,G.hq?2048:1024);Object.assign(sun.shadow.camera,{left:-60,right:60,top:72,bottom:-72,near:20,far:260});sun.shadow.bias=-0.0004;sun.shadow.normalBias=0.02;
  scene.add(sun);
  const fill=new THREE.DirectionalLight(0x9fb8ff,0.35);fill.position.set(60,40,50);scene.add(fill);
  buildArena();
  ballMesh=new THREE.Mesh(new THREE.SphereGeometry(F.R,32,24),new THREE.MeshStandardMaterial({map:ballTexture(),roughness:.42,metalness:0}));
  ballMesh.castShadow=true;scene.add(ballMesh);
  ballShadow=new THREE.Mesh(new THREE.CircleGeometry(F.R*1.1,24),new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.3,depthWrite:false}));
  ballShadow.rotation.x=-Math.PI/2;ballShadow.position.y=0.012;scene.add(ballShadow);
  parts=makeParticles();onResize();
  loadPlayerModel();
}
function makeSky(r){
  const mat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
    uniforms:{top:{value:new THREE.Color(0x0e1a36)},mid:{value:new THREE.Color(0x35507f)},hor:{value:new THREE.Color(0xf0a77a)},low:{value:new THREE.Color(0x232a3f)}},
    vertexShader:'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'uniform vec3 top;uniform vec3 mid;uniform vec3 hor;uniform vec3 low;varying vec3 vP;void main(){float h=vP.y;vec3 c=mix(mid,top,smoothstep(0.08,0.65,h));c=mix(hor,c,smoothstep(-0.02,0.16,h));c=mix(low,c,smoothstep(-0.2,-0.01,h));gl_FragColor=vec4(c,1.0);}'});
  const m=new THREE.Mesh(new THREE.SphereGeometry(r,32,16),mat);m.renderOrder=-1;return m;
}
function canvasTex(w,h,draw,srgb){const cv=document.createElement('canvas');cv.width=w;cv.height=h;draw(cv.getContext('2d'),w,h);const t=new THREE.CanvasTexture(cv);if(srgb!==false)t.encoding=THREE.sRGBEncoding;t.anisotropy=8;return t;}
function ballTexture(){
  return canvasTex(1024,512,(g,W,H)=>{
    g.fillStyle='#f3f5f9';g.fillRect(0,0,W,H);
    const t=(1+Math.sqrt(5))/2,V=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]];
    for(const v of V){const l=Math.hypot(...v),x=v[0]/l,y=v[1]/l,z=v[2]/l;const lat=Math.asin(y),lon=Math.atan2(x,z);
      const cx=(lon/(2*Math.PI)+0.5)*W,cy=(0.5-lat/Math.PI)*H,sx=Math.min(4,1/Math.max(0.2,Math.cos(lat)));
      for(const off of [-W,0,W]){g.beginPath();for(let k=0;k<5;k++){const a=k/5*Math.PI*2-Math.PI/2;g.lineTo(cx+off+Math.cos(a)*44*sx,cy+Math.sin(a)*44);}g.closePath();g.fillStyle='#1b2236';g.fill();}}
    g.strokeStyle='rgba(30,36,54,.35)';g.lineWidth=3;for(let i=0;i<16;i++){g.beginPath();g.moveTo(i*W/16,0);g.lineTo(i*W/16+30,H);g.stroke();}
    g.fillStyle='#ff6b57';g.fillRect(0,H*0.48,W,H*0.04);
  });
}
function pitchTexture(){
  const W=1200,H=1880,sx=W/(F.HW*2),sz=H/(F.HL*2);
  return canvasTex(W,H,(g)=>{
    for(let i=0;i<16;i++){g.fillStyle=i%2?'#2c7a4c':'#318552';g.fillRect(0,i*H/16,W,H/16+1);}
    for(let i=0;i<26000;i++){const x=Math.random()*W,y=Math.random()*H,l=Math.random();g.fillStyle=l<0.5?'rgba(20,70,40,.25)':'rgba(120,190,110,.18)';g.fillRect(x,y,2,3+Math.random()*4);}
    const X=x=>W/2+x*sx,Z=z=>H/2+z*sz,lw=Math.max(3,0.12*sx);
    g.strokeStyle='rgba(246,248,251,.92)';g.lineWidth=lw;
    g.strokeRect(lw,lw,W-2*lw,H-2*lw);
    g.beginPath();g.moveTo(0,H/2);g.lineTo(W,H/2);g.stroke();
    g.beginPath();g.arc(W/2,H/2,9.15*sx,0,Math.PI*2);g.stroke();
    g.fillStyle='rgba(246,248,251,.95)';g.beginPath();g.arc(W/2,H/2,0.35*sx,0,Math.PI*2);g.fill();
    for(const s of [-1,1]){
      const gz=s*F.HL,inZ=gz-s*F.BOXD;
      g.fillStyle=s<0?'rgba(79,124,255,.12)':'rgba(255,107,87,.11)';
      g.fillRect(X(-F.BOXW/2),Math.min(Z(gz),Z(inZ)),F.BOXW*sx,F.BOXD*sz);
      g.beginPath();g.moveTo(X(-F.BOXW/2),Z(gz));g.lineTo(X(-F.BOXW/2),Z(inZ));g.lineTo(X(F.BOXW/2),Z(inZ));g.lineTo(X(F.BOXW/2),Z(gz));g.stroke();
      const sm=gz-s*5;g.beginPath();g.moveTo(X(-9),Z(gz));g.lineTo(X(-9),Z(sm));g.lineTo(X(9),Z(sm));g.lineTo(X(9),Z(gz));g.stroke();
      g.beginPath();g.arc(X(0),Z(gz-s*10),0.3*sx,0,Math.PI*2);g.fill();
      g.beginPath();if(s<0)g.arc(X(0),Z(gz-s*10),8*sx,0.22*Math.PI,0.78*Math.PI);else g.arc(X(0),Z(gz-s*10),8*sx,1.22*Math.PI,1.78*Math.PI);g.stroke();
    }
    for(const cx of [0,W])for(const cy of [0,H]){g.beginPath();g.arc(cx,cy,1*sx,0,Math.PI*2);g.stroke();}
  });
}
function grassDetail(){
  const t=canvasTex(256,256,(g,W,H)=>{for(let i=0;i<3200;i++){const x=Math.random()*W,y=Math.random()*H,a=(Math.random()-.5)*0.6;
    g.strokeStyle=Math.random()<0.5?'rgba(10,50,25,.35)':'rgba(170,230,150,.22)';g.lineWidth=1;g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.sin(a)*5,y-6);g.stroke();}});
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(F.HW*2/1.5,F.HL*2/1.5);return t;
}
function adTexture(){
  const names=['REBOUND FC','STREET CUP','VOLTA KICK','NOVA','PITCHSIDE','TOP BINS','NUTMEG','FIVE A SIDE'];
  const cols=['#4f7cff','#ff6b57','#1d2438','#d6ff3d','#f6f8fb','#2f8857','#ffd166','#7a5cff'];
  const t=canvasTex(2048,128,(g,W,H)=>{const n=names.length,w=W/n;for(let i=0;i<n;i++){g.fillStyle=cols[i];g.fillRect(i*w,0,w,H);
    g.fillStyle=['#1d2438','#d6ff3d','#f6f8fb'].includes(cols[i])?(cols[i]==='#f6f8fb'||cols[i]==='#d6ff3d'?'#1d2438':'#f6f8fb'):'#f6f8fb';
    g.font='800 74px "Saira Condensed","Arial Narrow",sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(names[i],i*w+w/2,H/2+4);}});
  t.wrapS=THREE.RepeatWrapping;return t;
}
function windowTexture(){
  const t=canvasTex(128,256,(g,W,H)=>{g.fillStyle='#000';g.fillRect(0,0,W,H);for(let y=6;y<H;y+=10)for(let x=6;x<W;x+=10){if(Math.random()<0.38){const c=Math.random();g.fillStyle=c<0.6?'rgba(255,214,150,.95)':c<0.85?'rgba(170,200,255,.9)':'rgba(255,255,255,.9)';g.fillRect(x,y,5,6);}}});
  return t;
}
function glowTexture(){return canvasTex(128,128,(g,W)=>{const gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(255,248,225,1)');gr.addColorStop(0.25,'rgba(255,236,190,.55)');gr.addColorStop(1,'rgba(255,230,180,0)');g.fillStyle=gr;g.fillRect(0,0,W,W);});}
function netLines(corners,nu,nv,sag){
  const [a,b,c,d]=corners,pts=[];const P=(u,v)=>{const x=a[0]+(b[0]-a[0])*u+(d[0]-a[0])*v+(a[0]-b[0]+c[0]-d[0])*u*v,y=a[1]+(b[1]-a[1])*u+(d[1]-a[1])*v+(a[1]-b[1]+c[1]-d[1])*u*v,z=a[2]+(b[2]-a[2])*u+(d[2]-a[2])*v+(a[2]-b[2]+c[2]-d[2])*u*v;
    const s=Math.sin(Math.PI*u)*Math.sin(Math.PI*v)*sag;return new THREE.Vector3(x,y-s*0.3,z+s*(z>0?1:-1));};
  for(let i=0;i<=nu;i++)for(let j=0;j<nv;j++){pts.push(P(i/nu,j/nv),P(i/nu,(j+1)/nv));}
  for(let j=0;j<=nv;j++)for(let i=0;i<nu;i++){pts.push(P(i/nu,j/nv),P((i+1)/nu,j/nv));}
  return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xe9eef6,transparent:true,opacity:.45}));
}
function buildArena(){
  const std=(c,r,m)=>new THREE.MeshStandardMaterial({color:c,roughness:r===undefined?0.8:r,metalness:m||0});
  const pitch=new THREE.Mesh(new THREE.PlaneGeometry(F.HW*2,F.HL*2),new THREE.MeshStandardMaterial({map:pitchTexture(),roughness:.95}));
  pitch.rotation.x=-Math.PI/2;pitch.receiveShadow=true;scene.add(pitch);
  const det=new THREE.Mesh(new THREE.PlaneGeometry(F.HW*2,F.HL*2),new THREE.MeshStandardMaterial({map:grassDetail(),transparent:true,depthWrite:false,roughness:1}));
  det.rotation.x=-Math.PI/2;det.position.y=0.004;det.receiveShadow=true;scene.add(det);
  const apron=new THREE.Mesh(new THREE.PlaneGeometry(F.HW*2+60,F.HL*2+60),std(0x2a3142,.95));apron.rotation.x=-Math.PI/2;apron.position.y=-0.02;apron.receiveShadow=true;scene.add(apron);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(2400,2400),std(0x161c2b,1));ground.rotation.x=-Math.PI/2;ground.position.y=-0.05;scene.add(ground);
  // rebound walls: ad boards with glass above
  const ad=adTexture(),boardFront=new THREE.MeshStandardMaterial({map:ad,roughness:.55,emissive:0xffffff,emissiveMap:ad,emissiveIntensity:.18}),boardM=std(0x1b2232,.7);
  const glass=new THREE.MeshStandardMaterial({color:0xbcd2ff,transparent:true,opacity:.08,roughness:.05,metalness:.2,side:THREE.DoubleSide,depthWrite:false});
  const metal=std(0x3a465e,.4,.6),GH=7.5;
  const wall=(len,x,z,ry,from)=>{
    const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=ry;scene.add(g);
    const bm=ad.clone();bm.needsUpdate=true;bm.repeat.set(len/26,1);bm.offset.x=Math.random();
    const front=boardFront.clone();front.map=bm;front.emissiveMap=bm;
    const b=new THREE.Mesh(new THREE.BoxGeometry(len,1.15,0.18),[boardM,boardM,boardM,boardM,front,boardM]);b.position.y=0.575;b.castShadow=true;b.receiveShadow=true;g.add(b);
    const gl=new THREE.Mesh(new THREE.PlaneGeometry(len,GH-(from||1.15)),glass);gl.position.y=(from||1.15)+(GH-(from||1.15))/2;g.add(gl);
    for(let s=-len/2;s<=len/2+0.01;s+=6){const post=new THREE.Mesh(new THREE.BoxGeometry(0.09,GH,0.09),metal);post.position.set(s,GH/2,0);g.add(post);}
    const rail=new THREE.Mesh(new THREE.BoxGeometry(len,0.12,0.14),metal);rail.position.y=GH;g.add(rail);
  };
  wall(F.HL*2,F.HW+0.09,0,-Math.PI/2);wall(F.HL*2,-F.HW-0.09,0,Math.PI/2);
  const side=F.HW-F.GW/2;
  for(const s of [-1,1]){const z=s*(F.HL+0.09),ry=s<0?0:Math.PI;
    wall(side,F.GW/2+side/2,z,ry);wall(side,-(F.GW/2+side/2),z,ry);
    const top=new THREE.Mesh(new THREE.PlaneGeometry(F.GW,GH-F.GH),glass);top.position.set(0,F.GH+(GH-F.GH)/2,z);scene.add(top);}
  // stands with a crowd
  const concrete=std(0x2b3346,.9),seat=std(0x1c2436,.85);
  const fans=[];
  const stand=(len,dir,x0,z0,rot,tiers)=>{
    const g=new THREE.Group();g.position.set(x0,0,z0);g.rotation.y=rot;scene.add(g);
    for(let t=0;t<tiers;t++){const h=1.4+t*0.85;const b=new THREE.Mesh(new THREE.BoxGeometry(len,h,1.7),t%2?seat:concrete);b.position.set(0,h/2,2.2+t*1.7);b.receiveShadow=true;g.add(b);
      for(let s=-len/2+0.5;s<len/2;s+=0.75){if(Math.random()<0.18)continue;const lp=new THREE.Vector3(s+(Math.random()-.5)*0.2,h,2.2+t*1.7);fans.push({g,lp});}}
  };
  stand(F.HL*2+8,1,F.HW+1.2,0,Math.PI/2,9);stand(F.HL*2+8,1,-F.HW-1.2,0,-Math.PI/2,9);
  stand(F.HW*2+8,1,0,F.HL+1.2,0,6);stand(F.HW*2+8,1,0,-F.HL-1.2,Math.PI,6);
  scene.updateMatrixWorld(true);buildCrowd(fans);
  // floodlights
  const glow=glowTexture(),lamp=new THREE.MeshStandardMaterial({color:0xfff4dc,emissive:0xfff4dc,emissiveIntensity:1.4});
  for(const x of [-1,1])for(const z of [-1,1]){
    const px=x*(F.HW+19),pz=z*(F.HL+14);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.45,0.7,38,10),metal);pole.position.set(px,19,pz);scene.add(pole);
    const head=new THREE.Mesh(new THREE.BoxGeometry(8,4,0.8),lamp);head.position.set(px,38.5,pz);head.lookAt(0,0,0);scene.add(head);
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glow,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));sp.scale.set(26,26,1);sp.position.set(px*0.98,38.5,pz*0.98);scene.add(sp);
  }
  // city skyline
  const win=windowTexture(),N=70;
  const city=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0x111829,roughness:.9,emissive:0xffffff,emissiveMap:win,emissiveIntensity:.75}),N);
  const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),sc=new THREE.Vector3(),ps=new THREE.Vector3();
  for(let i=0;i<N;i++){const a=i/N*Math.PI*2+Math.random()*0.05,r=190+Math.random()*90,h=25+Math.random()*80,w=12+Math.random()*18;
    ps.set(Math.sin(a)*r,h/2,Math.cos(a)*r);q.setFromAxisAngle(new THREE.Vector3(0,1,0),a);sc.set(w,h,w*0.8);m4.compose(ps,q,sc);city.setMatrixAt(i,m4);}
  scene.add(city);
  // goals
  const postM=std(0xffffff,.3);
  for(const t of [0,1]){
    const z=goalZ(t),s=z<0?-1:1;
    const pg=new THREE.CylinderGeometry(0.06,0.06,F.GH,16);
    for(const x of [-F.GW/2,F.GW/2]){const p=new THREE.Mesh(pg,postM);p.position.set(x,F.GH/2,z);p.castShadow=true;scene.add(p);
      const back=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,F.GD,8),postM);back.rotation.x=Math.PI/2;back.position.set(x,0.03,z+s*F.GD/2);scene.add(back);}
    const bar=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,F.GW,16),postM);bar.rotation.z=Math.PI/2;bar.position.set(0,F.GH,z);bar.castShadow=true;scene.add(bar);
    const zb=z+s*F.GD,hw=F.GW/2;
    scene.add(netLines([[-hw,0,zb],[hw,0,zb],[hw,F.GH,zb],[-hw,F.GH,zb]],36,12,0.15));
    scene.add(netLines([[-hw,F.GH,z],[hw,F.GH,z],[hw,F.GH,zb],[-hw,F.GH,zb]],36,10,0));
    for(const x of [-hw,hw])scene.add(netLines([[x,0,z],[x,0,zb],[x,F.GH,zb],[x,F.GH,z]],10,12,0));
  }
}
function buildCrowd(fans){
  if(!fans.length)return;
  const N=fans.length;
  const body=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.2,0.24,0.85,7),new THREE.MeshStandardMaterial({roughness:.9}),N);
  const head=new THREE.InstancedMesh(new THREE.SphereGeometry(0.13,8,6),new THREE.MeshStandardMaterial({roughness:.8}),N);
  const shirt=[0x4f7cff,0xff6b57,0xf6f8fb,0x1d2438,0xd6ff3d,0x7a5cff,0x2f8857,0xffd166],skin=[0xf1c9a5,0xd9a77e,0xa86f4c,0x6e4630];
  const col=new THREE.Color();
  for(let i=0;i<N;i++){col.setHex(shirt[(Math.random()*shirt.length)|0]);body.setColorAt(i,col);col.setHex(skin[(Math.random()*skin.length)|0]);head.setColorAt(i,col);}
  crowd={body,head,fans,phase:fans.map(()=>Math.random()*6.28),hype:0,tick:0};
  scene.add(body);scene.add(head);updateCrowd(0,true);
}
const _m4=hasThree?new THREE.Matrix4():null,_v=hasThree?new THREE.Vector3():null;
function updateCrowd(dt,force){
  if(!crowd)return;crowd.tick+=dt;crowd.hype=Math.max(0,crowd.hype-dt*0.25);
  if(!force&&crowd.hype<=0.01&&crowd.tick<0.25)return;crowd.tick=0;
  const t=G.time;
  for(let i=0;i<crowd.fans.length;i++){const f=crowd.fans[i];
    const b=crowd.hype>0?Math.abs(Math.sin(t*9+crowd.phase[i]))*0.45*crowd.hype:Math.sin(t*1.5+crowd.phase[i])*0.03;
    _v.copy(f.lp);_v.y+=0.43+b;f.g.localToWorld(_v);_m4.makeTranslation(_v.x,_v.y,_v.z);crowd.body.setMatrixAt(i,_m4);
    _m4.makeTranslation(_v.x,_v.y+0.58,_v.z);crowd.head.setMatrixAt(i,_m4);}
  crowd.body.instanceMatrix.needsUpdate=true;crowd.head.instanceMatrix.needsUpdate=true;
}
function makeParticles(){
  const N=700,pos=new Float32Array(N*3),col=new Float32Array(N*3),base=new Float32Array(N*3),vel=new Float32Array(N*3),life=new Float32Array(N),max=new Float32Array(N);
  for(let i=0;i<N;i++)pos[i*3+1]=-100;
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  const pts=new THREE.Points(geo,new THREE.PointsMaterial({size:0.22,vertexColors:true,transparent:true,depthWrite:false}));pts.frustumCulled=false;scene.add(pts);let head=0;
  return {spawn(x,y,z,vx,vy,vz,r,g,b,l){const i=head;head=(head+1)%N;pos[i*3]=x;pos[i*3+1]=y;pos[i*3+2]=z;vel[i*3]=vx;vel[i*3+1]=vy;vel[i*3+2]=vz;base[i*3]=r;base[i*3+1]=g;base[i*3+2]=b;life[i]=max[i]=l;},
    update(dt){for(let i=0;i<N;i++){if(life[i]<=0)continue;life[i]-=dt;if(life[i]<=0){pos[i*3+1]=-100;continue;}vel[i*3+1]-=7*dt;pos[i*3]+=vel[i*3]*dt;pos[i*3+1]+=vel[i*3+1]*dt;pos[i*3+2]+=vel[i*3+2]*dt;if(pos[i*3+1]<0.02){pos[i*3+1]=0.02;vel[i*3+1]=0;vel[i*3]*=0.8;vel[i*3+2]*=0.8;}
      const f=Math.min(1,life[i]/max[i]*1.5);col[i*3]=base[i*3]*f;col[i*3+1]=base[i*3+1]*f;col[i*3+2]=base[i*3+2]*f;}
      geo.attributes.position.needsUpdate=true;geo.attributes.color.needsUpdate=true;}};
}
function turf(x,z,n,vx,vz){for(let i=0;i<n;i++)parts.spawn(x+(Math.random()-.5)*0.4,0.05,z+(Math.random()-.5)*0.4,vx*0.3+(Math.random()-.5)*2.5,1+Math.random()*2.5,vz*0.3+(Math.random()-.5)*2.5,0.18,0.42+Math.random()*0.2,0.2,0.5+Math.random()*0.4);}
function goalBurst(x,y,z,team){
  const c=team===0?[.35,.52,1]:[1,.45,.36];
  for(let i=0;i<260;i++){const th=Math.random()*Math.PI*2,s=3+Math.random()*10;const w=Math.random()<0.3;parts.spawn(x,y+.6,z,Math.cos(th)*s,4+Math.random()*9,Math.sin(th)*s,w?1:c[0],w?1:c[1],w?1:c[2],1.4+Math.random());}
  G.shake=0.8;if(crowd)crowd.hype=1;
}
function onResize(){if(!renderer)return;const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w<h?78:62;camera.updateProjectionMatrix();}
window.addEventListener('resize',onResize);

// ================= players: rigged model or built-in mannequin =================
const MODEL={state:'none',buf:null};
const MODEL_URLS=['models/player.glb','https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/models/gltf/Xbot.glb','https://raw.githubusercontent.com/mrdoob/three.js/r128/examples/models/gltf/Xbot.glb','https://threejs.org/examples/models/gltf/Xbot.glb'];
const LOADER_URLS=['https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js','https://unpkg.com/three@0.128.0/examples/js/loaders/GLTFLoader.js'];
function loadScript(urls){return new Promise((res,rej)=>{let i=0;const next=()=>{if(i>=urls.length){rej(new Error('script'));return;}const s=document.createElement('script');s.src=urls[i++];s.onload=()=>res();s.onerror=()=>{s.remove();next();};document.head.appendChild(s);};next();});}
function parseGLB(buf){return new Promise(res=>{try{new THREE.GLTFLoader().parse(buf.slice(0),'',g=>res(g),()=>res(null));}catch(e){res(null);}});}
async function loadPlayerModel(){
  if(MODEL.state!=='none')return;MODEL.state='loading';
  try{if(!THREE.GLTFLoader)await loadScript(LOADER_URLS);}catch(e){MODEL.state='fail';return;}
  for(const u of MODEL_URLS){
    try{const r=await fetch(u,{mode:'cors'});if(!r.ok)continue;const buf=await r.arrayBuffer();if(buf.byteLength<10000)continue;
      const g=await parseGLB(buf);if(!g||!g.scene)continue;MODEL.buf=buf;MODEL.state='ready';rigKey='';return;}catch(e){}
  }
  MODEL.state='fail';
}
const geoCache={};
function capsule(r1,r2,len,mat){
  const key=r1+':'+r2+':'+len;
  if(!geoCache[key])geoCache[key]={c:new THREE.CylinderGeometry(r1,r2,len,18,1,true),a:new THREE.SphereGeometry(r1,18,12),b:new THREE.SphereGeometry(r2,18,12)};
  const g=geoCache[key],o=new THREE.Group();
  const c=new THREE.Mesh(g.c,mat);c.position.y=-len/2;o.add(c);const a=new THREE.Mesh(g.a,mat);o.add(a);const b=new THREE.Mesh(g.b,mat);b.position.y=-len;o.add(b);
  o.traverse(m=>{if(m.isMesh)m.castShadow=true;});return o;
}
function lathe(profile,mat,segs){const g=new THREE.LatheGeometry(profile.map(p=>new THREE.Vector2(p[0],p[1])),segs||24);const m=new THREE.Mesh(g,mat);m.castShadow=true;return m;}
function numberTex(n,col){return canvasTex(128,128,(g,W)=>{g.clearRect(0,0,W,W);g.fillStyle=col;g.font='800 92px "Saira Condensed","Arial Narrow",sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(String(n),64,70);});}
function makeProcBody(team,num){
  const k=KIT[team],M=(c,r)=>new THREE.MeshStandardMaterial({color:c,roughness:r||0.65});
  const shirt=M(k.main,0.6),trim=M(k.trim,0.6),shorts=M(k.shorts,0.7),socks=M(k.socks,0.7),boot=M(0x151a24,0.35);
  const skinTones=[0xf1c9a5,0xd9a77e,0xb07b52,0x7a4e33],skin=M(skinTones[num%4],0.55),hair=M([0x2a1d16,0x111111,0x5a3a22,0xc9a46a][num%4],0.8);
  const glove=new THREE.MeshStandardMaterial({color:0xd6ff3d,emissive:0x5a7000,emissiveIntensity:.35,roughness:.5});
  const holder=new THREE.Group();holder.position.y=HIP;const inner=new THREE.Group();inner.position.y=-HIP;holder.add(inner);
  const J={};const g=(n,p,x,y,z)=>{const o=new THREE.Group();o.position.set(x,y,z);p.add(o);J[n]=o;return o;};
  const hips=g('hips',inner,0,0.95,0),spine=g('spine',hips,0,0.1,0),chest=g('chest',spine,0,0.2,0),neck=g('neck',chest,0,0.27,0),head=g('head',neck,0,0.07,0);
  const lArm=g('lArm',chest,0.205,0.2,0),lFore=g('lFore',lArm,0,-0.28,0),rArm=g('rArm',chest,-0.205,0.2,0),rFore=g('rFore',rArm,0,-0.28,0);
  const lTh=g('lThigh',hips,0.095,-0.03,0),lSh=g('lShin',lTh,0,-0.44,0),lFt=g('lFoot',lSh,0,-0.44,0);
  const rTh=g('rThigh',hips,-0.095,-0.03,0),rSh=g('rShin',rTh,0,-0.44,0),rFt=g('rFoot',rSh,0,-0.44,0);
  const sh=lathe([[0,-0.12],[0.15,-0.12],[0.165,-0.02],[0.16,0.08],[0.1,0.1],[0,0.1]],shorts);sh.position.y=0.02;sh.scale.z=0.82;hips.add(sh);
  const ab=lathe([[0,-0.02],[0.15,-0.02],[0.145,0.1],[0.16,0.2],[0,0.2]],shirt);ab.scale.z=0.78;spine.add(ab);
  const ch=lathe([[0,0],[0.16,0],[0.19,0.1],[0.205,0.2],[0.15,0.27],[0.06,0.29],[0,0.29]],shirt);ch.scale.z=0.7;chest.add(ch);
  const collar=new THREE.Mesh(new THREE.TorusGeometry(0.06,0.014,8,18),trim);collar.rotation.x=Math.PI/2;collar.position.y=0.27;chest.add(collar);
  const nk=capsule(0.048,0.05,0.06,skin);nk.position.y=0.06;neck.add(nk);
  const hd=new THREE.Mesh(new THREE.SphereGeometry(0.112,24,18),skin);hd.scale.set(0.92,1.1,1);hd.position.y=0.11;hd.castShadow=true;head.add(hd);
  const hr=new THREE.Mesh(new THREE.SphereGeometry(0.118,24,12,0,Math.PI*2,0,Math.PI*0.52),hair);hr.scale.set(0.95,1.08,1.04);hr.position.set(0,0.125,-0.008);head.add(hr);
  const nose=new THREE.Mesh(new THREE.SphereGeometry(0.018,8,6),skin);nose.position.set(0,0.1,0.105);head.add(nose);
  const num_=new THREE.Mesh(new THREE.PlaneGeometry(0.2,0.2),new THREE.MeshBasicMaterial({map:numberTex(num,team===0?'#ffffff':'#1d2438'),transparent:true}));num_.position.set(0,0.13,-0.146);num_.rotation.y=Math.PI;chest.add(num_);
  for(const [arm,fore] of [[lArm,lFore],[rArm,rFore]]){
    const sl=capsule(0.058,0.05,0.12,shirt);arm.add(sl);const up=capsule(0.048,0.042,0.28,skin);arm.add(up);
    const lo=capsule(0.04,0.033,0.25,skin);fore.add(lo);const hand=new THREE.Mesh(new THREE.SphereGeometry(0.045,12,10),skin);hand.position.y=-0.28;hand.scale.set(0.8,1.15,0.6);fore.add(hand);
    const gl=new THREE.Mesh(new THREE.SphereGeometry(0.062,12,10),glove);gl.position.y=-0.28;gl.scale.set(0.85,1.2,0.75);gl.visible=false;fore.add(gl);
    (J.gloves||(J.gloves=[])).push(gl);
  }
  for(const [th,sn,ft] of [[lTh,lSh,lFt],[rTh,rSh,rFt]]){
    const leg=capsule(0.078,0.058,0.44,skin);th.add(leg);
    const sleeve=new THREE.Mesh(new THREE.CylinderGeometry(0.088,0.082,0.17,18),shorts);sleeve.position.y=-0.07;sleeve.castShadow=true;th.add(sleeve);
    const sk=capsule(0.056,0.04,0.42,socks);sn.add(sk);
    const bt=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),boot);bt.scale.set(0.05,0.042,0.13);bt.position.set(0,-0.02,0.06);bt.castShadow=true;ft.add(bt);
  }
  return {holder,joints:J,gloves:J.gloves,kind:'proc'};
}
function makeGltfBody(gltf,team){
  const sc=gltf.scene;
  const holder=new THREE.Group();holder.position.y=HIP;const inner=new THREE.Group();inner.position.y=-HIP;holder.add(inner);inner.add(sc);
  sc.updateMatrixWorld(true);
  let box=new THREE.Box3().setFromObject(sc),h=box.max.y-box.min.y;
  if(h>0.3&&isFinite(h)){sc.scale.multiplyScalar(1.8/h);sc.updateMatrixWorld(true);box=new THREE.Box3().setFromObject(sc);sc.position.y-=box.min.y;}
  const k=KIT[team];
  sc.traverse(o=>{if(o.isMesh){o.castShadow=true;o.frustumCulled=false;
    const one=m=>{const c=m.clone();const joint=/joint/i.test(m.name||'')||/joint/i.test(o.name||'');c.color=new THREE.Color(joint?k.trim:k.main);if('roughness'in c)c.roughness=joint?0.35:0.5;if('metalness'in c)c.metalness=joint?0.4:0.08;c.map=null;c.needsUpdate=true;return c;};
    o.material=Array.isArray(o.material)?o.material.map(one):one(o.material);}});
  const bones={};sc.traverse(o=>{if(o.isBone){const n=o.name.toLowerCase().replace(/[^a-z0-9]/g,'').replace(/^mixamorig\d*/,'');bones[n]=o;}});
  const map={hips:'hips',spine:'spine',chest:'spine2',neck:'neck',head:'head',lArm:'leftarm',lFore:'leftforearm',rArm:'rightarm',rFore:'rightforearm',lThigh:'leftupleg',lShin:'leftleg',lFoot:'leftfoot',rThigh:'rightupleg',rShin:'rightleg',rFoot:'rightfoot'};
  const J={};for(const key in map)J[key]=bones[map[key]]||(key==='chest'?bones.spine1:null)||null;
  if(!J.hips||!J.lThigh||!J.rThigh||!J.lArm||!J.rArm)return null;
  const rest={};for(const key of JOINTS)if(J[key])rest[key]=J[key].quaternion.clone();
  const mixer=new THREE.AnimationMixer(sc),acts={};
  for(const name of ['idle','walk','run']){const clip=gltf.animations.find(c=>c.name.toLowerCase()===name)||gltf.animations.find(c=>c.name.toLowerCase().includes(name));
    if(clip){const a=mixer.clipAction(clip);a.play();a.setEffectiveWeight(name==='idle'?1:0);acts[name]=a;}}
  const gloves=[];const glove=new THREE.MeshStandardMaterial({color:0xd6ff3d,emissive:0x5a7000,emissiveIntensity:.35,roughness:.5});
  for(const hn of ['lefthand','righthand']){const hb=bones[hn];if(!hb)continue;const ws=new THREE.Vector3();hb.getWorldScale(ws);
    const gl=new THREE.Mesh(new THREE.SphereGeometry(0.075,12,10),glove);gl.scale.setScalar(1/(ws.x||1));gl.position.set(0,0.06/(ws.x||1),0);gl.visible=false;hb.add(gl);gloves.push(gl);}
  return {holder,joints:J,rest,mixer,acts,w:{idle:1,walk:0,run:0},gloves,kind:'gltf',tpose:!acts.idle};
}
function nameSprite(text,team){
  const cv=document.createElement('canvas');cv.width=256;cv.height=64;const g=cv.getContext('2d');
  g.font='800 36px "Saira Condensed","Arial Narrow",sans-serif';g.textAlign='center';g.textBaseline='middle';
  g.lineWidth=6;g.strokeStyle='rgba(9,14,26,.85)';g.strokeText(text,128,32);g.fillStyle=team===0?'#b3c7ff':'#ffbcb2';g.fillText(text,128,32);
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(cv),transparent:true,depthTest:false}));sp.scale.set(2.0,0.5,1);sp.renderOrder=5;return sp;
}
function makeRig(p,idx){
  const root=new THREE.Group();scene.add(root);
  const rig={root,team:p.team,body:null,cur:{},h:{lift:0,pitch:0,roll:0},gait:Math.random()*6,num:2+((idx*7+p.team*3)%20)};
  setBody(rig,makeProcBody(p.team,rig.num));
  const ring=new THREE.Mesh(new THREE.RingGeometry(0.46,0.56,40),new THREE.MeshBasicMaterial({color:KIT[p.team].ring,transparent:true,opacity:.55,depthWrite:false}));
  ring.rotation.x=-Math.PI/2;ring.position.y=0.015;root.add(ring);rig.ring=ring;
  rig.tag=nameSprite(p.name,p.team);rig.tag.position.y=2.2;root.add(rig.tag);
  if(MODEL.state==='ready'){rig.pending=true;parseGLB(MODEL.buf).then(g=>{rig.pending=false;if(!g||rig.dead)return;const b=makeGltfBody(g,p.team);if(b)setBody(rig,b);});}
  return rig;
}
function setBody(rig,body){if(rig.body)rig.root.remove(rig.body.holder);rig.body=body;rig.root.add(body.holder);rig.cur={};}
function syncRigs(players){
  const key=players.map(p=>p.team+':'+p.name).join('|')+'#'+MODEL.state;if(key===rigKey)return;rigKey=key;
  while(rigs.length){const r=rigs.pop();r.dead=true;scene.remove(r.root);}
  players.forEach((p,i)=>rigs.push(makeRig(p,i)));
}
function updateRig(rig,p,dt,ctx){
  const b=rig.body;if(!b)return;
  const spd=hyp(p.vx||0,p.vz||0);
  rig.gait+=dt*(2.2+spd*1.45);
  ctx.proc=b.kind==='proc';ctx.gait=rig.gait;ctx.spd=spd;
  const P=poseFor(p,ctx);
  if(b.tpose){(P.a.lArm||(P.a.lArm=[0,0,0]))[2]-=1.3;(P.a.rArm||(P.a.rArm=[0,0,0]))[2]+=1.3;}
  const kj=1-Math.exp(-24*dt),kh=1-Math.exp(-16*dt),cur=rig.cur;
  for(const k of JOINTS){const t=P.a[k]||[0,0,0],c=cur[k]||(cur[k]=[0,0,0]);c[0]+=(t[0]-c[0])*kj;c[1]+=(t[1]-c[1])*kj;c[2]+=(t[2]-c[2])*kj;}
  rig.h.lift+=(P.lift-rig.h.lift)*kh;rig.h.pitch+=(P.pitch-rig.h.pitch)*kh;rig.h.roll+=(P.roll-rig.h.roll)*kh;
  if(b.kind==='gltf'){
    for(const k of JOINTS)if(b.joints[k]&&b.rest[k])b.joints[k].quaternion.copy(b.rest[k]);
    const aw=P.aw,tw={idle:clamp(1-spd/1.6,0,1),walk:spd<3.6?clamp(1-Math.abs(spd-1.9)/1.6,0,1):0,run:clamp((spd-2.2)/2.2,0,1)};
    const sum=tw.idle+tw.walk+tw.run||1;for(const n in tw)tw[n]=tw[n]/sum*(1-aw);tw.idle+=aw;
    const kw=1-Math.exp(-10*dt);
    for(const n of ['idle','walk','run']){const a=b.acts[n];if(!a)continue;b.w[n]+=(tw[n]-b.w[n])*kw;a.setEffectiveWeight(b.w[n]);}
    if(b.acts.walk)b.acts.walk.timeScale=clamp(spd/1.5,0.6,1.7);if(b.acts.run)b.acts.run.timeScale=clamp(spd/5.4,0.75,1.6);
    b.mixer.update(dt);
  }else{for(const k of JOINTS){const j=b.joints[k];if(j)j.quaternion.set(0,0,0,1);}}
  applyPose(b.joints,b.holder,cur);
  b.holder.position.y=HIP+rig.h.lift;b.holder.rotation.set(rig.h.pitch,P.yaw,rig.h.roll,'YXZ');
  rig.root.position.set(p.x,0,p.z);rig.root.rotation.y=p.face;
  for(const g of b.gloves||[])g.visible=!!p.gk;
}

// ================= camera and aim =================
const CAM={yaw:0,pitch:-0.035,manualT:0};
function aimDir(){const cp=Math.cos(CAM.pitch);return [Math.sin(CAM.yaw)*cp,Math.sin(CAM.pitch),Math.cos(CAM.yaw)*cp];}
function camRig(p){const d=aimDir(),dist=4.8;return {x:p.x-d[0]*dist,y:Math.max(0.55,1.55-d[1]*dist+0.95+(p.y||0)*0.4),z:p.z-d[2]*dist,d};}
function aimFlatDir(){return [Math.sin(CAM.yaw),Math.cos(CAM.yaw)];}
// where the centre reticle points: on the goal, on the ground, or 30 m out
function aimTarget(p){
  const c=camRig(p),d=c.d,gz=attackZ(p.team);
  let tgt=null;
  if(d[2]*(gz-c.z)>0){const t=(gz-c.z)/d[2];const x=c.x+d[0]*t,y=c.y+d[1]*t;if(t>0&&t<75&&Math.abs(x)<F.GW/2+9&&y>-2&&y<F.GH+7)tgt={x,y:Math.max(0.15,y),z:gz,goal:true};}
  if(!tgt&&d[1]<-0.02){const t=(0.12-c.y)/d[1];if(t>0&&t<36)tgt={x:c.x+d[0]*t,y:0.12,z:c.z+d[2]*t};}
  if(!tgt){const t=32;tgt={x:c.x+d[0]*t,y:Math.max(0.3,c.y+d[1]*t),z:c.z+d[2]*t};}
  if(G.touchUsed&&tgt.goal){tgt.x=clamp(tgt.x,-F.GW/2+0.45,F.GW/2-0.45);tgt.y=clamp(tgt.y,0.35,F.GH-0.35);}
  return tgt;
}
const camPos=hasThree?new THREE.Vector3(0,30,-70):null,camLook=hasThree?new THREE.Vector3():null;
function updateCamera(view,dt,me){
  const b=view.ball;
  if(me&&inMatch()){
    CAM.manualT-=dt;
    if(G.autoCam&&CAM.manualT<=0&&!LC.charging){
      const owned=b.owner===me.i;
      let want=owned||hyp(b.x-me.x,b.z-me.z)<2.5?Math.atan2(-me.x*0.35,attackZ(me.team)-me.z):Math.atan2(b.x-me.x,b.z-me.z);
      if(owned&&hyp(me.vx,me.vz)>2)want=Math.atan2(me.vx,me.vz)*0.4+want*0.6;
      const rate=2.2*dt;CAM.yaw=wrapA(CAM.yaw+clamp(wrapA(want-CAM.yaw),-rate,rate));CAM.pitch+=(-0.04-CAM.pitch)*Math.min(1,dt*3);
    }
    const c=camRig(me);
    camPos.lerp(_v.set(c.x,c.y,c.z),1-Math.exp(-20*dt));
    camera.position.copy(camPos);
    camLook.set(camPos.x+c.d[0]*20,camPos.y+c.d[1]*20,camPos.z+c.d[2]*20);
  }else if(inMatch()){
    const tp=_v.set(-(F.HW+14),22,clamp(b.z*0.85,-40,40));camPos.lerp(tp,1-Math.exp(-3*dt));camera.position.copy(camPos);
    camLook.lerp(new THREE.Vector3(b.x*0.5,b.y*0.3,b.z),1-Math.exp(-6*dt));
  }else{
    const t=performance.now()/1000;camPos.set(Math.sin(t*0.05)*78,30,Math.cos(t*0.05)*96);camera.position.copy(camPos);camLook.set(0,2,0);
  }
  if(G.shake>0){G.shake=Math.max(0,G.shake-dt*1.6);const s=G.shake*0.18;camera.position.x+=(Math.random()-.5)*s;camera.position.y+=(Math.random()-.5)*s;}
  camera.lookAt(camLook);
}

// ================= rendering a view =================
const lastBall={x:0,z:0};
function renderView(view,dt){
  syncRigs(view.players);
  const b=view.ball;
  view.players.forEach((p,i)=>{const r=rigs[i];if(!r)return;
    const holding=b.owner===i,look=wrapA(Math.atan2(b.x-p.x,b.z-p.z)-p.face);
    let diveSide=1;if(p.st===ST.dive){const lx=(p.dvx||0)*Math.cos(p.face)-(p.dvz||0)*Math.sin(p.face);diveSide=lx>=0?1:-1;}
    updateRig(r,p,dt,{holding,hands:holding&&b.hands,celebrate:view.phase==='goal'&&view.scorer===i,look,time:G.time,diveSide});
    r.root.visible=!p.gone;
    r.tag.visible=i!==G.myIdx;r.ring.material.color.setHex(i===G.myIdx?0xffffff:p.gk?0xd6ff3d:KIT[p.team].ring);r.ring.material.opacity=i===G.myIdx?0.9:0.5;
    // turf kicks on slides and dives
    if((p.st===ST.slide||p.st===ST.dive||p.st===ST.rush)&&p.stT<0.5&&Math.random()<0.5)turf(p.x,p.z,2,p.vx||0,p.vz||0);
  });
  const hide=view.phase==='goal'&&(view.timer||0)<2.6;
  ballMesh.visible=ballShadow.visible=!hide;
  ballMesh.position.set(b.x,b.y,b.z);
  const dx=b.x-lastBall.x,dz=b.z-lastBall.z,dl=hyp(dx,dz);
  if(dl>1e-4&&dl<3){_v.set(dz,0,-dx).normalize();ballMesh.rotateOnWorldAxis(_v,dl/F.R);}
  if(b.sx)ballMesh.rotateY(b.sx*dt*8);
  lastBall.x=b.x;lastBall.z=b.z;
  ballShadow.position.set(b.x,0.012,b.z);const hs=clamp(1-(b.y-F.R)/6,0.3,1);ballShadow.scale.setScalar(hs);ballShadow.material.opacity=.3*hs;
  parts.update(dt);updateCrowd(dt);
}

// ================= HUD =================
const hud={s0:$('s0'),s1:$('s1'),clock:$('clock'),banner:$('banner'),arc:$('retArc'),dot:$('retDot'),tier:$('tierTxt'),gk:$('gkChip'),perfect:$('perfectChip'),
  stam:$('stamFill'),eff:$('effFill'),effBar:$('effBar'),push:$('pushInd'),vol:$('volInd'),reticle:$('reticle'),hint:$('hint')};
let bannerKey='';
function setBanner(key,big,sub,color){
  if(key===bannerKey)return;bannerKey=key;hud.banner.innerHTML='';if(!big)return;
  const a=document.createElement('span');a.className='big';a.textContent=big;if(color)a.style.color=color;hud.banner.appendChild(a);
  if(sub){const s=document.createElement('span');s.className='sub';s.textContent=sub;hud.banner.appendChild(s);}
  hud.banner.classList.remove('pop');void hud.banner.offsetWidth;hud.banner.classList.add('pop');
}
function fmtClock(s){s=Math.max(0,Math.ceil(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');}
function screenOf(x,y,z){_v.set(x,y,z).project(camera);if(!(_v.z<1))return null;return [(_v.x+1)/2*innerWidth,(1-_v.y)/2*innerHeight];}
function placeInd(el,x,y,z,rot){const s=screenOf(x,y,z);if(!s){el.hidden=true;return;}el.hidden=false;el.style.transform='translate('+s[0].toFixed(1)+'px,'+s[1].toFixed(1)+'px) translate(-50%,-50%)'+(rot?' rotate(45deg)':'');}
function updateHUD(view,dt,me){
  hud.s0.textContent=view.score[0];hud.s1.textContent=view.score[1];
  hud.clock.textContent=G.mode==='practice'?'PRACTICE':view.ot?'OT':fmtClock(view.clock);
  hud.reticle.hidden=!me;
  if(me){
    hud.gk.hidden=!me.gk;
    const pw=LC.charging?LC.power:0,tier=shotTier(pw);
    hud.arc.setAttribute('stroke-dasharray',(150.8*pw).toFixed(1)+' 200');
    hud.arc.setAttribute('stroke-width',LC.charging==='shot'?String([3,6,9][tier]):'4');
    hud.arc.setAttribute('stroke',LC.charging==='pass'?'#5aa7ff':['#f6f8fb','#ffd166','#ff6b57'][tier]);
    if(LC.charging==='shot'){hud.dot.setAttribute('visibility','visible');hud.dot.setAttribute('cx',(LC.cx*24).toFixed(1));hud.dot.setAttribute('cy',(-LC.cy*24).toFixed(1));
      hud.tier.hidden=false;hud.tier.textContent=(IN.lob?'CHIP ':'')+'LEVEL '+(tier+1);}
    else{hud.dot.setAttribute('visibility','hidden');hud.tier.hidden=!(LC.charging==='pass');if(LC.charging==='pass')hud.tier.textContent=IN.lob?'LOB PASS':'PASS';}
    hud.stam.style.width=Math.round(me.stam)+'%';hud.stam.classList.toggle('low',me.stam<25||me.stamLock);
    hud.eff.style.width=(me.effort>0?Math.round(me.effort/STAM.EFF_TIME*100):Math.round(me.eff))+'%';hud.effBar.classList.toggle('ready',me.eff>=100);
    // touch cues: push diamond on the ball, volley/header triangle above it
    const b=view.ball,bd=hyp(b.x-me.x,b.z-me.z);
    if(b.owner===me.i&&!b.hands){const ahead=(b.x-me.x)*Math.sin(me.face)+(b.z-me.z)*Math.cos(me.face);hud.push.classList.toggle('good',ahead>0.25&&ahead<0.85);placeInd(hud.push,b.x,b.y+0.55,b.z,true);}
    else if(b.owner<0&&bd<CTRL.REACH&&b.y<1.4&&!me.gk){hud.push.classList.toggle('good',bd<1.2);placeInd(hud.push,b.x,b.y+0.55,b.z,true);}
    else hud.push.hidden=true;
    let vol=null;if(b.owner<0&&b.y>0.6&&bd<6){for(let t=0.15;t<=0.6;t+=0.15){const y=b.y+b.vy*t-0.5*F.G*t*t,x=b.x+b.vx*t,z=b.z+b.vz*t;if(y>0.45&&y<2.9&&hyp(x-me.x,z-me.z)<1.7){vol=y>1.6?'head':'volley';break;}}}
    if(vol){hud.vol.classList.toggle('head',vol==='head');placeInd(hud.vol,b.x,b.y+0.7,b.z,false);}else hud.vol.hidden=true;
  }else{hud.push.hidden=true;hud.vol.hidden=true;hud.tier.hidden=true;hud.gk.hidden=true;}
  if(G.perfectT>0)G.perfectT-=dt;hud.perfect.hidden=!(G.perfectT>0);
  if(view.phase!==G.lastPhase){if(view.phase==='play'&&G.lastPhase==='count'){G.goTimer=0.8;sfxWhistle(0.25);}G.lastPhase=view.phase;}
  if(view.goalSeq!==G.lastGoalSeq){if(G.lastGoalSeq!==-1&&view.goalSeq>G.lastGoalSeq){goalBurst(view.ball.x,view.ball.y,view.ball.z,view.goalTeam);sfxGoal();}G.lastGoalSeq=view.goalSeq;}
  if(G.goTimer>0)G.goTimer-=dt;
  if(view.phase==='count'){const n=Math.ceil(view.timer);setBanner('c'+n,String(n),view.ot?'Overtime · next goal wins':'',null);if(n!==G._lc){G._lc=n;sfxBeep(440,.12);}}
  else if(view.phase==='goal'){const sc=view.scorer>=0&&view.players[view.scorer]?view.players[view.scorer].name:null;setBanner('g'+view.goalSeq,'Goal!',sc?sc+' scores':'Own goal',view.goalTeam===0?'#4f7cff':'#ff6b57');}
  else if(G.goTimer>0)setBanner('go','Go!','',null);
  else setBanner('','');
  if(G.mode!=='practice'||!me)hud.hint.hidden=true;
}

// ================= input =================
const keys=new Set();
const HOLD={KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',ShiftLeft:'sprint',ShiftRight:'sprint',
  ControlLeft:'stance',ControlRight:'stance',AltLeft:'stance',AltRight:'stance',KeyF:'lob',KeyK:'shoot',KeyJ:'pass'};
const TAP={Space:'push',KeyC:'flick',KeyE:'tackle',KeyQ:'block',KeyR:'recall'};
const IN={mx:0,my:0,sprint:false,shootHeld:false,passHeld:false,lob:false,stance:false,curveAbs:null,cdx:0,cdy:0};
const Q={push:0,flick:0,tackle:0,block:0,effort:0,recall:0};
let lastShift=0;
window.addEventListener('keydown',e=>{
  if(e.target&&e.target.tagName==='INPUT')return;ensureAudio();
  if(HOLD[e.code]||TAP[e.code]){if(inMatch())e.preventDefault();G.touchUsed=false;}
  if(HOLD[e.code])keys.add(HOLD[e.code]);
  if(!e.repeat){
    if(TAP[e.code])Q[TAP[e.code]]++;
    if(e.code==='ShiftLeft'||e.code==='ShiftRight'){const n=performance.now();if(n-lastShift<300)Q.effort++;lastShift=n;}
    if(e.code==='KeyV')toggleCam();
    if(e.code==='Escape'&&inMatch()&&!pointerLocked())togglePause();
  }
});
window.addEventListener('keyup',e=>{if(HOLD[e.code])keys.delete(HOLD[e.code]);});
window.addEventListener('blur',()=>{keys.clear();mouse.l=mouse.r=false;});
const mouse={l:false,r:false,dx:0,dy:0};
const canvas=$('c');
function pointerLocked(){return document.pointerLockElement===canvas;}
canvas.addEventListener('mousedown',e=>{
  if(!inMatch())return;ensureAudio();G.touchUsed=false;
  if(!pointerLocked()&&!document.body.classList.contains('touch')){try{const r=canvas.requestPointerLock();if(r&&r.catch)r.catch(()=>{});}catch(_){}return;}
  if(e.button===0)mouse.l=true;if(e.button===2)mouse.r=true;
});
window.addEventListener('mouseup',e=>{if(e.button===0)mouse.l=false;if(e.button===2)mouse.r=false;});
window.addEventListener('mousemove',e=>{if(pointerLocked()){mouse.dx+=e.movementX||0;mouse.dy+=e.movementY||0;}});
document.addEventListener('pointerlockchange',()=>{if(!pointerLocked()){mouse.l=mouse.r=false;}});
document.addEventListener('contextmenu',e=>{if(inMatch())e.preventDefault();});
// touch
const touch={id:null,sx:0,sy:0,x:0,y:0,sprint:false,lookId:null,lx:0,ly:0,shoot:false,pass:false,lob:false,stance:false,shootSX:0,shootSY:0,curve:null};
function enableTouch(){document.body.classList.add('touch');$('touch').hidden=false;}
if(IS_TOUCH)enableTouch();
window.addEventListener('touchstart',()=>{enableTouch();G.touchUsed=true;},{passive:true});
const zone=$('stickZone'),stick=$('stick'),knob=$('knob'),lookZ=$('lookZone');
zone.addEventListener('pointerdown',e=>{ensureAudio();touch.id=e.pointerId;touch.sx=e.clientX;touch.sy=e.clientY;touch.x=touch.y=0;stick.style.left=e.clientX+'px';stick.style.top=e.clientY+'px';try{zone.setPointerCapture(e.pointerId);}catch(_){}e.preventDefault();});
zone.addEventListener('pointermove',e=>{if(e.pointerId!==touch.id)return;let dx=(e.clientX-touch.sx)/62,dy=(e.clientY-touch.sy)/62;const l=hyp(dx,dy);if(l>1){dx/=l;dy/=l;}
  touch.x=Math.abs(dx)<.1?0:dx;touch.y=Math.abs(dy)<.1?0:dy;touch.sprint=l>0.95;stick.classList.toggle('sprinting',touch.sprint);knob.style.transform='translate('+dx*42+'px,'+dy*42+'px)';});
const endStick=e=>{if(e.pointerId!==touch.id)return;touch.id=null;touch.x=touch.y=0;touch.sprint=false;stick.classList.remove('sprinting');knob.style.transform='';stick.style.left='';stick.style.top='';};
zone.addEventListener('pointerup',endStick);zone.addEventListener('pointercancel',endStick);
lookZ.addEventListener('pointerdown',e=>{touch.lookId=e.pointerId;touch.lx=e.clientX;touch.ly=e.clientY;try{lookZ.setPointerCapture(e.pointerId);}catch(_){}e.preventDefault();});
lookZ.addEventListener('pointermove',e=>{if(e.pointerId!==touch.lookId)return;LOOK.x+=(e.clientX-touch.lx)*0.006;LOOK.y+=(e.clientY-touch.ly)*0.004;touch.lx=e.clientX;touch.ly=e.clientY;});
const endLook=e=>{if(e.pointerId===touch.lookId)touch.lookId=null;};lookZ.addEventListener('pointerup',endLook);lookZ.addEventListener('pointercancel',endLook);
const LOOK={x:0,y:0};
const tb=(id,down,up,move)=>{const el=$(id);el.addEventListener('pointerdown',e=>{e.preventDefault();ensureAudio();G.touchUsed=true;el.classList.add('on');try{el.setPointerCapture(e.pointerId);}catch(_){}down(e);});
  if(move)el.addEventListener('pointermove',move);
  ['pointerup','pointercancel'].forEach(t=>el.addEventListener(t,()=>{el.classList.remove('on');if(up)up();}));};
tb('tShoot',e=>{touch.shoot=true;touch.shootSX=e.clientX;touch.shootSY=e.clientY;touch.curve=[0,0];},()=>{touch.shoot=false;},e=>{if(touch.shoot)touch.curve=[clamp((e.clientX-touch.shootSX)/60,-1,1),clamp(-(e.clientY-touch.shootSY)/60,-1,1)];});
tb('tPass',()=>touch.pass=true,()=>touch.pass=false);
tb('tLob',()=>touch.lob=true,()=>touch.lob=false);
tb('tStance',()=>touch.stance=true,()=>touch.stance=false);
tb('tPush',()=>Q.push++);tb('tTackle',()=>Q.tackle++);tb('tFlick',()=>Q.flick++);tb('tBlock',()=>Q.block++);tb('tEffort',()=>Q.effort++);
document.addEventListener('gesturestart',e=>e.preventDefault());document.addEventListener('dblclick',e=>e.preventDefault());
let padPrev={},lbLast=0;
function readInput(dt){
  let x=0,y=0;if(keys.has('up'))y+=1;if(keys.has('down'))y-=1;if(keys.has('right'))x+=1;if(keys.has('left'))x-=1;
  let sprint=keys.has('sprint'),shoot=keys.has('shoot')||mouse.l||touch.shoot,pass=keys.has('pass')||mouse.r||touch.pass;
  let lob=keys.has('lob')||touch.lob,stance=keys.has('stance')||touch.stance;
  if(touch.id!==null){x+=touch.x;y+=-touch.y;if(touch.sprint)sprint=true;}
  let lx=LOOK.x,ly=LOOK.y,cdx=0,cdy=0,curveAbs=touch.shoot?touch.curve:null;LOOK.x=LOOK.y=0;
  let gps=[];try{gps=navigator.getGamepads?navigator.getGamepads():[];}catch(_){}
  for(const gp of gps){if(!gp)continue;const dz=v=>Math.abs(v)<.15?0:v;
    x+=dz(gp.axes[0]||0);y+=-dz(gp.axes[1]||0);
    const btn=i=>!!(gp.buttons[i]&&gp.buttons[i].pressed);
    if(btn(7))shoot=true;if(btn(2))pass=true;if(btn(4)||btn(10))sprint=true;if(btn(5))lob=true;if(btn(6))stance=true;
    if(LC.charging==='shot'&&btn(7))curveAbs=[dz(gp.axes[2]||0),-dz(gp.axes[3]||0)];
    else{lx+=dz(gp.axes[2]||0)*2.6*dt;ly+=dz(gp.axes[3]||0)*1.3*dt;}
    const edge=(i,f)=>{const v=btn(i);if(v&&!padPrev[i]){f();ensureAudio();G.touchUsed=false;}padPrev[i]=v;};
    edge(0,()=>{if(btn(5))Q.flick++;else Q.push++;});edge(1,()=>Q.tackle++);edge(3,()=>Q.block++);
    edge(4,()=>{const n=performance.now();if(n-lbLast<300)Q.effort++;lbLast=n;});
    edge(9,()=>{if(inMatch())togglePause();});edge(8,toggleCam);break;}
  if(pointerLocked()){
    if(LC.charging==='shot'){cdx=mouse.dx*0.012;cdy=-mouse.dy*0.012;}
    else{lx+=mouse.dx*0.0024;ly+=mouse.dy*0.0018;}
  }
  mouse.dx=mouse.dy=0;
  if(LC.charging==='shot'&&!pointerLocked()){lx=0;ly=0;}
  if(lx!==0||ly!==0)CAM.manualT=2.5;
  CAM.yaw=wrapA(CAM.yaw-lx);CAM.pitch=clamp(CAM.pitch-ly,-0.42,0.38);
  const l=hyp(x,y);if(l>1){x/=l;y/=l;}
  Object.assign(IN,{mx:x,my:y,sprint,shootHeld:shoot,passHeld:pass,lob,stance,curveAbs,cdx,cdy});
}
function takeQ(){const q=Object.assign({},Q);for(const k in Q)Q[k]=0;return q;}
function toggleCam(){G.autoCam=!G.autoCam;store.set('autoCam',G.autoCam);$('camBtn').textContent=G.autoCam?'Auto cam':'Free cam';}
$('camBtn').textContent=G.autoCam?'Auto cam':'Free cam';$('camBtn').onclick=toggleCam;

// ================= audio =================
let actx=null,master=null,amb=null;
function ensureAudio(){if(!actx){try{actx=new (window.AudioContext||window.webkitAudioContext)();master=actx.createGain();master.gain.value=G.sound?.6:0;master.connect(actx.destination);
  const nb=actx.createBuffer(1,actx.sampleRate*2,actx.sampleRate),d=nb.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;actx._noise=nb;
  const s=actx.createBufferSource();s.buffer=nb;s.loop=true;const bp=actx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=700;bp.Q.value=0.6;amb=actx.createGain();amb.gain.value=0.02;s.connect(bp);bp.connect(amb);amb.connect(master);s.start();}catch(e){actx=null;}}
  if(actx&&actx.state==='suspended')actx.resume();}
function tone(f,dur,type,vol,to){if(!actx||!G.sound)return;const o=actx.createOscillator(),g=actx.createGain(),t=actx.currentTime;o.type=type||'sine';o.frequency.setValueAtTime(f,t);if(to)o.frequency.exponentialRampToValueAtTime(to,t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);o.connect(g);g.connect(master);o.start(t);o.stop(t+dur+.02);}
function noise(dur,vol,freq){if(!actx||!G.sound)return;const s=actx.createBufferSource(),f=actx.createBiquadFilter(),g=actx.createGain(),t=actx.currentTime;s.buffer=actx._noise;f.type='bandpass';f.frequency.value=freq||1200;g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);s.connect(f);f.connect(g);g.connect(master);s.start(t);s.stop(t+dur+.05);}
function sfxBeep(f,d){tone(f,d,'square',.06);}
function sfxKick(p){tone(110+p*3,.1,'triangle',Math.min(.5,.12+p/60),55);noise(.07,Math.min(.35,.05+p/90),1800);if(p>26)G.shake=Math.max(G.shake,0.25);}
function sfxWhistle(d){tone(2100,d||.3,'sine',.08,2300);}
function sfxGoal(){sfxWhistle(.5);if(actx&&G.sound&&amb){const t=actx.currentTime;amb.gain.cancelScheduledValues(t);amb.gain.setValueAtTime(0.02,t);amb.gain.linearRampToValueAtTime(0.22,t+0.3);amb.gain.exponentialRampToValueAtTime(0.02,t+3.5);}}
function sfxEffort(){tone(300,.25,'sawtooth',.06,900);}
function setSound(on){G.sound=on;store.set('sound',on);if(master)master.gain.value=on?.6:0;$('soundBtn').textContent='Sound: '+(on?'on':'off');}
$('soundBtn').onclick=()=>{ensureAudio();setSound(!G.sound);};setSound(G.sound);
$('qualityBtn').textContent='Graphics: '+(G.hq?'high':'fast');
$('qualityBtn').onclick=()=>{G.hq=!G.hq;store.set('hq',G.hq);$('qualityBtn').textContent='Graphics: '+(G.hq?'high':'fast');if(renderer){renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,G.hq?2:1.25));onResize();}};
$('fsBtn').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(e){$('fsBtn').textContent='Full screen not available here';}};

// ================= your own player (runs on your device every step) =================
const LC={charging:null,power:0,cx:0,cy:0,prevShoot:false,prevPass:false,req:null,reqT:0,intent:null,intentT:0};
function wishDir(){const [fx,fz]=aimFlatDir();const rx=-fz,rz=fx;return [fx*IN.my+rx*IN.mx,fz*IN.my+rz*IN.mx];}
function controlStep(p,ball,mates,dt,emit,frozen,q){
  if(frozen){p.vx=p.vz=0;LC.charging=null;LC.req=null;p.charge=0;p.stT+=dt;return;}
  const [wx,wz]=wishDir(),wm=hyp(wx,wz),holding=ball.owner===p.i,free=p.st===ST.run;
  const fwd=[Math.sin(p.face),Math.cos(p.face)],dir=wm>0.3?[wx/wm,wz/wm]:fwd;
  if(IN.shootHeld&&!LC.prevShoot&&!LC.charging&&free){LC.charging='shot';LC.power=0;LC.cx=LC.cy=0;}
  if(IN.passHeld&&!LC.prevPass&&!LC.charging&&free){LC.charging='pass';LC.power=0;}
  LC.prevShoot=IN.shootHeld;LC.prevPass=IN.passHeld;
  if(LC.charging==='shot'){
    LC.power=Math.min(1,LC.power+dt/0.9);
    if(IN.curveAbs){LC.cx=IN.curveAbs[0];LC.cy=IN.curveAbs[1];}else{LC.cx=clamp(LC.cx+IN.cdx,-1,1);LC.cy=clamp(LC.cy+IN.cdy,-1,1);}
    if(!IN.shootHeld){LC.req={k:'shot',pw:LC.power,cx:LC.cx,cy:LC.cy,lob:IN.lob,tgt:aimTarget(p),dir:aimFlatDir()};LC.reqT=0.3;LC.charging=null;}
  }else if(LC.charging==='pass'){
    LC.power=Math.min(1,LC.power+dt/0.7);
    if(!IN.passHeld){LC.req={k:'pass',pw:LC.power,lob:IN.lob,tgt:aimTarget(p),dir:wm>0.3?dir:aimFlatDir()};LC.reqT=0.3;LC.charging=null;}
  }
  if(!free&&LC.charging)LC.charging=null;
  p.charge=LC.charging?LC.power*(LC.charging==='pass'?0.6:1):0;
  if(q.effort&&p.eff>=100&&p.effort<=0){p.effort=STAM.EFF_TIME;p.eff=0;sfxEffort();}
  if(q.push&&free){if(IN.lob)flickAct(p,ball,dir,fwd,wm,holding,emit);else pushAct(p,ball,dir,fwd,wm,holding,emit);}
  if(q.flick&&p.st===ST.run)flickAct(p,ball,dir,fwd,wm,holding,emit);
  if(q.tackle&&p.st===ST.run)tackleAct(p,ball,holding);
  if(q.block&&p.st===ST.run&&!holding)setSt(p,ST.block);
  movePlayer(p,{mx:wx,mz:wz,sprint:IN.sprint,charging:!!LC.charging,stance:IN.stance,faceTo:[ball.x,ball.z]},dt,holding);
  if(LC.req){
    LC.reqT-=dt;const r=LC.req,contact=kickContact(p,ball);
    if(contact&&p.st!==ST.dive&&p.st!==ST.slide&&p.st!==ST.getup){
      let res,kk;const from={x:ball.x,y:ball.y,z:ball.z};
      if(ball.owner===p.i&&ball.hands){
        if(r.k==='shot'){res=shotVel({x:ball.x,y:0.6,z:ball.z},r.tgt,r.pw,{cx:r.cx,cy:r.cy},{});kk=KK.punt;}
        else{res=passVel(from,r.dir,r.pw,r.lob,mates);kk=KK.throw;}
      }else if(contact==='header'){res=headerVel(from,r.dir,r.k==='shot'?r.tgt:null,r.pw);kk=KK.header;setSt(p,ST.header);}
      else if(r.k==='shot'){res=shotVel(from,r.tgt,r.pw,{cx:r.cx,cy:r.cy},{air:contact==='volley',effort:p.effort>0,sprint:p.sprint,lob:r.lob});kk=contact==='volley'?KK.volley:r.lob?KK.lob:KK.shot;}
      else{res=passVel(from,r.dir,r.pw,r.lob,mates);kk=r.lob?KK.lob:KK.pass;}
      p.kickT=KICK_DUR;p.kk=kk;
      emit({t:'kick',kk,v:res.v,s:res.s,b:[ball.x,ball.y,ball.z]});
      LC.req=null;
    }else if(LC.reqT<=0)LC.req=null;
  }
  LC.intentT-=dt;
  if(ball.owner<0){
    const intent=LC.intentT>0?LC.intent:(IN.stance?'stance':null);
    const ev=tryReceive(p,ball,intent,dir);
    if(ev){if(ev.kk!==undefined){p.kickT=KICK_DUR*0.6;p.kk=ev.kk;if(ev.kk===KK.flick)setSt(p,ST.flick,FL.up);}LC.intentT=0;emit(ev);}
  }
}
function pushAct(p,ball,dir,fwd,wm,holding,emit){
  if(holding&&ball.hands){emit({t:'drop'});return;}
  if(holding&&IN.stance){
    const side=dir[0]*fwd[1]-dir[1]*fwd[0],fw=dir[0]*fwd[0]+dir[1]*fwd[1];
    if(wm<0.3||fw>0.5){setSt(p,ST.skill,SK.roulette);p.dvx=fwd[0];p.dvz=fwd[1];}
    else if(fw<-0.5)setSt(p,ST.skill,SK.drag);
    else{setSt(p,ST.skill,SK.chop);p.dvx=dir[0];p.dvz=dir[1];}
    void side;return;
  }
  if(holding){const ahead=(ball.x-p.x)*fwd[0]+(ball.z-p.z)*fwd[1],perfect=ahead>0.25&&ahead<0.85;const r=pushVel(p,dir,perfect);
    p.kickT=KICK_DUR*0.6;p.kk=KK.push;emit({t:'kick',kk:KK.push,v:r.v,s:r.s,b:[ball.x,ball.y,ball.z]});if(perfect)G.perfectT=0.8;return;}
  if(p.gk&&inBox(p.x,p.z,p.team)){let d=dir;if(wm<0.3){const dx=ball.x-p.x,dz=ball.z-p.z,l=hyp(dx,dz)||1;d=[dx/l,dz/l];}setSt(p,ST.dive,IN.lob?1:0);p.dvx=d[0];p.dvz=d[1];return;}
  if(IN.stance){setSt(p,ST.dash);p.dvx=dir[0];p.dvz=dir[1];return;}
  LC.intent='push';LC.intentT=0.28;
  const lb=hyp(ball.x-p.x,ball.z-p.z);
  if(ball.owner<0&&lb<CTRL.REACH&&lb>0.9&&ball.y<1.4){p.face=Math.atan2(ball.x-p.x,ball.z-p.z);setSt(p,ST.tackle,1);}
}
function flickAct(p,ball,dir,fwd,wm,holding,emit){
  if(holding&&!ball.hands){const fw=dir[0]*fwd[0]+dir[1]*fwd[1],v=wm<0.3?FL.up:fw>0.5?FL.rainbow:fw<-0.5?FL.turn:FL.up;
    const r=flickVel(p,v);setSt(p,ST.flick,v);emit({t:'kick',kk:KK.flick,v:r.v,s:r.s,b:[ball.x,ball.y,ball.z]});return;}
  LC.intent='flick';LC.intentT=0.28;
}
function tackleAct(p,ball,holding){
  if(holding)return;
  if(p.gk&&inBox(p.x,p.z,p.team)){p.face=Math.atan2(ball.x-p.x,ball.z-p.z);setSt(p,ST.rush);return;}
  if(p.sprint){setSt(p,ST.slide);p.stam=Math.max(0,p.stam-STAM.SLIDE);}else setSt(p,ST.tackle,0);
}

// ================= matches =================
function inMatch(){return G.mode==='practice'||G.mode==='host'||G.mode==='client';}
function startPractice(){
  const players=[{team:0,name:myName(),ctrl:{type:'local'}},{team:1,name:'Keeper',ctrl:{type:'ai'},aiGK:true}];
  G.S=createMatch({players,len:99999,practice:true});G.myIdx=0;
  const me=G.S.players[0];me.x=0;me.z=12;me.face=0;G.S.ball.x=0;G.S.ball.z=13;
  enterMatch('practice');
  hud.hint.hidden=false;hud.hint.textContent=G.touchUsed?'Aim with the right side · hold Shoot for power, slide to curve':'Click to lock the mouse · hold left click to shoot, move the mouse to curve · R brings the ball back';
  setTimeout(()=>{hud.hint.hidden=true;},9000);
}
$('practiceBtn').onclick=()=>{ensureAudio();startPractice();};
function enterMatch(mode){
  G.mode=mode;G.paused=false;G.acc=0;G.lastPhase='';G.lastGoalSeq=-1;G.lastTouchSeq=-1;resetClient();
  LC.charging=null;LC.req=null;
  hideScreens();$('hud').hidden=false;setBanner('','');$('netinfo').hidden=mode==='practice';
  const me=G.myIdx>=0&&G.S?G.S.players[G.myIdx]:null;CAM.yaw=me&&me.team===1?Math.PI:0;CAM.pitch=-0.035;
  canvas.focus();
}
function togglePause(){
  if(!inMatch())return;const sc=$('sc-pause');
  if(sc.hidden){if(G.mode==='practice')G.paused=true;$('pauseTitle').textContent=G.mode==='practice'?'Paused':'Match menu';$('resumeBtn').textContent=G.mode==='practice'?'Resume':'Back to match';show('sc-pause');}
  else{G.paused=false;hideScreens();}
}
$('pauseBtn').onclick=togglePause;$('resumeBtn').onclick=()=>{G.paused=false;hideScreens();canvas.focus();};
$('quitBtn').onclick=()=>quitToMenu();
function quitToMenu(){
  if(G.mode==='host'||G.mode==='client'||G.mode==='lobby')netLeave();
  G.mode='menu';G.S=null;G.myIdx=-1;G.paused=false;$('hud').hidden=true;rigKey='';show('sc-main');
}
document.addEventListener('visibilitychange',()=>{if(document.hidden&&G.mode==='practice'&&!G.paused)togglePause();});
function showEnd(v){
  const me=G.myIdx>=0?v.players[G.myIdx]:null,myT=me?me.team:-1;
  $('resultText').textContent=v.winner===-1?'Draw':myT===-1?(v.winner===0?'Blue wins':'Coral wins'):(v.winner===myT?'You win':'You lose');
  $('resultText').style.color=v.winner===0?'#4f7cff':v.winner===1?'#ff6b57':'';
  $('fs0').textContent=v.score[0];$('fs1').textContent=v.score[1];
  const ul=$('statsList');ul.innerHTML='';
  v.players.slice().sort((a,b)=>(b.goals||0)-(a.goals||0)).forEach(p=>{if(!p.goals)return;const li=document.createElement('li');li.textContent=p.name+' · '+p.goals+(p.goals===1?' goal':' goals');ul.appendChild(li);});
  const client=G.mode==='client';
  $('rematchBtn').hidden=client;$('endMenuBtn').textContent=G.mode==='host'?'Back to lobby':client?'Leave match':'Menu';
  $('endStatus').textContent=client?'Waiting for the host to start the next match.':'';
  show('sc-end');
}
$('rematchBtn').onclick=()=>{if(G.mode==='host')hostStart();};
$('endMenuBtn').onclick=()=>{if(G.mode==='host')hostToLobby();else quitToMenu();};

// ================= online =================
function makeWsRoomApi(){
  return {join(name){return new Promise((resolve,reject)=>{
    let ws;try{ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws');}catch(e){reject({code:'upstream_error'});return;}
    let me=null,peers=new Map(),peerH=[],topicH=new Map(),errH=[],open=false,done=false,closed=false,cur=[],pending=false;
    const snap=()=>[...peers].map(([p,pr])=>({peer:p,presence:pr,isMe:p===me,sameTab:p===me}));
    const fire=()=>{pending=false;cur=snap();for(const h of peerH.slice()){try{h({peers:cur});}catch(e){console.error(e);}}};
    const schedule=()=>{if(pending)return;pending=true;setTimeout(fire,0);};
    const timer=setTimeout(()=>{if(!done){done=true;try{ws.close();}catch(_){}reject({code:'upstream_error'});}},12000);
    ws.onopen=()=>ws.send(JSON.stringify({t:'join',room:name}));
    ws.onmessage=ev=>{let m;try{m=JSON.parse(ev.data);}catch(_){return;}
      if(m.t==='joined'){me=m.you;peers=new Map((m.peers||[]).map(p=>[p.peer,p.presence||{}]));open=true;done=true;clearTimeout(timer);cur=snap();resolve(room);schedule();}
      else if(m.t==='err'){if(!done){done=true;clearTimeout(timer);reject({code:m.code||'upstream_error'});}}
      else if(m.t==='pj'||m.t==='pu'){peers.set(m.peer,m.presence||{});schedule();}
      else if(m.t==='pl'){peers.delete(m.peer);schedule();}
      else if(m.t==='ev'){const hs=topicH.get(m.topic);if(hs)for(const h of hs){try{h({topic:m.topic,data:m.data,peer:m.peer,isMe:m.peer===me,sameTab:m.peer===me});}catch(e){console.error(e);}}}};
    ws.onerror=()=>{};
    ws.onclose=()=>{open=false;if(!done){done=true;clearTimeout(timer);reject({code:'upstream_error'});return;}if(closed)return;for(const h of errH){try{h({code:'upstream_error'});}catch(_){}}peers=new Map(me?[[me,{}]]:[]);schedule();};
    const room={name,emit(topic,data){if(open)ws.send(JSON.stringify({t:'emit',topic,data}));return Promise.resolve();},
      on(topic,h,onErr){if(!topicH.has(topic))topicH.set(topic,new Set());topicH.get(topic).add(h);if(onErr)errH.push(onErr);return()=>{const s=topicH.get(topic);if(s)s.delete(h);};},
      presence(patch){if(open)ws.send(JSON.stringify({t:'pres',patch}));return Promise.resolve();},peers:()=>cur,
      onPeers(h,onErr){peerH.push(h);if(onErr)errH.push(onErr);setTimeout(()=>{try{h({peers:cur});}catch(e){}},0);return()=>{peerH=peerH.filter(x=>x!==h);};},
      leave(){closed=true;open=false;try{ws.close();}catch(_){}return Promise.resolve();}};
  });}};
}
const NET={api:null,r:null,code:'',isHost:false,me:null,hostPeer:null,lob:null,peers:[],unsub:[],snaps:[],offs:[],delay:0,sendAcc:0,seenHost:false,hostGoneT:0};
(async()=>{
  try{
    if(window.claude&&typeof window.claude.use==='function')NET.api=await window.claude.use('room');
    else if(typeof WebSocket!=='undefined'&&/^https?:$/.test(location.protocol))NET.api=makeWsRoomApi();
  }catch(e){NET.api=null;}
  updateOnlineAvail();
})();
function updateOnlineAvail(){const ok=!!NET.api;$('createBtn').disabled=!ok;$('joinBtn').disabled=!ok;$('onlineStatus').textContent=ok?'':'Online play isn\'t available here. Practice still works.';}
updateOnlineAvail();
function genCode(){const A='ABCDEFGHJKMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<5;i++)s+=A[Math.floor(Math.random()*A.length)];return s;}
async function netJoin(code,asHost){
  if(!NET.api)return;$('onlineStatus').textContent=asHost?'Creating match…':'Joining…';
  try{
    const r=await NET.api.join('rfc-'+code.toLowerCase());
    Object.assign(NET,{r,code,isHost:asHost,me:null,hostPeer:null,seenHost:false,hostGoneT:0,snaps:[],offs:[],delay:0,unsub:[]});
    NET.lob=asHost?{ph:'lobby',sz:2,len:360,gid:0,sl:[]}:null;
    NET.unsub.push(r.onPeers(onPeersChange,()=>{$('lobbyStatus').textContent='Connection to the match was lost.';}));
    NET.unsub.push(r.on('st',onSnap));
    await r.presence(asHost?{nm:myName(),host:1,lob:NET.lob}:{nm:myName()});
    G.mode='lobby';$('hud').hidden=true;$('codeShow').textContent=code;$('onlineStatus').textContent='';
    renderLobby();show('sc-lobby');
    if(!asHost&&NET.lob&&NET.lob.ph==='play'){NET.snaps=[];G.S=null;G.myIdx=-1;enterMatch('client');}
  }catch(e){$('onlineStatus').textContent=e&&e.code==='limit_reached'?'That match is full.':'Couldn\'t reach the game server. Wait a few seconds and try again.';}
}
function netLeave(){NET.unsub.forEach(u=>{try{u();}catch(_){}});NET.unsub=[];if(NET.r)NET.r.leave().catch(()=>{});Object.assign(NET,{r:null,isHost:false,lob:null,hostPeer:null,snaps:[]});}
$('createBtn').onclick=()=>{ensureAudio();netJoin(genCode(),true);};
$('joinBtn').onclick=()=>{ensureAudio();const c=$('codeIn').value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');if(c.length!==5){$('onlineStatus').textContent='Codes are 5 letters or numbers.';return;}netJoin(c,false);};
$('codeIn').addEventListener('keydown',e=>{if(e.key==='Enter')$('joinBtn').click();});
$('leaveBtn').onclick=()=>quitToMenu();
$('copyCode').onclick=async()=>{try{await navigator.clipboard.writeText(NET.code);$('copyCode').textContent='Copied';}catch(e){const r=document.createRange();r.selectNodeContents($('codeShow'));const s=getSelection();s.removeAllRanges();s.addRange(r);$('copyCode').textContent='Selected';}setTimeout(()=>$('copyCode').textContent='Copy code',1500);};
function onPeersChange(ch){
  NET.peers=ch.peers;const meP=ch.peers.find(p=>p.isMe&&p.sameTab);if(meP)NET.me=meP.peer;
  if(NET.isHost){hostPeers(ch);return;}
  const h=ch.peers.find(p=>p.presence&&p.presence.host===1&&p.presence.lob&&!p.sameTab);
  if(h){NET.hostPeer=h.peer;NET.seenHost=true;NET.hostGoneT=0;clientLobby(h.presence.lob);}else if(NET.seenHost)NET.hostPeer=null;
  if(G.mode==='lobby')renderLobby();
}
function teamCount(t){return NET.lob.sl.filter(s=>s.t===t).length;}
function hostPeers(ch){
  const lob=NET.lob;if(!lob)return;
  if(NET.me&&!lob.sl.find(s=>s.p===NET.me))lob.sl.unshift({p:NET.me,n:myName(),t:0});
  const present=new Set(ch.peers.map(p=>p.peer));
  const gone=lob.sl.filter(s=>!present.has(s.p));
  if(gone.length){lob.sl=lob.sl.filter(s=>present.has(s.p));
    if(G.S)for(const p of G.S.players)if(p.ctrl.type==='remote'&&gone.find(g=>g.p===p.ctrl.peer)){p.ctrl={type:'gone'};p.ext=false;p.gone=true;p.vx=p.vz=0;if(G.S.ball.owner===p.i){G.S.ball.owner=-1;G.S.ball.hands=false;}}}
  for(const p of ch.peers){
    if(p.sameTab||!p.presence||typeof p.presence.nm!=='string')continue;
    let s=lob.sl.find(x=>x.p===p.peer);const nm=cleanName(p.presence.nm);
    if(!s){s={p:p.peer,n:nm,t:-1};lob.sl.push(s);placeNew(s);}else s.n=nm;
    const wt=p.presence.wt;
    if((wt===0||wt===1)&&wt!==s.t&&lob.ph==='lobby'&&s.wq!==p.presence.wq){s.wq=p.presence.wq;if(teamCount(wt)<lob.sz)s.t=wt;}
  }
  rebalance();hostPublish();if(G.mode==='lobby')renderLobby();
}
function placeNew(s){
  const lob=NET.lob;
  if(lob.ph==='play'&&G.S){const free=G.S.players.find(p=>p.ctrl.type==='gone');if(free){free.ctrl={type:'remote',peer:s.p};free.name=s.n;free.gone=false;free.lastAct=0;s.t=free.team;rigKey='';return;}s.t=-1;return;}
  const a=teamCount(0),b=teamCount(1);s.t=a<=b?(a<lob.sz?0:(b<lob.sz?1:-1)):(b<lob.sz?1:(a<lob.sz?0:-1));
}
function rebalance(){const lob=NET.lob;if(!lob||lob.ph!=='lobby')return;
  for(const t of [0,1]){const on=lob.sl.filter(s=>s.t===t);while(on.length>lob.sz)on.pop().t=-1;}
  for(const s of lob.sl)if(s.t===-1){if(teamCount(0)<lob.sz)s.t=0;else if(teamCount(1)<lob.sz)s.t=1;}}
function hostPublish(){if(!NET.r||!NET.lob)return;const l=NET.lob;NET.r.presence({nm:myName(),host:1,lob:{ph:l.ph,sz:l.sz,len:l.len,gid:l.gid,sl:l.sl.map(s=>({p:s.p,n:s.n,t:s.t}))}}).catch(()=>{});}
function clientLobby(lob){
  if(!lob||typeof lob!=='object')return;
  NET.lob={ph:lob.ph==='play'?'play':'lobby',sz:clamp(Number(lob.sz)||2,1,4),len:Number(lob.len)||360,gid:Number(lob.gid)||0,
    sl:Array.isArray(lob.sl)?lob.sl.slice(0,16).map(s=>({p:String(s&&s.p||''),n:cleanName(s&&s.n),t:s&&(s.t===0||s.t===1)?s.t:-1})):[]};
  if(NET.lob.ph==='play'&&G.mode==='lobby'){NET.snaps=[];G.S=null;G.myIdx=-1;enterMatch('client');}
  else if(NET.lob.ph==='lobby'&&G.mode==='client'){G.mode='lobby';$('hud').hidden=true;rigKey='';renderLobby();show('sc-lobby');}
  syncSegs();
}
function syncSegs(){document.querySelectorAll('#hostOpts .seg').forEach(seg=>{const v=NET.lob?NET.lob[seg.dataset.key]:null;seg.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(String(v)===b.dataset.v)));});}
document.querySelectorAll('#hostOpts .seg').forEach(seg=>seg.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!NET.isHost||!NET.lob)return;NET.lob[seg.dataset.key]=Number(b.dataset.v);rebalance();hostPublish();renderLobby();}));
function renderLobby(){
  const lob=NET.lob;$('hostOpts').hidden=!NET.isHost;$('startOnline').hidden=!NET.isHost;
  if(!lob){$('team0').innerHTML='';$('team1').innerHTML='';$('lobbyStatus').textContent=NET.seenHost?'The host left this match.':'Looking for the host… Check the code is right.';return;}
  for(const t of [0,1]){const ul=$('team'+t);ul.innerHTML='';const on=lob.sl.filter(s=>s.t===t);
    on.forEach(s=>{const li=document.createElement('li');li.textContent=s.n;if(s.p===NET.me){const y=document.createElement('span');y.className='you';y.textContent='YOU';li.appendChild(y);}ul.appendChild(li);});
    for(let i=on.length;i<lob.sz;i++){const li=document.createElement('li');li.className='open';li.textContent='Open spot';ul.appendChild(li);}
    if(lob.sz===1){const li=document.createElement('li');li.className='ai';li.textContent='AI keeper';ul.appendChild(li);}}
  const spec=lob.sl.filter(s=>s.t===-1);$('specLine').hidden=!spec.length;$('specLine').textContent=spec.length?'Watching: '+spec.map(s=>s.n).join(', '):'';
  $('lobbyStatus').textContent=NET.isHost?'Send your friends the code. Uneven teams are fine.':(NET.hostPeer?'Waiting for the host to start.':(NET.seenHost?'The host left this match.':'Looking for the host…'));
  syncSegs();
}
let wq=0;
$('switchBtn').onclick=()=>{if(!NET.lob||!NET.r)return;const mine=NET.lob.sl.find(s=>s.p===NET.me),want=mine&&mine.t===0?1:0;
  if(NET.isHost){if(mine&&teamCount(want)<NET.lob.sz){mine.t=want;hostPublish();renderLobby();}else $('lobbyStatus').textContent='That team is full.';return;}
  wq++;NET.r.presence({nm:myName(),wt:want,wq}).catch(()=>{});};
$('startOnline').onclick=()=>hostStart();
function hostStart(){
  const lob=NET.lob;if(!NET.isHost||!lob)return;
  const t0=lob.sl.filter(s=>s.t===0),t1=lob.sl.filter(s=>s.t===1);
  if(!t0.length||!t1.length){$('lobbyStatus').textContent='Each team needs at least one player.';show('sc-lobby');G.mode='lobby';return;}
  const players=[];
  for(const [t,arr] of [[0,t0],[1,t1]]){arr.forEach(s=>players.push({team:t,name:s.n,ctrl:s.p===NET.me?{type:'local'}:{type:'remote',peer:s.p}}));
    if(lob.sz===1)players.push({team:t,name:'Keeper',ctrl:{type:'ai'},aiGK:true});}
  G.S=createMatch({players,len:lob.len,size:lob.sz});G.myIdx=G.S.players.findIndex(p=>p.ctrl.type==='local');
  lob.ph='play';lob.gid++;hostPublish();NET.sendAcc=0;enterMatch('host');
}
function hostToLobby(){if(!NET.lob)return;NET.lob.ph='lobby';rebalance();hostPublish();G.S=null;G.mode='lobby';$('hud').hidden=true;rigKey='';renderLobby();show('sc-lobby');}

// ---------- snapshots (host -> everyone, 30 a second) ----------
const PH=['count','play','goal','end'];
const q2=v=>Math.round(v*100)/100;
const pflags=p=>(p.sprint?1:0)|(p.gk?2:0)|(p.stance?4:0)|(p.aiGK?8:0)|(p.effort>0?16:0)|(p.gone?32:0)|(p.stamLock?64:0);
function encode(S){
  const b=S.ball;
  return {ht:Math.round(performance.now()),ph:PH.indexOf(S.phase),tm:q2(S.timer),c:Math.round(S.clock*10),ot:S.ot?1:0,sc:S.score,gs:S.goalSeq,gt:S.goalTeam,sr:S.scorer,w:S.winner,ep:S.epoch,ts:S.touchSeq,tp:Math.round(S.touchPow),
    b:[q2(b.x),q2(b.y),q2(b.z),q2(b.vx),q2(b.vy),q2(b.vz),q2(b.sx),q2(b.sy),b.owner,b.hands?1:0],
    p:S.players.map(p=>[p.team,q2(p.x),q2(p.z),q2(p.vx),q2(p.vz),q2(p.face),p.st,q2(p.stT),p.sv,q2(p.kickT),p.kk,q2(p.charge),pflags(p),p.stunSeq,q2(p.dvx),q2(p.dvz)]),
    n:S.players.map(p=>[p.name,p.ctrl.type==='remote'?p.ctrl.peer:(p.ctrl.type==='local'?(NET.me||''):''),p.goals,p.ackT||0])};
}
function decode(d){
  if(!d||typeof d!=='object'||!Array.isArray(d.p)||!Array.isArray(d.b)||d.p.length>12)return null;
  const n=(v,def)=>typeof v==='number'&&isFinite(v)?v:def;
  const players=d.p.map((a,i)=>{const nm=Array.isArray(d.n)&&Array.isArray(d.n[i])?d.n[i]:[];const fl=n(a[12],0);
    return {i,team:a[0]===1?1:0,x:n(a[1],0),z:n(a[2],0),vx:n(a[3],0),vz:n(a[4],0),face:n(a[5],0),st:clamp(n(a[6],0)|0,0,11),stT:n(a[7],0),sv:n(a[8],0)|0,kickT:n(a[9],0),kk:n(a[10],0)|0,charge:clamp(n(a[11],0),0,1),
      sprint:!!(fl&1),gk:!!(fl&2),stance:!!(fl&4),aiGK:!!(fl&8),effort:fl&16?1:0,gone:!!(fl&32),stamLock:!!(fl&64),stunSeq:n(a[13],0),dvx:n(a[14],0),dvz:n(a[15],1),
      name:cleanName(nm[0]),p:typeof nm[1]==='string'?nm[1]:'',goals:n(nm[2],0),ack:n(nm[3],0)};});
  return {ht:n(d.ht,0),phase:PH[d.ph]||'play',timer:n(d.tm,0),clock:n(d.c,0)/10,ot:!!d.ot,score:Array.isArray(d.sc)?[n(d.sc[0],0),n(d.sc[1],0)]:[0,0],goalSeq:n(d.gs,0),goalTeam:n(d.gt,0),scorer:n(d.sr,-1),winner:n(d.w,-1),epoch:n(d.ep,0),touchSeq:n(d.ts,0),touchPow:n(d.tp,0),
    ball:{x:n(d.b[0],0),y:n(d.b[1],F.R),z:n(d.b[2],0),vx:n(d.b[3],0),vy:n(d.b[4],0),vz:n(d.b[5],0),sx:n(d.b[6],0),sy:n(d.b[7],0),owner:n(d.b[8],-1)|0,hands:d.b[9]===1},players};
}
function onSnap(msg){
  if(NET.isHost||msg.sameTab)return;if(NET.hostPeer&&msg.peer!==NET.hostPeer)return;
  const s=decode(msg.data);if(!s)return;const now=performance.now();
  if(s.ht>0){NET.offs.push(now-s.ht);if(NET.offs.length>90)NET.offs.shift();}
  const h=s.ht>0?s.ht:now,last=NET.snaps[NET.snaps.length-1];
  if(last&&h<=last.h){if(last.h-h>2000){NET.snaps=[];NET.offs=[];NET.delay=0;}else return;}
  NET.snaps.push({t:now,h,s});if(NET.snaps.length>30)NET.snaps.shift();
}
function netTiming(){const o=NET.offs;if(!o.length)return {min:0,delay:100};const so=o.slice().sort((a,b)=>a-b),mn=so[0],p90=so[Math.floor((so.length-1)*0.9)];
  const target=clamp(p90-mn+40,50,250);NET.delay=NET.delay?NET.delay+(target-NET.delay)*0.03:target;return {min:mn,delay:NET.delay};}
const lerp=(a,b,t)=>a+(b-a)*t;
function clientView(){
  const sn=NET.snaps;if(!sn.length)return null;
  const tm=netTiming(),rt=performance.now()-tm.min-tm.delay;
  let a=null,b=null;for(let i=sn.length-1;i>0;i--){if(sn[i-1].h<=rt){a=sn[i-1];b=sn[i];break;}}
  if(!a)return sn[0].s;
  if(rt>=b.h){const ex=Math.min(0.2,(rt-b.h)/1000),v=Object.assign({},b.s);v.players=b.s.players.map(p=>Object.assign({},p,{x:p.x+p.vx*ex,z:p.z+p.vz*ex,stT:p.stT+ex}));return v;}
  const t=clamp((rt-a.h)/((b.h-a.h)||1),0,1),A=a.s,B=b.s;if(A.players.length!==B.players.length)return B;
  const v=Object.assign({},B);
  v.ball=Object.assign({},B.ball,{x:lerp(A.ball.x,B.ball.x,t),y:lerp(A.ball.y,B.ball.y,t),z:lerp(A.ball.z,B.ball.z,t)});
  if(B.phase==='count'&&A.phase!=='count')v.ball=B.ball;
  v.players=B.players.map((pb,i)=>{const pa=A.players[i];if(hyp(pb.x-pa.x,pb.z-pa.z)>5)return pb;
    return Object.assign({},pb,{x:lerp(pa.x,pb.x,t),z:lerp(pa.z,pb.z,t),face:pa.face+wrapA(pb.face-pa.face)*t,stT:pa.st===pb.st?lerp(pa.stT,pb.stT,t):pb.stT,kickT:lerp(pa.kickT,pb.kickT,t),charge:lerp(pa.charge,pb.charge,t)});});
  return v;
}

// ---------- your player and the ball when someone else hosts ----------
// Everything you do happens on your screen straight away; the host is told afterwards.
const CL={p:null,ep:-1,idx:-1,acc:0,seq:0,actSeq:0,acts:[],sendAcc:0,ping:0,ball:null,mode:'srv',since:0,stunSeen:-1};
function resetClient(){Object.assign(CL,{p:null,ep:-1,idx:-1,acc:0,acts:[],sendAcc:0,ping:0,ball:null,mode:'srv',since:0,stunSeen:-1});}
function clientFrame(v,latest,lastArrival,lastH,dt,q){
  const me=latest.players[G.myIdx];if(!me)return;
  const now=performance.now();
  if(!CL.p||CL.ep!==latest.epoch||latest.phase==='count'||CL.idx!==G.myIdx){
    if(CL.idx===-1)CAM.yaw=me.team===1?Math.PI:0;
    const keep=CL.p?{stam:CL.p.stam,eff:CL.p.eff}:{};
    CL.p=Object.assign(newPlayer({team:me.team,name:me.name,ctrl:{type:'local'}},G.myIdx),{x:me.x,z:me.z,face:me.face},latest.phase==='count'?{}:keep);
    CL.ep=latest.epoch;CL.idx=G.myIdx;CL.acc=0;CL.mode='srv';CL.ball=null;
  }
  const p=CL.p;
  const teamAI=v.players.some(o=>o.team===p.team&&o.aiGK);
  const mateGK=v.players.some(o=>o.i!==G.myIdx&&o.team===p.team&&o.gk&&inBox(o.x,o.z,o.team));
  p.gk=!teamAI&&inBox(p.x,p.z,p.team)&&(me.gk||!mateGK||p.gk);
  if(CL.stunSeen===-1)CL.stunSeen=me.stunSeq;
  if(me.stunSeq!==CL.stunSeen){CL.stunSeen=me.stunSeq;p.stun=0.6;p.cd=0.45;if(CL.mode==='own')CL.mode='srv';}
  const sb=latest.ball;
  if(!CL.ball)CL.ball=Object.assign({},sb);
  const B=CL.ball;
  if(CL.mode==='own'){if(sb.owner===G.myIdx)CL.since=now;else if(now-CL.since>CL.ping+350)CL.mode='srv';}
  if(CL.mode==='kick'&&(now-CL.since>CL.ping+320||(sb.owner>=0&&sb.owner!==G.myIdx&&now-CL.since>CL.ping+120)))CL.mode='srv';
  if(CL.mode==='srv'){
    if(sb.owner===G.myIdx){CL.mode='own';CL.since=now;B.hands=sb.hands;}
    let tx,ty,tz;
    if(sb.owner>=0){tx=v.ball.x;ty=v.ball.y;tz=v.ball.z;}
    else{const tm=netTiming(),ahead=clamp((now-tm.min-lastH)/1000+CL.ping/2000,0,0.25);
      const tmp={x:sb.x,y:sb.y,z:sb.z,vx:sb.vx,vy:sb.vy,vz:sb.vz,sx:sb.sx,sy:sb.sy};for(let t=0;t<ahead;t+=F.DT)stepBall(tmp,F.DT);
      tx=tmp.x;ty=tmp.y;tz=tmp.z;B.vx=tmp.vx;B.vy=tmp.vy;B.vz=tmp.vz;B.sx=tmp.sx;B.sy=tmp.sy;}
    if(Math.hypot(B.x-tx,B.y-ty,B.z-tz)>4){B.x=tx;B.y=ty;B.z=tz;}
    else{const k=1-Math.exp(-14*dt);B.x+=(tx-B.x)*k;B.y+=(ty-B.y)*k;B.z+=(tz-B.z)*k;}
    B.owner=sb.owner===G.myIdx?-1:sb.owner;B.hands=sb.hands;
  }
  const frozen=latest.phase==='count'||latest.phase==='end';
  const mates=v.players.filter((m,i)=>i!==G.myIdx&&m.team===p.team);
  CL.acc+=dt;let k=0,qq=q;
  while(CL.acc>=F.DT&&k<8){
    if(CL.mode==='own'){B.owner=G.myIdx;if(dribbleBall(B,p,F.DT,G.time)){CL.mode='kick';CL.since=now;B.owner=-1;}}
    else if(CL.mode==='kick'){B.owner=-1;stepBall(B,F.DT);}
    controlStep(p,B,mates,F.DT,ev=>clientEvent(p,B,ev,now),frozen,qq);qq=EMPTYQ;
    for(const o of v.players){if(o.i===G.myIdx||o.gone)continue;const dx=p.x-o.x,dz=p.z-o.z,d=hyp(dx,dz);if(d<0.8&&d>1e-3){const push=(0.8-d)*0.5;p.x+=dx/d*push;p.z+=dz/d*push;}}
    if(p.gk&&B.owner===G.myIdx&&B.hands){p.holdT+=F.DT;if(p.holdT>6||!inBox(p.x,p.z,p.team))clientEvent(p,B,{t:'drop'},now);}
    CL.acc-=F.DT;k++;
  }
  if(k>=8)CL.acc=0;
  v.players=v.players.slice();
  v.players[G.myIdx]=Object.assign({},v.players[G.myIdx],{x:p.x,z:p.z,vx:p.vx,vz:p.vz,face:p.face,st:p.st,stT:p.stT,sv:p.sv,kickT:p.kickT,kk:p.kk,charge:p.charge,sprint:p.sprint,stance:p.stance,gk:p.gk,dvx:p.dvx,dvz:p.dvz,stam:p.stam,eff:p.eff,effort:p.effort,stamLock:p.stamLock,i:G.myIdx});
  v.ball=Object.assign({},v.ball,{x:B.x,y:B.y,z:B.z,sx:B.sx,owner:CL.mode==='own'?G.myIdx:sb.owner===G.myIdx?-1:sb.owner,hands:CL.mode==='own'?B.hands:sb.hands});
  CL.sendAcc+=dt;
  if(CL.sendAcc>=0.033&&NET.r){CL.sendAcc=0;CL.seq++;
    NET.r.presence({ps:[q2(p.x),q2(p.z),q2(p.vx),q2(p.vz),q2(p.face),p.st,q2(p.stT),p.sv,q2(p.kickT),p.kk,q2(p.charge),pflags(p),CL.ep,CL.seq,Math.round(now),q2(p.dvx),q2(p.dvz),Math.round(CL.ping)],ac:CL.acts}).catch(()=>{});}
  if(me.ack>0){const rtt=lastArrival-me.ack;if(rtt>0&&rtt<5000)CL.ping=CL.ping?CL.ping*0.9+rtt*0.1:rtt;}
}
const EMPTYQ={push:0,flick:0,tackle:0,block:0,effort:0,recall:0};
function clientEvent(p,B,ev,now){
  if(ev.t==='drop'){B.hands=false;p.holdT=0;CL.actSeq++;CL.acts.push([CL.actSeq,'x']);if(CL.acts.length>8)CL.acts.shift();return;}
  if(!applyTouch(B,p,ev))return;
  if(ev.t==='claim'){CL.mode='own';CL.since=now;B.owner=G.myIdx;}
  else{CL.mode='kick';CL.since=now;B.owner=-1;if(ev.t==='kick')sfxKick(Math.hypot(ev.v[0],ev.v[1],ev.v[2]));}
  CL.actSeq++;
  const a=ev.t==='claim'?[CL.actSeq,'c',ev.hand?1:0,q2(B.x),q2(B.y),q2(B.z)]:[CL.actSeq,ev.t==='kick'?'k':'d',q2(ev.v[0]),q2(ev.v[1]),q2(ev.v[2]),q2(ev.b?ev.b[0]:B.x),q2(ev.b?ev.b[1]:B.y),q2(ev.b?ev.b[2]:B.z),q2((ev.s||[0])[0]||0),q2((ev.s||[0,0])[1]||0),ev.kk|0];
  CL.acts.push(a);if(CL.acts.length>8)CL.acts.shift();
}
function hostReadRemotes(S){
  const by=new Map();for(const pe of NET.peers){const pr=pe.presence;if(pr&&Array.isArray(pr.ps)&&pr.ps.length===18)by.set(pe.peer,pr);}
  const n=(v,d)=>typeof v==='number'&&isFinite(v)?v:d;
  for(const p of S.players){
    if(p.ctrl.type!=='remote'){p.ext=false;continue;}
    const pr=by.get(p.ctrl.peer);if(!pr){p.ext=false;continue;}
    p.ext=true;const a=pr.ps;
    if(a[13]!==p.psSeq){p.psSeq=a[13];p.ackT=n(a[14],0);p.ping=clamp(n(a[17],0),0,800);
      if(a[12]===S.epoch&&S.phase!=='count'){
        p.x=clamp(n(a[0],p.x),-F.HW,F.HW);p.z=clamp(n(a[1],p.z),-F.HL-F.GD,F.HL+F.GD);p.vx=clamp(n(a[2],0),-12,12);p.vz=clamp(n(a[3],0),-12,12);
        p.face=wrapA(n(a[4],p.face));p.st=clamp(n(a[5],0)|0,0,11);p.stT=n(a[6],0);p.sv=n(a[7],0)|0;p.kickT=n(a[8],0);p.kk=n(a[9],0)|0;p.charge=clamp(n(a[10],0),0,1);
        const fl=n(a[11],0);p.sprint=!!(fl&1);p.stance=!!(fl&4);p.effort=fl&16?0.5:0;p.dvx=clamp(n(a[15],0),-1,1);p.dvz=clamp(n(a[16],1),-1,1);
      }}
    if(Array.isArray(pr.ac)){
      for(const ac of pr.ac){
        if(!Array.isArray(ac)||typeof ac[0]!=='number'||ac[0]<=p.lastAct)continue;p.lastAct=ac[0];
        if(a[12]!==S.epoch||S.phase!=='play')continue;
        const lat=Math.max(0.03,p.ping/2000);
        if(ac[1]==='c')hostEvent(S,p,{t:'claim',hand:ac[2]===1},lat);
        else if(ac[1]==='k'||ac[1]==='d')hostEvent(S,p,{t:ac[1]==='k'?'kick':'deflect',v:[n(ac[2],0),n(ac[3],0),n(ac[4],0)],b:[n(ac[5],0),n(ac[6],F.R),n(ac[7],0)],s:[n(ac[8],0),n(ac[9],0)],kk:n(ac[10],0)},lat);
        else if(ac[1]==='x')hostEvent(S,p,{t:'drop'},lat);
      }
    }
  }
}

// ================= main loop =================
let lastT=performance.now();
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(0.05,(now-lastT)/1000);lastT=now;G.time+=dt;
  readInput(dt);
  const q=takeQ();
  let v=null,me=null;
  if(G.mode==='practice'||G.mode==='host'){
    const S=G.S;
    if(S&&!G.paused){
      if(G.mode==='host')hostReadRemotes(S);
      const self=S.players[G.myIdx];
      if(q.recall&&S.practice&&self){Object.assign(S.ball,{x:self.x+Math.sin(self.face)*0.5,y:F.R,z:self.z+Math.cos(self.face)*0.5,vx:0,vy:0,vz:0,sx:0,sy:0,owner:self.i,hands:false});}
      G.acc+=dt;let k=0,qq=q;
      while(G.acc>=F.DT&&k<8){
        if(self){
          const mates=S.players.filter(m=>m!==self&&m.team===self.team&&!m.gone);
          const frozen=S.phase==='count'||S.phase==='end';
          controlStep(self,S.ball,mates,F.DT,ev=>{if(hostEvent(S,self,ev,0)&&ev.t==='kick')sfxKick(Math.hypot(ev.v[0],ev.v[1],ev.v[2]));},frozen,qq);qq=EMPTYQ;
          for(const o of S.players){if(o===self||o.gone)continue;const dx=self.x-o.x,dz=self.z-o.z,d=hyp(dx,dz);if(d<0.8&&d>1e-3){const push=(0.8-d)*0.5;self.x+=dx/d*push;self.z+=dz/d*push;}}
        }
        stepMatch(S,F.DT,G.time);
        if(S.practice&&S.phase==='goal'&&S.timer<1.6){S.phase='play';const s=S.players[G.myIdx];Object.assign(S.ball,{x:s.x+Math.sin(s.face)*0.5,y:F.R,z:s.z+Math.cos(s.face)*0.5,vx:0,vy:0,vz:0,sx:0,sy:0,owner:s.i,hands:false});}
        G.acc-=F.DT;k++;
      }
      if(k>=8)G.acc=0;
      if(G.mode==='host'&&NET.r){NET.sendAcc+=dt;if(NET.sendAcc>=0.033){NET.sendAcc=0;NET.r.emit('st',encode(S)).catch(()=>{});}}
    }
    v=S;me=S?S.players[G.myIdx]:null;
    if(G.mode==='host'){$('netinfo').hidden=false;$('netinfo').textContent='Hosting · '+NET.code;}
  }else if(G.mode==='client'){
    v=clientView();
    if(v){
      const last=NET.snaps[NET.snaps.length-1];
      G.myIdx=NET.me?v.players.findIndex(p=>p.p===NET.me):-1;
      if(G.myIdx>=0){clientFrame(v,last.s,last.t,last.h,dt,q);me=v.players[G.myIdx];}else CL.p=null;
    }
    if(!NET.hostPeer&&NET.seenHost){NET.hostGoneT+=dt;if(NET.hostGoneT>3){quitToMenu();show('sc-online');$('onlineStatus').textContent='The host left the match.';return;}}
    $('netinfo').hidden=false;$('netinfo').textContent=(G.myIdx>=0?'Online · ':'Watching · ')+NET.code+(CL.ping?' · '+Math.round(CL.ping)+' ms':'');
  }else{
    if(!G.demo)G.demo=makeDemo();
    const d=G.demo;G.acc+=dt;let k=0;while(G.acc>=F.DT&&k<8){demoStep(d,F.DT);G.acc-=F.DT;k++;}if(k>=8)G.acc=0;v=d;
  }
  if(v&&renderer){
    if(v.touchSeq!==G.lastTouchSeq){if(G.lastTouchSeq!==-1&&G.mode==='client'&&performance.now()-CL.since>CL.ping+250)sfxKick(v.touchPow||8);G.lastTouchSeq=v.touchSeq;}
    renderView(v,dt);updateCamera(v,dt,me);
    if(inMatch()){updateHUD(v,dt,me);
      if(v.phase==='end'&&$('sc-end').hidden&&$('sc-pause').hidden)showEnd(v);
      if(v.phase!=='end'&&!$('sc-end').hidden)hideScreens();}
    renderer.render(scene,camera);
  }
}
// a kickabout behind the menus
function makeDemo(){
  const players=[{team:0,name:'Keeper',ctrl:{type:'ai'},aiGK:true},{team:1,name:'Keeper',ctrl:{type:'ai'},aiGK:true}];
  const S=createMatch({players,len:99999,practice:true});S.phase='play';S.demoT=0;return S;
}
function demoStep(S,dt){
  S.demoT-=dt;
  if(S.demoT<=0&&S.ball.owner<0){S.demoT=2.6+Math.random()*1.5;const b=S.ball,toward=b.z>0?1:-1;
    const r=shotVel({x:b.x,y:b.y,z:b.z},{x:(Math.random()-.5)*F.GW,y:0.4+Math.random()*1.6,z:toward*F.HL},0.4+Math.random()*0.5,{cx:(Math.random()-.5)*1.6,cy:0},{});
    b.vx=r.v[0];b.vy=r.v[1];b.vz=r.v[2];b.sx=r.s[0];b.sy=r.s[1];S.touchSeq++;}
  stepMatch(S,dt,G.time);
  if(S.phase==='goal'){S.phase='play';Object.assign(S.ball,newBall());S.ball.z=(Math.random()-.5)*20;}
}
if(hasThree){initScene();requestAnimationFrame(frame);}
else document.body.insertAdjacentHTML('beforeend','<div class="screen"><div class="panel"><h2>Could not load the 3D engine</h2><p class="note">Check your internet connection and reload the page.</p></div></div>');
