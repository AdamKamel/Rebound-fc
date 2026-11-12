/*SIM-START*/
// ---------- arena (metres). Rematch pitches are roughly 94 x 60 m. ----------
const F={HL:47,HW:30,CEIL:24,GW:7.32,GH:2.44,GD:2.4,BOXW:32,BOXD:14,R:0.22,G:9.81,DT:1/120};
const MOVE={JOG:5.6,SPRINT:8.3,EFFORT:9.6,STANCE:3.4,BALLMUL:0.94,ACC:10,TURN:12,TURN_SPRINT:7};
// Ball control: sprinting (or extra effort) makes every control value 40% worse:
// slower balls only, looser dribble (ball further ahead), softer stick, heavier touches.
const CTRL_SPRINT=0.6;
const CTRL={AUTO:7,TRAP:21,STICK:24,THROUGH:12,SPRING:16,LEAD:0.55,EXTRA_LEAD:0.22,WOBBLE:0.16,STANCE_LEAD:0.36,LOSE:2.4,REACH:2.3};
const STAM={DRAIN:6.5,REGEN:13,DELAY:0.7,SLIDE:14,EFF_RECHARGE:6.5,EFF_TIME:2.4};
const ST={run:0,slide:1,getup:2,dive:3,tackle:4,header:5,block:6,skill:7,flick:8,dash:9,stun:10,rush:11};
const DUR=[0,0.62,0.45,0.62,0.32,0.5,0.55,0.45,0.4,0.25,0.6,0.42];
const SK={roulette:0,chop:1,drag:2};
const SK_DUR=[0.45,0.28,0.36];
const FL={rainbow:0,turn:1,up:2};
const KK={shot:0,pass:1,lob:2,volley:3,throw:4,punt:5,push:6,header:7,flick:8};
const KICK_DUR=0.42;
const TIER_SPEED=[17,24,31];
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const wrapA=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;};
const hyp=(a,b)=>Math.sqrt(a*a+b*b);
const ease=u=>u<0.5?2*u*u:1-2*(1-u)*(1-u);
function ctrlOf(p){return (p.sprint||p.effort>0)?CTRL_SPRINT:1;}
function goalZ(team){return team===0?-F.HL:F.HL;}
function attackZ(team){return team===0?F.HL:-F.HL;}
function inBox(x,z,team){const gz=goalZ(team);return Math.abs(x)<F.BOXW/2&&Math.abs(z-gz)<F.BOXD;}
function inOwnHalf(p){return p.team===0?p.z<0:p.z>0;}
function shotTier(power){return power<0.34?0:power<0.67?1:2;}
function skillDur(sv){return SK_DUR[sv]||0.4;}
function jumpY(u,h){return u>0&&u<1?4*h*u*(1-u):0;}
function playerLift(p){
  if(p.st===ST.header)return jumpY(p.stT/DUR[ST.header],0.55);
  if(p.st===ST.block)return jumpY(p.stT/DUR[ST.block],0.65);
  return 0;
}
// roulette: the body spins a full turn while the ball stays under it
function rouletteYaw(p){return p.st===ST.skill&&p.sv===SK.roulette?-2*Math.PI*ease(clamp(p.stT/SK_DUR[0],0,1)):0;}

function newPlayer(o,i){
  return {i,team:o.team,name:o.name,ctrl:o.ctrl,aiGK:!!o.aiGK,x:0,y:0,z:0,vx:0,vz:0,face:0,
    st:0,stT:0,sv:0,kickT:0,kk:0,charge:0,sprint:false,stance:false,effort:0,eff:100,stam:100,stamT:0,stamLock:false,
    gk:false,holdT:0,cd:0,stun:0,stunSeq:0,boxT:0,goals:0,dvx:0,dvz:1,lastAct:0,ackT:0,ping:0,psSeq:-1,ext:false,gone:false,
    ai:{react:0,seen:0,hold:0,err:0,rushCd:0}};
}
function newBall(){return {x:0,y:F.R,z:0,vx:0,vy:0,vz:0,sx:0,sy:0,owner:-1,hands:false,post:0};}
function createMatch(cfg){
  const S={players:cfg.players.map((p,i)=>newPlayer(p,i)),ball:newBall(),score:[0,0],clock:cfg.len,len:cfg.len,
    phase:'count',timer:3,ot:false,epoch:0,goalSeq:0,goalTeam:-1,scorer:-1,lastTouch:[-1,-1],winner:-1,
    keeperRot:[0,0],touchSeq:0,touchPow:0,practice:!!cfg.practice,size:cfg.size||1,t:0};
  kickoff(S,true);return S;
}
const SPOTS=[[0,-7],[-12,-14],[12,-14],[0,-22],[-22,-24],[22,-24]];
function kickoff(S,first){
  for(const t of [0,1]){
    const team=S.players.filter(p=>p.team===t&&!p.gone);
    const humans=team.filter(p=>!p.aiGK);
    if(!first&&humans.length>1)S.keeperRot[t]=(S.keeperRot[t]+1)%humans.length;
    const ai=team.find(p=>p.aiGK);
    // the starting keeper rotates after every goal
    const keeper=ai||(humans.length>1?humans[S.keeperRot[t]%humans.length]:null);
    let k=0;
    for(const p of team){
      let x,z;
      if(p===keeper){x=0;z=-F.HL+1.5;}else{const s=SPOTS[k%SPOTS.length];x=s[0];z=s[1];k++;}
      if(t===1){x=-x;z=-z;}
      Object.assign(p,{x,y:0,z,vx:0,vz:0,face:t===0?0:Math.PI,st:0,stT:0,kickT:0,charge:0,sprint:false,stance:false,
        holdT:0,cd:0,stun:0,effort:0,stam:100,stamLock:false,gk:p===keeper||p.aiGK,boxT:p===keeper?1:0});
      p.ai.react=0;p.ai.seen=0;p.ai.hold=0;
    }
  }
  Object.assign(S.ball,newBall());
  S.phase='count';S.timer=3;S.epoch++;S.lastTouch=[-1,-1];
}
// Rotating keeper (Rematch rule): the first teammate to step into the box takes the gloves and
// keeps them until they leave it. AI keepers (1v1) are always the keeper.
function updateKeepers(S){
  for(const t of [0,1]){
    const team=S.players.filter(p=>p.team===t&&!p.gone);
    if(team.some(p=>p.aiGK)){for(const p of team)p.gk=p.aiGK;continue;}
    for(const p of team)p.boxT=inBox(p.x,p.z,t)?p.boxT+1:0;
    let cur=team.find(p=>p.gk&&p.boxT>0);
    if(!cur){let best=null;for(const p of team)if(p.boxT>0&&(!best||p.boxT>best.boxT))best=p;cur=best;}
    for(const p of team)p.gk=p===cur;
  }
}

