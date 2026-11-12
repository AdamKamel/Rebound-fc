/*POSE-START*/
// ---------- animation: joint rotations in the character's own frame (+Z forward, +X left, +Y up) ----------
// Rotations are applied around the character's axes, not the bones' local axes, so the same poses
// drive both the built-in mannequin and a downloaded rigged model.
const HIP=0.95;
function qMul(a,b){return [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];}
function qAxis(x,y,z,ang){const s=Math.sin(ang/2);return [x*s,y*s,z*s,Math.cos(ang/2)];}
function qConj(q){return [-q[0],-q[1],-q[2],q[3]];}
function qOf(o){const q=o.quaternion;return [+q.x||0,+q.y||0,+q.z||0,q.w===undefined?1:+q.w];}
function qSet(o,q){const l=Math.sqrt(q[0]*q[0]+q[1]*q[1]+q[2]*q[2]+q[3]*q[3])||1;o.quaternion.set(q[0]/l,q[1]/l,q[2]/l,q[3]/l);}
function frameQ(node,F){let q=[0,0,0,1],n=node,guard=0;while(n&&n!==F&&guard++<64){q=qMul(qOf(n),q);n=n.parent;}return q;}
const JOINTS=['hips','spine','chest','neck','head','lArm','lFore','rArm','rFore','lThigh','lShin','lFoot','rThigh','rShin','rFoot'];
function rotJoint(j,F,ax,ay,az){
  if(!ax&&!ay&&!az)return;
  const D=qMul(qMul(qAxis(0,1,0,ay),qAxis(0,0,1,az)),qAxis(1,0,0,ax));
  const P=frameQ(j.parent,F);
  qSet(j,qMul(qMul(qMul(qConj(P),D),P),qOf(j)));
}
function applyPose(joints,frame,angles){for(const k of JOINTS){const a=angles[k],j=joints[k];if(a&&j)rotJoint(j,frame,a[0],a[1],a[2]);}}