// ---------- ball ----------
function segHit(b,ax,ay,az,bx,by,bz){
  const dx=bx-ax,dy=by-ay,dz=bz-az,L=dx*dx+dy*dy+dz*dz;
  let t=((b.x-ax)*dx+(b.y-ay)*dy+(b.z-az)*dz)/L;t=clamp(t,0,1);
  const px=ax+dx*t,py=ay+dy*t,pz=az+dz*t;let nx=b.x-px,ny=b.y-py,nz=b.z-pz;const d=Math.sqrt(nx*nx+ny*ny+nz*nz),rr=F.R+0.06;
  if(d>=rr||d<1e-6)return false;nx/=d;ny/=d;nz/=d;
  b.x=px+nx*rr;b.y=py+ny*rr;b.z=pz+nz*rr;
  const vn=b.vx*nx+b.vy*ny+b.vz*nz;if(vn<0){b.vx-=1.75*vn*nx;b.vy-=1.75*vn*ny;b.vz-=1.75*vn*nz;b.sx*=0.4;b.sy*=0.4;}
  return true;
}
// free=true: no walls/goals (used to predict curved shots)
function stepBall(b,dt,free){
  const R=F.R,gw=F.GW/2;
  const hs=hyp(b.vx,b.vz);
  if(hs>1&&(b.sx||b.sy)){
    // spin: side spin bends the ball (positive = to the left of travel), top spin dips it, back spin floats it
    const lx=b.vz/hs,lz=-b.vx/hs,a=0.32*hs;
    b.vx+=lx*b.sx*a*dt;b.vz+=lz*b.sx*a*dt;
    if(b.y>R+0.02)b.vy-=b.sy*0.2*hs*dt;
    const dec=Math.exp(-0.55*dt);b.sx*=dec;b.sy*=dec;
  }
  b.vy-=F.G*dt;
  const air=b.y>R+0.02;
  const dr=Math.exp(-(air?0.08:0.25)*dt);b.vx*=dr;b.vz*=dr;
  if(!air){const s=hyp(b.vx,b.vz);if(s>0){const dec=Math.min(s,0.9*dt);b.vx-=b.vx/s*dec;b.vz-=b.vz/s*dec;}}
  b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;
  if(b.y<R){b.y=R;if(b.vy<0){b.vy=-b.vy*0.55;if(b.vy<0.9)b.vy=0;b.sx*=0.6;b.sy*=0.4;}}
  if(free)return;
  if(b.y>F.CEIL-R){b.y=F.CEIL-R;if(b.vy>0)b.vy=-b.vy*0.6;}
  const lx=F.HW-R;
  if(b.x>lx){b.x=lx;if(b.vx>0)b.vx=-b.vx*0.7;b.sx*=-0.5;}else if(b.x<-lx){b.x=-lx;if(b.vx<0)b.vx=-b.vx*0.7;b.sx*=-0.5;}
  const az=Math.abs(b.z),sz=b.z<0?-1:1;
  if(az>F.HL){
    // inside the net
    if(b.x>gw-R){b.x=gw-R;if(b.vx>0)b.vx=-b.vx*0.15;}else if(b.x<-(gw-R)){b.x=-(gw-R);if(b.vx<0)b.vx=-b.vx*0.15;}
    if(b.y>F.GH-R){b.y=F.GH-R;if(b.vy>0)b.vy=-b.vy*0.15;}
    const zl=F.HL+F.GD-R;if(az>zl){b.z=sz*zl;if(b.vz*sz>0)b.vz=-b.vz*0.12;}
    b.sx*=0.9;b.sy*=0.9;
  }else if(az>F.HL-R){
    const inMouth=Math.abs(b.x)<gw-R*0.3&&b.y<F.GH-R*0.3;
    if(!inMouth){b.z=sz*(F.HL-R);if(b.vz*sz>0)b.vz=-b.vz*0.7;b.sx*=-0.5;}
  }
  if(az>F.HL-1&&az<F.HL+1){const z=sz*F.HL;
    if(segHit(b,gw,0,z,gw,F.GH,z)|segHit(b,-gw,0,z,-gw,F.GH,z)|segHit(b,-gw,F.GH,z,gw,F.GH,z))b.post=(b.post||0)+1;}
  const sp=Math.sqrt(b.vx*b.vx+b.vy*b.vy+b.vz*b.vz);if(sp>45){const f=45/sp;b.vx*=f;b.vy*=f;b.vz*=f;}
}
// Owned ball stays at the owner's feet. Sprinting = looser, further ahead, wobblier.
function dribbleBall(b,p,dt,time){
  if(b.hands){const fx=Math.sin(p.face),fz=Math.cos(p.face);b.x=p.x+fx*0.38;b.z=p.z+fz*0.38;b.y=1.05+playerLift(p);b.vx=p.vx;b.vz=p.vz;b.vy=0;b.sx=b.sy=0;return false;}
  const c=ctrlOf(p),loose=(1-c)/(1-CTRL_SPRINT);
  let ang=p.face,lead,side=0,k=CTRL.SPRING*c;
  const spd=hyp(p.vx,p.vz);
  if(p.st===ST.skill){
    if(p.sv===SK.roulette){ang=p.face+rouletteYaw(p);lead=0.28;k=26;}
    else if(p.sv===SK.chop){lead=0.42;k=24;}
    else{const u=clamp(p.stT/SK_DUR[2],0,1);lead=0.45-0.2*Math.sin(Math.PI*u);k=24;}
  }else if(p.st===ST.flick){lead=0.3;k=20;}
  else if(p.stance){lead=CTRL.STANCE_LEAD;k=CTRL.SPRING*1.5*c;}
  else{lead=CTRL.LEAD+loose*CTRL.EXTRA_LEAD*Math.min(1,spd/MOVE.JOG);side=loose*CTRL.WOBBLE*Math.sin(time*7.3+p.i*1.7);}
  const fx=Math.sin(ang),fz=Math.cos(ang);
  const tx=p.x+fx*lead-fz*side,tz=p.z+fz*lead+fx*side;
  b.vx=p.vx+(tx-b.x)*k;b.vz=p.vz+(tz-b.z)*k;b.vy=0;b.sx=b.sy=0;
  b.x+=b.vx*dt;b.z+=b.vz*dt;b.y=F.R;
  const lx=F.HW-F.R;b.x=clamp(b.x,-lx,lx);
  if(Math.abs(b.z)>F.HL-F.R&&!(Math.abs(b.x)<F.GW/2-F.R))b.z=Math.sign(b.z)*(F.HL-F.R);
  return hyp(b.x-p.x,b.z-p.z)>CTRL.LOSE;
}

// ---------- players ----------
function setSt(p,st,sv){p.st=st;p.stT=0;if(sv!==undefined)p.sv=sv;}
function clampPlayer(p){
  const lx=F.HW-0.35;p.x=clamp(p.x,-lx,lx);
  const inMouth=Math.abs(p.x)<F.GW/2-0.35;
  const lz=inMouth?F.HL+F.GD-0.35:F.HL-0.35;
  if(p.z>lz){p.z=lz;if(p.vz>0)p.vz=0;}else if(p.z<-lz){p.z=-lz;if(p.vz<0)p.vz=0;}
}
// inp: {mx,mz} wish direction (0..1), sprint, charging, stance, faceTo:[x,z]
function movePlayer(p,inp,dt,holding){
  if(p.cd>0)p.cd-=dt;if(p.stun>0)p.stun-=dt;if(p.kickT>0)p.kickT-=dt;
  if(p.effort>0)p.effort-=dt;else p.eff=Math.min(100,p.eff+STAM.EFF_RECHARGE*dt);
  p.stT+=dt;
  const mag=Math.min(1,hyp(inp.mx,inp.mz));
  const fx=Math.sin(p.face),fz=Math.cos(p.face);
  const done=d=>p.stT>=d;
  switch(p.st){
    case ST.slide:{const k=Math.min(1,p.stT/DUR[1]),sp=10.5*(1-k)+1.5*k;p.vx=fx*sp;p.vz=fz*sp;if(done(DUR[1]))setSt(p,ST.getup);break;}
    case ST.rush:{const k=Math.min(1,p.stT/DUR[11]),sp=9.5*(1-k)+1*k;p.vx=fx*sp;p.vz=fz*sp;if(done(DUR[11]))setSt(p,ST.getup);break;}
    case ST.dive:{const k=Math.min(1,p.stT/DUR[3]),sp=(p.sv?7.4:6.2)*Math.pow(1-k,1.3);p.vx=p.dvx*sp;p.vz=p.dvz*sp;if(done(DUR[3]))setSt(p,ST.getup);break;}
    case ST.tackle:{const sp=p.stT<0.14?5:0.8;p.vx=fx*sp;p.vz=fz*sp;if(done(DUR[4])){setSt(p,ST.run);p.cd=Math.max(p.cd,0.12);}break;}
    case ST.header:case ST.block:{const f=Math.exp(-2.5*dt);p.vx*=f;p.vz*=f;if(done(DUR[p.st]))setSt(p,ST.run);break;}
    case ST.skill:{
      const T=skillDur(p.sv),u=clamp(p.stT/T,0,1);
      if(p.sv===SK.roulette){p.vx=p.dvx*3.8;p.vz=p.dvz*3.8;}
      else if(p.sv===SK.chop){p.vx=p.dvx*3.6;p.vz=p.dvz*3.6;p.face=wrapA(p.face+clamp(wrapA(Math.atan2(p.dvx,p.dvz)-p.face),-9*dt,9*dt));}
      else{const f=Math.exp(-6*dt);p.vx*=f;p.vz*=f;if(u>0.3)p.face=wrapA(p.face+Math.PI/(T*0.7)*dt);}
      if(done(T))setSt(p,ST.run);break;}
    case ST.flick:{
      if(p.sv===FL.rainbow){p.vx=fx*4.5;p.vz=fz*4.5;}
      else if(p.sv===FL.turn){const f=Math.exp(-5*dt);p.vx*=f;p.vz*=f;if(p.stT<0.3)p.face=wrapA(p.face+Math.PI/0.3*dt);}
      else{const f=Math.exp(-3*dt);p.vx*=f;p.vz*=f;}
      if(done(DUR[8]))setSt(p,ST.run);break;}
    case ST.dash:{const k=Math.min(1,p.stT/DUR[9]),sp=9.2*(1-k*0.5);p.vx=p.dvx*sp;p.vz=p.dvz*sp;if(done(DUR[9]))setSt(p,ST.run);break;}
    case ST.getup:case ST.stun:{const f=Math.exp(-10*dt);p.vx*=f;p.vz*=f;if(done(DUR[p.st]))setSt(p,ST.run);break;}
    default:{
      p.stance=!!inp.stance;
      p.sprint=!!inp.sprint&&mag>0.3&&!inp.charging&&!p.stance&&!p.stamLock;
      const eff=p.effort>0&&mag>0.3&&!p.stance;
      if(eff)p.sprint=true;
      let top=p.stance?MOVE.STANCE:eff?MOVE.EFFORT:p.sprint?MOVE.SPRINT:MOVE.JOG;
      if(holding)top*=MOVE.BALLMUL;if(inp.charging)top*=0.55;if(p.stun>0)top*=0.35;if(p.gk&&holding)top*=0.8;
      const dx=mag>0.01?inp.mx/mag*top*mag:0,dz=mag>0.01?inp.mz/mag*top*mag:0;
      const a=1-Math.exp(-MOVE.ACC*dt);
      p.vx+=(dx-p.vx)*a;p.vz+=(dz-p.vz)*a;
      let want=null;
      if(p.stance&&inp.faceTo&&!holding)want=Math.atan2(inp.faceTo[0]-p.x,inp.faceTo[1]-p.z);
      else if(mag>0.05)want=Math.atan2(inp.mx,inp.mz);
      else if(hyp(p.vx,p.vz)>0.6)want=Math.atan2(p.vx,p.vz);
      if(want!==null){const rate=(p.sprint?MOVE.TURN_SPRINT:MOVE.TURN)*dt;p.face=wrapA(p.face+clamp(wrapA(want-p.face),-rate,rate));}
    }
  }
  if(p.st!==ST.run){p.sprint=p.st===ST.dash||p.st===ST.slide;p.stance=false;}
  // stamina: sprinting drains it, it refills after a short rest. Keepers in their own half don't tire.
  const free=p.gk&&inOwnHalf(p);
  if(p.sprint&&p.st===ST.run&&mag>0.3&&!free&&p.effort<=0){p.stam=Math.max(0,p.stam-STAM.DRAIN*dt);p.stamT=0;if(p.stam<=0)p.stamLock=true;}
  else{p.stamT+=dt;if(p.stamT>STAM.DELAY||free)p.stam=Math.min(100,p.stam+STAM.REGEN*dt);if(p.stam>20)p.stamLock=false;}
  p.x+=p.vx*dt;p.z+=p.vz*dt;p.y=playerLift(p);
  clampPlayer(p);
  if(p.gk&&holding){const gz=goalZ(p.team);p.x=clamp(p.x,-F.BOXW/2+0.3,F.BOXW/2-0.3);p.z=gz<0?clamp(p.z,-F.HL-1,-F.HL+F.BOXD-0.3):clamp(p.z,F.HL-F.BOXD+0.3,F.HL+1);}
}