// Pose for one player this frame. ctx: {proc, gait, spd, holding, hands, celebrate, look, time}
// Sign guide: leg/arm forward = negative X, knee bend = positive X, lean forward = positive X,
// left limb outward = positive Z, right limb outward = negative Z, turn left = positive Y.
function poseFor(p,ctx){
  const P={lift:0,pitch:0,roll:0,yaw:0,aw:0,a:{}};
  const A=(k,x,y,z)=>{const v=P.a[k]||(P.a[k]=[0,0,0]);v[0]+=x||0;v[1]+=y||0;v[2]+=z||0;};
  const crouch=c=>{A('lThigh',-0.5*c);A('rThigh',-0.5*c);A('lShin',1.0*c);A('rShin',1.0*c);A('lFoot',-0.5*c);A('rFoot',-0.5*c);P.lift-=0.88*(1-Math.cos(0.5*c));};
  const aw=v=>{if(v>P.aw)P.aw=v;};
  const spd=ctx.spd||0,st=p.st,T=p.stT||0,f=Math.min(1,spd/5.5);
  // running
  if(ctx.proc){
    const ph=ctx.gait||0,sw=Math.sin(ph)*0.62*f;
    A('lThigh',-sw);A('rThigh',sw);
    A('lShin',Math.max(0,-Math.cos(ph))*1.15*f+0.05);A('rShin',Math.max(0,Math.cos(ph))*1.15*f+0.05);
    A('lArm',sw*0.85,0,0.1);A('rArm',-sw*0.85,0,-0.1);A('lFore',-0.3-0.5*f);A('rFore',-0.3-0.5*f);
    A('spine',0.05+(p.sprint?0.22:0.08)*f);
    P.lift+=Math.abs(Math.sin(ph))*0.05*f-0.03*f;
  }else if(p.sprint)A('spine',0.1*f);
  const look=clamp(ctx.look||0,-1.1,1.1);A('neck',0,look*0.45,0);A('head',0,look*0.45,0);
  // keeper ready / defending stance / carrying the ball
  if(st===ST.run){
    if(ctx.hands){A('lArm',-1.15,0,-0.2);A('rArm',-1.15,0,0.2);A('lFore',-0.75);A('rFore',-0.75);A('spine',0.08);}
    else if(p.gk){const w=Math.max(0,1-spd/4.5);crouch(0.8*w);A('spine',0.32*w);A('lArm',-0.7*w,0,0.5*w);A('rArm',-0.7*w,0,-0.5*w);A('lFore',-0.6*w);A('rFore',-0.6*w);
      if(p.stance){A('lThigh',0,0,0.2*w);A('rThigh',0,0,-0.2*w);A('lArm',0,0,0.45*w);A('rArm',0,0,-0.45*w);}aw(0.55*w);}
    else if(p.stance){crouch(0.5);A('spine',0.3);A('lArm',-0.2,0,0.45);A('rArm',-0.2,0,-0.45);aw(0.35);}
    if(ctx.holding&&!ctx.hands&&spd>1){const pulse=Math.pow(Math.max(0,Math.sin((ctx.gait||ctx.time*9)*0.5)),6);A('rThigh',-0.3*pulse);A('neck',0.18);}
  }
  // wind-up while charging a shot or pass
  const c=p.charge||0;
  if(c>0&&st===ST.run){A('rThigh',0.65*c);A('rShin',1.05*c);A('spine',-0.08*c);A('chest',0,0.3*c,0);A('lArm',-0.3*c,0,0.75*c);A('rArm',0.2*c,0,-0.5*c);aw(0.6*c);}
  // kicks
  if(p.kickT>0&&st!==ST.dive&&st!==ST.slide){
    const u=clamp(1-p.kickT/KICK_DUR,0,1),kk=p.kk;
    if(kk===KK.throw){
      const arm=u<0.35?-1.3-1.8*ease(u/0.35):-3.1+2.1*ease((u-0.35)/0.65);
      A('rArm',arm,0,-0.15);A('rFore',u<0.35?-1.2:-0.3);A('lArm',-1.0,0,0.3);A('spine',u<0.35?-0.2:0.3*Math.sin(Math.PI*u));aw(0.8);
    }else if(kk!==KK.header&&kk!==KK.flick){
      const amp=kk===KK.pass?0.7:kk===KK.push?0.45:1;
      const leg=u<0.3?0.65-1.9*ease(u/0.3):-1.25*(1-ease((u-0.3)/0.7));
      const knee=u<0.3?1.05-0.95*ease(u/0.3):0.1*(1-u);
      const s=Math.sin(Math.PI*u);
      A('rThigh',leg*amp,kk===KK.pass?-0.5*s:0,kk===KK.volley?-0.9*s:0);A('rShin',knee*amp);
      A('spine',(kk===KK.lob?-0.25:0.22)*s);A('lArm',-0.2*s,0,0.85*s);A('rArm',0.2*s,0,-0.6*s);
      if(kk===KK.volley)P.roll+=0.6*s;
      aw(0.9*(1-u*0.5));
    }
  }
  switch(st){
    case ST.header:{const u=T/DUR[ST.header];A('spine',u<0.6?-0.35*ease(u/0.6):0.45);A('lArm',-0.5,0,0.9);A('rArm',-0.5,0,-0.9);
      A('lThigh',-0.35);A('rThigh',-0.35);A('lShin',0.8);A('rShin',0.8);aw(1);break;}
    case ST.block:{A('lArm',-2.9,0,0.25);A('rArm',-2.9,0,-0.25);A('lThigh',-0.3);A('rThigh',-0.3);A('lShin',0.6);A('rShin',0.6);aw(1);break;}
    case ST.slide:{const w=Math.min(1,T/0.12);P.pitch=-1.05*w;P.lift-=0.72*w;A('lThigh',-0.35*w);A('rThigh',0.1*w);A('rShin',1.6*w);
      A('spine',0.35*w);A('lArm',0.9*w,0,0.5*w);A('rArm',0.9*w,0,-0.5*w);aw(1);break;}
    case ST.rush:{const w=Math.min(1,T/0.1);P.pitch=-0.75*w;P.lift-=0.5*w;A('lThigh',-0.4*w);A('rShin',1.2*w);A('lArm',-1.2*w,0,0.4*w);A('rArm',-1.2*w,0,-0.4*w);aw(1);break;}
    case ST.dive:{
      const k=Math.min(1,T/DUR[ST.dive]),side=ctx.diveSide||1,big=p.sv?1.5:1.4;
      P.roll=-side*big*Math.min(1,k*2.2);
      P.lift+=-0.75*ease(Math.min(1,k/0.8))+0.45*Math.sin(Math.PI*Math.min(1,k/0.8));
      A('lArm',-2.95,0,0.15);A('rArm',-2.95,0,-0.15);A('lFore',-0.1);A('rFore',-0.1);A('lThigh',-0.25);A('rThigh',0.25);A('rShin',0.4);aw(1);break;}
    case ST.getup:{const u=T/DUR[ST.getup];crouch(0.7*(1-u));A('spine',0.4*(1-u));aw(0.8*(1-u));break;}
    case ST.tackle:{const u=T/DUR[ST.tackle],w=Math.sin(Math.PI*Math.min(1,u*1.3));A('spine',0.4*w);crouch(0.35*w);
      A('rThigh',-1.0*w,0,-0.35*w);A('rShin',-0.4*w);A('lArm',0,0,0.6*w);A('rArm',0,0,-0.6*w);aw(0.9*w);break;}
    case ST.skill:{
      if(p.sv===SK.roulette){const u=T/SK_DUR[0];P.yaw=rouletteYaw(p);A('lArm',0,0,0.6);A('rArm',0,0,-0.6);A('spine',0.15);
        const s=Math.sin(u*4*Math.PI)*0.4;A('lThigh',-s);A('rThigh',s);aw(0.8);}
      else if(p.sv===SK.chop){const u=T/SK_DUR[1],s=Math.sin(Math.PI*u);A('rThigh',0.35*s,0,0.55*s);A('rShin',0.6*s);A('spine',0.25*s);A('lArm',0,0,0.7*s);A('rArm',0,0,-0.5*s);aw(0.7);}
      else{const u=T/SK_DUR[2],s=Math.sin(Math.PI*Math.min(1,u*1.6));A('rThigh',-0.6*s);A('rShin',0.2*s);A('spine',-0.1*s);A('lArm',0,0,0.5);A('rArm',0,0,-0.5);aw(0.7);}
      break;}
    case ST.flick:{const u=T/DUR[ST.flick],w=Math.sin(Math.PI*Math.min(1,u*1.4));
      if(p.sv===FL.up){A('rThigh',-0.7*w);A('rShin',0.4*w);}else{A('rThigh',0.55*w);A('rShin',1.9*w);A('spine',0.35*w);}
      A('lArm',0,0,0.7*w);A('rArm',0,0,-0.7*w);aw(0.9);break;}
    case ST.dash:{A('spine',0.35);break;}
    case ST.stun:{const w=1-T/DUR[ST.stun];A('spine',0.5*w,0,0.3*w*Math.sin(T*25));A('lArm',0,0,(0.9+0.4*Math.sin(T*18))*w);A('rArm',0,0,-(0.9+0.4*Math.cos(T*18))*w);aw(0.6*w);break;}
  }
  if(ctx.celebrate){A('lArm',-2.9,0,0.35);A('rArm',-2.9,0,-0.35);P.lift+=Math.abs(Math.sin((ctx.time||0)*7))*0.25;aw(1);}
  P.lift+=playerLift(p);
  return P;
}
/*POSE-END*/