// ---------- kicks ----------
// velocity that sends the ball from f to t at the given speed (low or high arc)
function launchTo(f,t,speed,high){
  const dx=t.x-f.x,dz=t.z-f.z,d=hyp(dx,dz)||1e-6,h=t.y-f.y,g=F.G,v2=speed*speed;
  const disc=v2*v2-g*(g*d*d+2*h*v2);
  const ang=disc<0?Math.PI/4:Math.atan((v2+(high?1:-1)*Math.sqrt(disc))/(g*d));
  const hv=speed*Math.cos(ang);
  return [dx/d*hv,speed*Math.sin(ang),dz/d*hv];
}
function flyTo(f,v,s,dist){
  const t={x:f.x,y:f.y,z:f.z,vx:v[0],vy:v[1],vz:v[2],sx:s[0],sy:s[1]};
  let tr=0,T=0;
  while(T<3.5){const ox=t.x,oz=t.z;stepBall(t,1/60,true);tr+=hyp(t.x-ox,t.z-oz);T+=1/60;if(tr>=dist)break;}
  return t;
}
// aim so a curving ball still arrives at the target: it starts off-line and bends in
function aimedKick(f,target,speed,spin,high){
  const aim={x:target.x,y:target.y,z:target.z};
  let v=launchTo(f,aim,speed,high);
  if(!spin[0]&&!spin[1])return v;
  const d=hyp(target.x-f.x,target.z-f.z);
  for(let it=0;it<4;it++){
    const e=flyTo(f,v,spin,d);
    aim.x+=clamp(target.x-e.x,-d*0.4,d*0.4);aim.z+=clamp(target.z-e.z,-d*0.4,d*0.4);aim.y+=clamp(target.y-e.y,-3,3);
    v=launchTo(f,aim,speed,high);
  }
  return v;
}
// Shots: three power levels from how long you hold. Short presses spin more.
// curve.cx: +1 = bend right, -1 = bend left. curve.cy: +1 = float (back spin), -1 = dip (top spin).
function shotVel(from,target,power,curve,o){
  o=o||{};
  const rnd=o.rnd||Math.random;
  const tgt={x:target.x,y:target.y,z:target.z};
  const d=hyp(tgt.x-from.x,tgt.z-from.z);
  const spread=(o.sprint?0.03:0)+(o.effort?0.02:0);
  if(spread){tgt.x+=(rnd()-0.5)*2*spread*d;tgt.y=Math.max(0.15,tgt.y+(rnd()-0.5)*spread*d);}
  const spinMag=1.35-0.85*power;
  const s=[-(curve.cx||0)*spinMag,-(curve.cy||0)*spinMag*0.9];
  if(o.lob){const speed=12+7*power;return {v:aimedKick(from,tgt,speed,s,true),s};}
  let speed=TIER_SPEED[shotTier(power)]*(o.air?1.15:1)*(o.effort?1.1:1);
  return {v:aimedKick(from,tgt,speed,s,false),s};
}
// Passes: a soft lock onto the teammate nearest the aim direction, led to where they are running.
function passVel(from,dir,charge,lob,mates){
  let best=null,bs=1e9;
  for(const m of mates||[]){
    const mx=m.x-from.x,mz=m.z-from.z,d=hyp(mx,mz);if(d<2||d>55)continue;
    const ang=Math.abs(wrapA(Math.atan2(mx,mz)-Math.atan2(dir[0],dir[1])));
    if(ang>0.45)continue;
    const s=ang*20+d*0.1;if(s<bs){bs=s;best=m;}
  }
  let tx,tz;
  if(best){const d=hyp(best.x-from.x,best.z-from.z),tt=lob?clamp(d/15,0.8,2.6):d/18;tx=best.x+(best.vx||0)*tt*0.9;tz=best.z+(best.vz||0)*tt*0.9;}
  else{const d=lob?12+30*charge:10+25*charge;tx=from.x+dir[0]*d;tz=from.z+dir[1]*d;}
  const ox=tx-from.x,oz=tz-from.z,d=hyp(ox,oz)||1;
  if(lob){const T=clamp(d/15,0.8,2.6);return {v:[ox/T*1.04,0.5*F.G*T-(from.y-F.R)/T,oz/T*1.04],s:[0,0],to:best?best.i:-1};}
  const sp=clamp(d*0.7+8+charge*8,10,30);
  return {v:[ox/d*sp,from.y>0.6?-0.5:0.25,oz/d*sp],s:[0,0],to:best?best.i:-1};
}
function headerVel(from,dir,target,charge){
  const sp=9+9*charge;
  if(target){const v=launchTo(from,target,sp,false);return {v,s:[0,0]};}
  return {v:[dir[0]*sp,1.5+charge*2,dir[1]*sp],s:[0,0]};
}
function pushVel(p,dir,perfect){const sp=Math.max(hyp(p.vx,p.vz),3)+(perfect?6.5:5);return {v:[dir[0]*sp,0.2,dir[1]*sp],s:[0,0]};}
function flickVel(p,variant){
  const fx=Math.sin(p.face),fz=Math.cos(p.face);
  if(variant===FL.rainbow)return {v:[fx*5.2,6.3,fz*5.2],s:[0,0]};
  if(variant===FL.turn)return {v:[-fx*4.2,6.5,-fz*4.2],s:[0,0]};
  return {v:[fx*0.8,4.6,fz*0.8],s:[0,0]};
}
// how a loose ball can be struck: on the ground, as a volley, or with the head
function kickContact(p,b){
  if(b.owner===p.i)return 'foot';
  if(b.owner>=0)return null;
  const fx=p.x+Math.sin(p.face)*0.45,fz=p.z+Math.cos(p.face)*0.45,d=hyp(b.x-fx,b.z-fz);
  if(b.y<0.45&&d<1.3)return 'foot';
  if(b.y<2.0&&d<1.5)return 'volley';
  if(b.y<3.0&&hyp(b.x-p.x,b.z-p.z)<1.25)return 'header';
  return null;
}

// ---------- touches: receiving, catching, blocking ----------
// intent: null | 'push' (Space) | 'stance' (Ctrl held) | 'flick' (C). dir: [x,z] the way you want to go.
function tryReceive(p,b,intent,dir){
  if(b.owner>=0||p.cd>0||p.st===ST.getup)return null;
  const c=ctrlOf(p);
  const rvx=b.vx-p.vx,rvz=b.vz-p.vz,rel=Math.sqrt(rvx*rvx+b.vy*b.vy+rvz*rvz);
  const fx=Math.sin(p.face),fz=Math.cos(p.face);
  // keeper hands
  if(p.gk&&inBox(p.x,p.z,p.team)&&p.st!==ST.slide&&p.st!==ST.rush){
    let hx=p.x+fx*0.15,hz=p.z+fz*0.15,hy=1.15,reach=p.stance?0.82:0.66,top=2.35,catchV=p.stance?30:27,parry=false;
    if(p.st===ST.dive){
      const k=Math.min(1,p.stT/DUR[3]);
      hx=p.x+p.dvx*0.75;hz=p.z+p.dvz*0.75;hy=0.35+0.95*Math.sin(Math.PI*Math.min(1,k*1.35));
      reach=p.sv?0.9:0.7;top=2.7;catchV=31;parry=!!p.sv;
    }
    const dx=b.x-hx,dz=b.z-hz,dy=b.y<hy-0.95?(hy-0.95)-b.y:b.y>hy+0.9?b.y-(hy+0.9):0;
    const d=Math.sqrt(dx*dx+dz*dz+dy*dy);
    if(d<reach&&b.y<top){
      if(!parry&&rel<catchV)return {t:'claim',hand:true};
      // parry: palm it away from goal and wide
      const out=attackZ(p.team)>0?1:-1;let sx=dx||(Math.random()-0.5);const sl=Math.abs(sx)||1;sx/=sl;
      return {t:'deflect',v:[sx*(5+rel*0.12)+b.vx*0.15,3+rel*0.08,out*(4+rel*0.15)],s:[0,0]};
    }
  }
  // jump block / header body
  if(p.st===ST.block||p.st===ST.header){
    const bd=hyp(b.x-p.x,b.z-p.z);
    if(bd<0.6&&b.y>p.y+0.2&&b.y<p.y+2.15){
      let nx=b.x-p.x,nz=b.z-p.z;const l=hyp(nx,nz)||1;nx/=l;nz/=l;
      const vn=rvx*nx+rvz*nz;if(vn<0)return {t:'deflect',v:[(rvx-1.5*vn*nx)*0.4+p.vx,Math.max(1,b.vy*0.3),(rvz-1.5*vn*nz)*0.4+p.vz],s:[0,0]};
    }
  }
  // slides and keeper rushes knock the ball on
  if(p.st===ST.slide||p.st===ST.rush){
    if(hyp(b.x-(p.x+fx*0.85),b.z-(p.z+fz*0.85))<0.9&&b.y<0.8)return {t:'deflect',v:[fx*9+b.vx*0.2,1.2,fz*9+b.vz*0.2],s:[0,0]};
  }
  const ffx=p.x+fx*0.3,ffz=p.z+fz*0.3,dxz=hyp(b.x-ffx,b.z-ffz);
  const reach=intent==='push'||intent==='flick'?CTRL.REACH:0.75;
  if(dxz<reach&&b.y<(intent?1.4:0.9)){
    const d=dir||[fx,fz];
    if(intent==='stance'&&rel<=CTRL.STICK*c)return {t:'claim'};
    if(intent==='push'&&rel<=CTRL.TRAP*c){const r=pushVel(p,d,false);return {t:'kick',kk:KK.push,v:r.v,s:r.s};}
    if(intent==='flick'&&rel<=CTRL.TRAP*c){const r=flickVel(p,FL.up);return {t:'kick',kk:KK.flick,v:r.v,s:r.s};}
    if(dxz<0.75&&b.y<0.9){
      if(rel<=CTRL.AUTO*c)return {t:'claim'};
      if(rel>CTRL.THROUGH)return null;   // no input: fast balls run through you
      return deflectOff(p,b,0.45);
    }
  }
  const bd=hyp(b.x-p.x,b.z-p.z);
  if(bd<0.5&&b.y<1.9){
    if(rel<=CTRL.AUTO*0.8*c)return {t:'claim'};
    if(rel>CTRL.THROUGH)return null;
    return deflectOff(p,b,0.4);
  }
  return null;
}
function deflectOff(p,b,keep){
  let nx=b.x-p.x,nz=b.z-p.z;const l=hyp(nx,nz)||1;nx/=l;nz/=l;
  const rvx=b.vx-p.vx,rvz=b.vz-p.vz,vn=rvx*nx+rvz*nz;
  if(vn>0)return null;
  return {t:'deflect',v:[p.vx+(rvx-1.6*vn*nx)*keep,Math.max(0,b.vy*0.5)+0.6,p.vz+(rvz-1.6*vn*nz)*keep],s:[0,0]};
}
function applyTouch(b,p,ev){
  if(ev.t==='claim'){
    b.owner=p.i;b.hands=!!ev.hand;b.sx=b.sy=0;
    if(!ev.hand){const keep=(1-ctrlOf(p))*0.5;b.vx=p.vx+(b.vx-p.vx)*keep;b.vz=p.vz+(b.vz-p.vz)*keep;b.vy=0;}
    p.holdT=ev.hand?0.001:0;
    return true;
  }
  if(ev.t==='kick'||ev.t==='deflect'){
    if(ev.b){b.x=ev.b[0];b.y=Math.max(F.R,ev.b[1]);b.z=ev.b[2];}
    b.vx=clamp(ev.v[0],-45,45);b.vy=clamp(ev.v[1],-30,30);b.vz=clamp(ev.v[2],-45,45);
    const s=ev.s||[0,0];b.sx=clamp(s[0]||0,-2,2);b.sy=clamp(s[1]||0,-2,2);
    b.owner=-1;b.hands=false;p.holdT=0;
    p.cd=ev.t==='deflect'?0.22:ev.kk===KK.push?0.16:ev.kk===KK.flick?0.3:0.32;
    return true;
  }
  return false;
}

// ---------- AI keeper (1v1 and practice) ----------
function aiKeeper(S,p,dt){
  const b=S.ball,ai=p.ai,gz=goalZ(p.team),out=gz<0?1:-1;
  const inp={mx:0,mz:0,sprint:false,stance:false,faceTo:[b.x,b.z]},events=[];
  if(ai.rushCd>0)ai.rushCd-=dt;
  if(p.st!==ST.run)return {inp,events};
  let tx,tz,sprint=false;
  if(b.owner===p.i){
    ai.hold+=dt;tx=p.x;tz=gz+out*4;
    if(ai.hold>1.0){
      ai.hold=0;
      const mates=S.players.filter(m=>m.team===p.team&&m!==p&&!m.gone);
      const from={x:b.x,y:b.y,z:b.z};
      let r,kk;
      if(mates.length&&Math.random()<0.75){const m=mates[0],d=hyp(m.x-b.x,m.z-b.z)||1;r=passVel(from,[(m.x-b.x)/d,(m.z-b.z)/d],0.4,d>22,mates);kk=KK.throw;}
      else{r=shotVel({x:b.x,y:0.6,z:b.z},{x:(Math.random()-0.5)*30,y:0.5,z:0},0.7,{cx:(Math.random()-0.5)*0.6,cy:0.3},{});kk=KK.punt;}
      p.kickT=KICK_DUR;p.kk=kk;
      events.push({t:'kick',v:r.v,s:r.s,kk});
    }
  }else{
    ai.hold=0;
    const dx=b.x,dz=b.z-gz,dist=hyp(dx,dz)||1;
    const d=clamp(0.8+dist*0.05,0.8,3.2);
    tx=clamp(dx/dist*d,-F.GW/2+0.3,F.GW/2-0.3);tz=gz+out*Math.abs(dz/dist)*d;
    const toward=-b.vz*out;
    if(b.owner<0&&toward>6){
      const t=(p.z-b.z)/(b.vz||1e-6);
      if(t>0&&t<1.6){
        const g={x:b.x,y:b.y,z:b.z,vx:b.vx,vy:b.vy,vz:b.vz,sx:b.sx,sy:b.sy};
        for(let s=0;s<t;s+=1/60)stepBall(g,1/60,true);
        const px=g.x,py=g.y;
        if(Math.abs(px)<F.GW/2+1&&py<F.GH+0.8){
          if(!ai.seen){ai.seen=1;ai.react=0.3+Math.random()*0.16;ai.err=(Math.random()-0.5)*1.0;}
          ai.react-=dt;
          if(ai.react<=0){
            const off=px+ai.err-p.x;
            const ao=Math.abs(off),canRun=ao/4.4<t-0.2;
            if(ao>0.7&&!canRun&&t<0.6){const l=Math.sqrt(off*off+0.04);setSt(p,ST.dive,ao>2.4?1:0);p.dvx=off/l;p.dvz=0.2*out/l;}
            else{tx=clamp(px+ai.err*0.7,-F.GW/2,F.GW/2);tz=p.z;inp.stance=ao<=0.7;sprint=ao>0.7;}
          }
        }
      }
    }else ai.seen=0;
    const bs=hyp(b.vx,b.vz);
    if(b.owner<0&&inBox(b.x,b.z,p.team)&&bs<9){
      let mine=true;const my=hyp(b.x-p.x,b.z-p.z);
      for(const o of S.players)if(o.team!==p.team&&!o.gone&&hyp(b.x-o.x,b.z-o.z)<my*0.8)mine=false;
      if(mine||my<4){tx=b.x;tz=b.z;sprint=true;}
    }
    if(b.owner>=0&&S.players[b.owner].team!==p.team){
      const o=S.players[b.owner],od=hyp(o.x-p.x,o.z-p.z);
      if(inBox(o.x,o.z,p.team)&&od<4.5){
        tx=b.x;tz=b.z;sprint=true;
        if(od<2.4&&ai.rushCd<=0){p.face=Math.atan2(b.x-p.x,b.z-p.z);setSt(p,ST.rush);ai.rushCd=1.6;}
      }
    }
  }
  tx=clamp(tx,-F.BOXW/2+0.5,F.BOXW/2-0.5);
  tz=gz<0?clamp(tz,-F.HL+0.3,-F.HL+F.BOXD-0.5):clamp(tz,F.HL-F.BOXD+0.5,F.HL-0.3);
  const ex=tx-p.x,ez=tz-p.z,ed=hyp(ex,ez);
  if(ed>0.12){const m=Math.min(1,ed/1.2);inp.mx=ex/ed*m;inp.mz=ez/ed*m;}
  inp.sprint=sprint&&ed>1.2;
  if(!sprint)inp.stance=true;
  return {inp,events};
}

// ---------- host match step ----------
function stepMatch(S,dt,time){
  if(S.phase==='end')return;
  S.t+=dt;
  if(S.phase==='count'){S.timer-=dt;if(S.timer<=0)S.phase='play';return;}
  updateKeepers(S);
  const b=S.ball;
  for(const p of S.players){
    if(p.gone)continue;
    if(p.aiGK){const r=aiKeeper(S,p,dt);movePlayer(p,r.inp,dt,b.owner===p.i);for(const ev of r.events)hostEvent(S,p,ev,0);}
    else if(p.ext)stepExtPlayer(p,dt);
  }
  if(S.phase==='goal'){S.timer-=dt;if(S.timer<=0){if(S.ot||S.clock<=0)endMatch(S);else kickoff(S,false);}return;}
  if(b.owner>=0){
    const o=S.players[b.owner];
    if(!o||o.gone){b.owner=-1;b.hands=false;}
    else{
      if(b.hands){o.holdT+=dt;if(!o.gk||!inBox(o.x,o.z,o.team)||o.holdT>6){b.hands=false;o.holdT=0;}}
      if(dribbleBall(b,o,dt,time)){b.owner=-1;b.hands=false;}
    }
  }else stepBall(b,dt);
  if(b.owner<0){
    const near=S.players.filter(p=>p.aiGK&&hyp(b.x-p.x,b.z-p.z)<3).sort((p,q)=>hyp(b.x-p.x,b.z-p.z)-hyp(b.x-q.x,b.z-q.z));
    for(const p of near){const ev=tryReceive(p,b,'stance',null);if(ev&&hostEvent(S,p,ev,0))break;}
  }
  resolveTackles(S);
  const inGoal=Math.abs(b.z)>F.HL+F.R&&Math.abs(b.x)<F.GW/2&&b.y<F.GH;
  if(S.phase==='play'&&inGoal){
    const t=b.z>0?0:1;S.score[t]++;S.goalSeq++;S.goalTeam=t;S.scorer=S.lastTouch[t];
    if(S.scorer>=0)S.players[S.scorer].goals++;
    b.owner=-1;b.hands=false;S.phase='goal';S.timer=3.4;
  }
  if(S.phase==='play'&&!S.ot&&!S.practice){
    S.clock-=dt;
    if(S.clock<=0){S.clock=0;if(S.score[0]!==S.score[1]){endMatch(S);return;}S.ot=true;}
  }
}
// standing tackles, slides and keeper rushes win the ball if they reach it
function resolveTackles(S){
  const b=S.ball;
  if(b.owner<0||b.hands)return;
  const o=S.players[b.owner];
  for(const p of S.players){
    if(p.gone||p.team===o.team)continue;
    const st=p.st;
    const active=(st===ST.slide&&p.stT<0.5)||(st===ST.tackle&&p.sv===0&&p.stT<0.24)||(st===ST.rush&&p.stT<0.36);
    if(!active)continue;
    const fx=p.x+Math.sin(p.face)*0.75,fz=p.z+Math.cos(p.face)*0.75;
    if(hyp(b.x-fx,b.z-fz)>(st===ST.tackle?0.95:1.1))continue;
    if(st===ST.tackle&&o.st===ST.skill&&o.sv===SK.roulette)continue;          // roulette skips standing tackles
    if(st===ST.tackle&&o.effort>0&&!(p.effort>0)&&Math.random()<0.5){p.cd=0.4;continue;}  // extra effort shrugs some off
    const sp=st===ST.tackle?3:7.5,side=(Math.random()-0.5)*3,fwx=Math.sin(p.face),fwz=Math.cos(p.face);
    b.owner=-1;b.hands=false;b.vx=fwx*sp+fwz*side;b.vz=fwz*sp-fwx*side;b.vy=0.6;b.sx=b.sy=0;
    o.stun=0.6;o.stunSeq++;o.cd=0.45;p.cd=0;
    S.touchSeq++;S.touchPow=8;S.lastTouch[p.team]=p.i;
    return;
  }
}
function endMatch(S){S.phase='end';S.winner=S.score[0]>S.score[1]?0:S.score[1]>S.score[0]?1:-1;}
function stepExtPlayer(p,dt){
  if(p.cd>0)p.cd-=dt;if(p.stun>0)p.stun-=dt;if(p.kickT>0)p.kickT-=dt;p.stT+=dt;
  p.x+=p.vx*dt;p.z+=p.vz*dt;p.y=playerLift(p);clampPlayer(p);
}
// apply any player's touch on the host. lat = how late (seconds) a remote player's touch arrived
function hostEvent(S,p,ev,lat){
  const b=S.ball;
  if(S.phase!=='play')return false;
  const tol=lat>0?1.0+lat*14:0;
  if(ev.t==='drop'){if(b.owner===p.i){b.hands=false;p.holdT=0;return true;}return false;}
  if(ev.t==='claim'){
    if(b.owner>=0)return false;
    if(ev.hand&&!(p.gk||(lat>0&&inBox(p.x,p.z,p.team)&&!S.players.some(o=>o.team===p.team&&o!==p&&o.gk&&inBox(o.x,o.z,o.team)))))return false;
    if(hyp(b.x-p.x,b.z-p.z)>(ev.hand?2.0:1.2)+tol)return false;
    if(ev.hand)p.gk=true;
    applyTouch(b,p,ev);
  }else if(ev.t==='kick'||ev.t==='deflect'){
    if(b.owner>=0&&b.owner!==p.i)return false;
    if(b.owner!==p.i&&hyp(b.x-p.x,b.z-p.z)>CTRL.REACH+0.4+tol)return false;
    if(ev.b&&hyp(ev.b[0]-b.x,ev.b[2]-b.z)>2.5+tol)ev=Object.assign({},ev,{b:null});
    applyTouch(b,p,ev);
    if(lat>0){for(let t=0;t<Math.min(0.3,lat);t+=F.DT)stepBall(b,F.DT);}
  }else return false;
  S.lastTouch[p.team]=p.i;S.touchSeq++;
  const v=ev.v||[0,0,0];S.touchPow=Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);
  return true;
}
/*SIM-END*/
