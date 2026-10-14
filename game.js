// Capi Corre — juego de carreras infinito con un capibara
(function(){
'use strict';
const VERSION='0.4.1';
const HERO_S=1;
// sprites ilustrados (px por unidad de juego)
let sprN=0;function sprLoaded(){if(++sprN>=8){const l=document.getElementById('loading');if(l)l.classList.add('hidden');}}
setTimeout(()=>{const l=document.getElementById('loading');if(l)l.classList.add('hidden');},8000);
const SPR={},SPR_PX={capi:3.4,gallina:4.3,gallo:4.1};
['capi_run1','capi_run2','capi_duck','capi_hurt','gallina_run','gallina_flap','gallo_run','gallo_flap'].forEach(n=>{const i=new Image();i.onload=()=>{SPR[n]=i;sprLoaded();if(window.__onSpr)window.__onSpr();};i.onerror=sprLoaded;i.src='img/'+n+'.png?v=7';});
function sprDim(n,id){const i=SPR[n],k=SPR_PX[id];return i?{w:i.width/k,h:i.height/k}:{w:90,h:75};}
const $=id=>document.getElementById(id);
const cv=$('c'),ctx=cv.getContext('2d');
const LS={get(k,d){try{const v=localStorage.getItem('capi_'+k);return v===null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('capi_'+k,JSON.stringify(v))}catch(e){}}};
const CHARS=[
 {id:'capi',name:'Capibara',price:0,desc:'Tranquilo y veloz. ¡Cuida su mandarina!'},
 {id:'gallina',name:'Gallina',price:150,desc:'Aletea al saltar. Mantén pulsado para planear.'},
 {id:'gallo',name:'Gallo',price:300,desc:'¡Kikirikí! Salta más alto y aletea otra vez en el aire (doble salto).'}
];
let save={best:LS.get('best',0),coins:LS.get('coins',0),owned:LS.get('owned',['capi']),sel:LS.get('sel','capi'),mute:LS.get('mute',false),tut:LS.get('tut',false)};
function persist(){LS.set('best',save.best);LS.set('coins',save.coins);LS.set('owned',save.owned);LS.set('sel',save.sel);LS.set('mute',save.mute);LS.set('tut',save.tut)}

// ---------- pantalla ----------
let W=0,H=0,S=1,VW=640,VH=360,GY=298,dpr=1,portraitOK=false;
function resize(){
 W=innerWidth;H=innerHeight;dpr=Math.min(devicePixelRatio||1,2.5);
 cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);
 S=H/360; if(W/S<560) S=W/560;
 VW=W/S;VH=H/S;GY=VH-62;
 if(H>W){S=W/440;VW=W/S;VH=H/S;GY=Math.round(VH*0.70);}
 checkRotate();
}
addEventListener('resize',resize);
function checkRotate(){
 const portrait=H>W*1.1;
 $('rotate').classList.toggle('hidden',!(portrait&&!portraitOK));
}
$('portraitBtn').onclick=()=>{portraitOK=true;checkRotate();};

// ---------- audio ----------
let ac=null;
function audio(){if(!ac){try{ac=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}}if(ac&&ac.state==='suspended')ac.resume();}
function tone(f,d,type,f2,vol){
 if(save.mute||!ac)return;
 const t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();
 o.type=type||'square';o.frequency.setValueAtTime(f,t);
 if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+d);
 g.gain.setValueAtTime(vol||0.12,t);g.gain.exponentialRampToValueAtTime(0.001,t+d);
 o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+d+0.02);
}
const sfx={
 jump(){tone(380,0.16,'square',760,0.09)},
 flap(){tone(520,0.08,'triangle',900,0.1)},
 coin(){tone(990,0.07,'square',null,0.07);setTimeout(()=>tone(1480,0.12,'square',null,0.07),60)},
 hit(){tone(300,0.35,'sawtooth',70,0.14)},
 splash(){tone(700,0.2,'sine',180,0.12)},
 duck(){tone(260,0.08,'triangle',160,0.08)},
 click(){tone(660,0.06,'triangle',null,0.08)},
 kiki(){if(save.mute||!ac)return;[[700,1100,0.09],[1100,900,0.09],[900,1400,0.12],[1400,800,0.28]].forEach(([a,b,d],i,arr)=>{const t0=arr.slice(0,i).reduce((s,x)=>s+x[2]*1000,0);setTimeout(()=>tone(a,d,'sawtooth',b,0.07),t0)})},
 record(){[523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,0.14,'square',null,0.08),i*110))}
};
function setMute(){$('muteBtn').textContent=save.mute?'🔇':'🔊'}
$('muteBtn').onclick=e=>{e.stopPropagation();save.mute=!save.mute;persist();setMute();audio();sfx.click()};
setMute();

// ---------- estado ----------
let state='title';
let p,obs,coins,parts,dist,speed,runCoins,spawnIn,coinSpawnIn,deadT,tutT,slowT,time=0,jumpsDone;
function reset(){
 p={hs:HERO_S,x:150,y:0,vy:0,ground:true,duck:false,hold:false,holdT:0,squash:0,anim:0,orangeY:0,orangeV:0,glide:false,flapT:0,rot:0,dead:false,dustT:0};
 obs=[];coins=[];parts=[];dist=0;speed=330;runCoins=0;spawnIn=save.tut?1.1:3.2;coinSpawnIn=2;deadT=0;slowT=0;jumpsDone=0;
 tutT=save.tut?0:8;
}
reset();

// ---------- controles ----------
let ptr=null;
function jumpPress(){
 if(state!=='play'||p.dead)return;
 p.hold=true;
 const ch=save.sel;
 if(p.ground){
  p.vy=ch==='gallina'?-680:ch==='gallo'?-790:-730;p.ground=false;p.holdT=0;p.squash=-1;jumpsDone++;p.air2=ch==='gallo';
  ch==='capi'?sfx.jump():sfx.flap();if(ch!=='capi')p.flapT=0.3;
  puff(p.x-6,GY,5,'#e8d3a8');
 }else if(p.air2&&!p.duck){
  p.air2=false;p.vy=-620;p.holdT=0.1;p.flapT=0.3;sfx.flap();
  for(let i=0;i<6;i++)parts.push({x:p.x-8,y:GY+p.y-20,vx:R(-90,-20),vy:R(-30,60),life:0.4,max:0.4,r:R(2,3.5),c:i%2?'#1e9e6a':'#ff8a1f',g:100});
 }
}
function jumpRelease(){p&&(p.hold=false)}
function duckOn(){if(state!=='play'||p.dead)return;if(!p.duck)sfx.duck();p.duck=true;p.hold=false;if(!p.ground&&p.vy<500)p.vy=Math.max(p.vy,520);$('duckBtn').classList.add('on')}
function duckOff(){if(p)p.duck=false;$('duckBtn').classList.remove('on')}
cv.addEventListener('pointerdown',e=>{
 audio();
 if(state!=='play')return;
 ptr={id:e.pointerId,y:e.clientY,x:e.clientX,swiped:false};
 jumpPress();
});
addEventListener('pointermove',e=>{
 if(!ptr||e.pointerId!==ptr.id)return;
 if(e.clientY-ptr.y>32&&!ptr.swiped){ptr.swiped=true;duckOn();}
});
addEventListener('pointerup',e=>{if(ptr&&e.pointerId===ptr.id){if(ptr.swiped)duckOff();ptr=null;jumpRelease();}});
addEventListener('pointercancel',()=>{ptr=null;jumpRelease();duckOff()});
const db=$('duckBtn');
db.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();audio();duckOn();});
db.addEventListener('pointerup',e=>{e.stopPropagation();duckOff();});
db.addEventListener('pointerleave',()=>duckOff());
addEventListener('keydown',e=>{
 if(e.repeat)return;
 if(e.code==='Space'||e.code==='ArrowUp'){audio();if(state==='title'||state==='over')startGame();else jumpPress();e.preventDefault();}
 if(e.code==='ArrowDown'){duckOn();e.preventDefault();}
});
addEventListener('keyup',e=>{if(e.code==='Space'||e.code==='ArrowUp')jumpRelease();if(e.code==='ArrowDown')duckOff();});
document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='play')pause()});

// ---------- pantallas ----------
function show(id){['title','over','shop','paused'].forEach(s=>$(s).classList.toggle('hidden',s!==id));}
function refreshTitle(){$('tBest').textContent=save.best;$('tCoins').textContent=save.coins;}
function startGame(){
 audio();sfx.click();reset();state='play';if(save.sel==='gallo')setTimeout(sfx.kiki,150);show(null);
 $('hud').classList.remove('hidden');$('duckBtn').classList.remove('hidden');$('pauseBtn').classList.remove('hidden');
}
function toTitle(){state='title';reset();refreshTitle();show('title');$('hud').classList.add('hidden');$('duckBtn').classList.add('hidden');$('pauseBtn').classList.add('hidden');}
function pause(){if(state!=='play')return;state='paused';show('paused');}
$('playBtn').onclick=startGame;$('retryBtn').onclick=startGame;
$('homeBtn').onclick=()=>{sfx.click();toTitle()};$('quitBtn').onclick=()=>{sfx.click();toTitle()};
$('resumeBtn').onclick=()=>{sfx.click();state='play';show(null);last=performance.now()};
$('pauseBtn').onclick=e=>{e.stopPropagation();pause()};
$('shopBtn').onclick=()=>{audio();sfx.click();buildShop();show('shop')};
$('backBtn').onclick=()=>{sfx.click();refreshTitle();show('title')};
window.__onSpr=()=>{if(!$('shop').classList.contains('hidden'))buildShop();};
function buildShop(){
 $('sCoins').textContent=save.coins;
 const box=$('chars');box.innerHTML='';
 CHARS.forEach(c=>{
  const d=document.createElement('div');d.className='char'+(save.sel===c.id?' sel':'');
  const pc=document.createElement('canvas');pc.width=220;pc.height=160;
  const owned=save.owned.includes(c.id);
  d.appendChild(pc);
  d.insertAdjacentHTML('beforeend',`<b>${c.name}</b><small>${c.desc}</small>`);
  const b=document.createElement('button');
  if(save.sel===c.id){b.textContent='✔ Elegido';b.disabled=true;}
  else if(owned){b.textContent='Elegir';b.onclick=()=>{save.sel=c.id;persist();sfx.click();buildShop()};}
  else{b.className='buy';b.textContent='🪙 '+c.price;b.disabled=save.coins<c.price;
   if(b.disabled)b.textContent='🪙 '+c.price+' (faltan '+(c.price-save.coins)+')';
   b.onclick=()=>{if(save.coins>=c.price){save.coins-=c.price;save.owned.push(c.id);save.sel=c.id;persist();sfx.record();buildShop();}};}
  d.appendChild(b);box.appendChild(d);
  const g=pc.getContext('2d');g.scale(2,2);g.translate(55,78);const k=c.id==='capi'?0.98:1.04;g.scale(k,k);
  drawHero(g,c.id,{y:0,vy:0,ground:true,duck:false,squash:0,anim:0.3,orangeY:0,flapT:0,glide:false,rot:0});
  if(!owned){g.setTransform(1,0,0,1,0,0);g.fillStyle='rgba(255,255,255,.55)';g.fillRect(0,0,220,160);g.font='60px sans-serif';g.textAlign='center';g.fillText('🔒',110,105);}
 });
}

// ---------- generación ----------
const R=(a,b)=>a+Math.random()*(b-a);
const RI=(a,b)=>Math.floor(R(a,b+1));
function spawn(){
 const sc=dist/40;
 const r=Math.random();
 let x=VW+40,o;
 let width=0;
 if(sc>250&&r<0.22){ // pájaro
  const lv=sc>500?RI(0,2):RI(0,1);
  const yo=[-22,-48,-92][lv];
  obs.push(o={t:'bird',x,y:GY+yo,w:40,h:22,ph:Math.random()*6});width=40;
 }else if(sc>120&&r<0.32){ // charco
  const w=R(70,110);obs.push({t:'puddle',x,y:GY,w,h:6,hit:false});width=w;
 }else{
  const k=Math.random();
  if(k<0.5){ // cactus en grupo
   const n=sc<150?RI(1,2):RI(1,3);
   for(let i=0;i<n;i++){const w=R(20,28),h=R(36,sc<150?50:62);obs.push({t:'cactus',x:x+width,y:GY,w,h,seed:Math.random()});width+=w+6;}
  }else if(k<0.8){
   const n=sc<200?1:RI(1,2);
   for(let i=0;i<n;i++){const w=R(32,48),h=R(22,34);obs.push({t:'rock',x:x+width,y:GY,w,h,seed:Math.random()});width+=w+4;}
  }else{const w=R(58,78);obs.push({t:'log',x,y:GY,w,h:26});width=w;}
  if(Math.random()<0.4){ // arco de monedas sobre el obstáculo
   for(let i=0;i<5;i++){const t=i/4;coins.push({x:x+width/2+(t-0.5)*130,y:GY-50-Math.sin(t*Math.PI)*55,got:false,ph:i});}
  }
 }
 // separación justa: tiempo de reacción + tiempo en el aire, escala con la velocidad
 const minGap=speed*0.62+width+150;
 spawnIn=(minGap+R(0,speed*0.85)*(sc<100?1.4:1))/speed;
}
function spawnCoins(){
 const n=RI(3,6),hy=Math.random()<0.5?-18:-70;
 for(let i=0;i<n;i++)coins.push({x:VW+40+i*30,y:GY+hy,got:false,ph:i});
 coinSpawnIn=R(2.5,5);
}
function puff(x,y,n,col){for(let i=0;i<n;i++)parts.push({x,y,vx:R(-90,30),vy:R(-90,-20),life:R(0.3,0.55),max:0.55,r:R(2.5,5),c:col,g:200});}

// ---------- actualización ----------
function hb(){const b=hb0(),k=HERO_S;return{x:p.x+(b.x-p.x)*k,y:GY+p.y+(b.y-GY-p.y)*k,w:b.w*k,h:b.h*k};}
function hb0(){ // caja de choque ajustada a cada sprite
 const ch=save.sel,X=p.x,Y=GY+p.y;
 if(ch==='capi'){
  if(p.duck&&p.ground){const d=sprDim('capi_duck','capi');return{x:X-d.w*0.4,y:Y-d.h*0.62,w:d.w*0.8,h:d.h*0.6};}
  const d=sprDim('capi_run1','capi');return{x:X-d.w*0.36,y:Y-d.h*0.76,w:d.w*0.74,h:d.h*0.72};
 }
 const d=sprDim(ch+'_run',ch);
 if(p.duck&&p.ground)return{x:X-d.w*0.28,y:Y-d.h*0.5,w:d.w*0.56,h:d.h*0.48};
 return{x:X-d.w*0.28,y:Y-d.h*0.84,w:d.w*0.56,h:d.h*0.8};
}
function ov(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
function update(dt){
 time+=dt;
 if(state!=='play'){ // fondo animado en menús
  dist+=150*dt;p.anim+=dt*8;updParts(dt);return;
 }
 if(p.dead){
  deadT+=dt;p.vy+=1800*dt;p.y=Math.min(0,p.y+p.vy*dt);p.rot+=dt*4;updParts(dt);
  if(deadT>0.8&&state==='play')gameOver();
  return;
 }
 const target=330+470*(1-Math.exp(-dist/60000));
 speed=slowT>0?target*0.62:target;slowT=Math.max(0,slowT-dt);
 const dx=speed*dt;dist+=dx;
 if(tutT>0){tutT-=dt;if(jumpsDone>=2&&tutT>2)tutT=2;}
 // física
 const hen=save.sel==='gallina';
 if(!p.ground){
  let g=2600;
  if(p.duck)g=6000;
  else if(p.hold&&p.vy<0&&p.holdT<0.22){g=1150;p.holdT+=dt;}
  p.vy+=g*dt;
  p.glide=false;
  if(hen&&p.hold&&p.vy>0&&!p.duck){p.vy=Math.min(p.vy,95);p.glide=true;}
  p.y+=p.vy*dt;
  if(p.y>=0){p.y=0;p.vy=0;p.ground=true;p.squash=1;puff(p.x,GY,6,'#e8d3a8');}
 }
 p.flapT=Math.max(0,p.flapT-dt);
 p.squash*=Math.pow(0.0005,dt);
 p.anim+=dt*speed/38;
 // mandarina con resorte
 p.orangeV+=(-p.orangeY*260-p.orangeV*12-(p.ground?0:p.vy*0.35))*dt;p.orangeY+=p.orangeV*dt;p.orangeY=Math.max(-14,Math.min(10,p.orangeY));
 if(p.ground&&!p.duck){p.dustT-=dt;if(p.dustT<0){p.dustT=0.09;parts.push({x:p.x-20,y:GY-2,vx:-R(30,80),vy:-R(10,40),life:0.35,max:0.35,r:R(2,3.5),c:'#e9d6ad',g:80});}}
 // aparición
 spawnIn-=dt;if(spawnIn<=0)spawn();
 coinSpawnIn-=dt;if(coinSpawnIn<=0&&dist>600)spawnCoins();
 const box=hb();
 for(const o of obs){
  o.x-=dx+(o.t==='bird'?speed*0.12*dt:0);
  if(o.t==='bird')o.ph+=dt*10;
  if(o.t==='puddle'){
   if(!o.hit&&p.ground&&o.x<p.x+10&&o.x+o.w>p.x-10){o.hit=true;slowT=0.9;sfx.splash();for(let i=0;i<12;i++)parts.push({x:p.x,y:GY,vx:R(-120,120),vy:R(-260,-120),life:0.6,max:0.6,r:R(2,4),c:'#7fd3ff',g:900});}
   continue;
  }
  const ib=o.t==='bird'?{x:o.x+5,y:o.y-o.h/2+4,w:o.w-10,h:o.h-8}:{x:o.x+3,y:o.y-o.h+3,w:o.w-6,h:o.h-3};
  if(ov(box,ib)){die();break;}
 }
 obs=obs.filter(o=>o.x+o.w>-60);
 for(const c of coins){
  c.x-=dx;
  if(!c.got&&Math.abs(c.x-(box.x+box.w/2))<box.w/2+12&&Math.abs(c.y-(box.y+box.h/2))<box.h/2+12){
   c.got=true;runCoins++;save.coins++;sfx.coin();
   for(let i=0;i<6;i++)parts.push({x:c.x,y:c.y,vx:R(-80,80),vy:R(-120,20),life:0.4,max:0.4,r:R(1.5,3),c:'#ffe066',g:300});
  }
 }
 coins=coins.filter(c=>c.x>-30&&!c.got);
 updParts(dt);
 $('hudScore').textContent=Math.floor(dist/40);
 $('hudCoins').textContent='🪙 '+runCoins;
}
function updParts(dt){for(const q of parts){q.life-=dt;q.x+=q.vx*dt-(state==='play'&&!p.dead?speed*dt*0.3:0);q.y+=q.vy*dt;q.vy+=q.g*dt;}parts=parts.filter(q=>q.life>0);}
function die(){p.dead=true;p.vy=-520;p.ground=false;sfx.hit();duckOff();if(navigator.vibrate)try{navigator.vibrate(60)}catch(e){}
 for(let i=0;i<14;i++)parts.push({x:p.x,y:GY+p.y-20,vx:R(-150,150),vy:R(-250,-50),life:0.6,max:0.6,r:R(2,4),c:i%2?'#ffb22e':'#fff',g:600});}
function gameOver(){
 state='over';
 const sc=Math.floor(dist/40),rec=sc>save.best;
 if(rec)save.best=sc;
 save.tut=true;persist();
 $('oScore').textContent=sc;$('oBest').textContent=save.best;$('oCoins').textContent='+'+runCoins+'  (total '+save.coins+')';
 $('newRec').classList.toggle('hidden',!rec);
 $('overTitle').textContent=rec?'¡Increíble!':['¡Ups!','¡Auch!','¡Casi!'][RI(0,2)];
 if(rec)setTimeout(sfx.record,250);
 $('duckBtn').classList.add('hidden');$('pauseBtn').classList.add('hidden');
 show('over');
}

// ---------- ciclo día / noche ----------
// claves: [pos, cieloArriba, cieloAbajo, oscuridad]
const SKY=[[0,'#5cb8ff','#c8ecff',0],[0.4,'#5cb8ff','#c8ecff',0],[0.5,'#ff8a5c','#ffd28a',0.12],[0.58,'#3a2f7a','#c86a8a',0.3],[0.66,'#141a46','#34407a',0.5],[0.9,'#141a46','#34407a',0.5],[0.96,'#ff9fb0','#ffe0a8',0.15],[1,'#5cb8ff','#c8ecff',0]];
function hex(c){return[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)]}
function mix(a,b,t){const A=hex(a),B=hex(b);return`rgb(${A.map((v,i)=>Math.round(v+(B[i]-v)*t)).join(',')})`}
function skyAt(ph){for(let i=0;i<SKY.length-1;i++){const a=SKY[i],b=SKY[i+1];if(ph>=a[0]&&ph<=b[0]){const t=(ph-a[0])/(b[0]-a[0]||1);return{top:mix(a[1],b[1],t),bot:mix(a[2],b[2],t),dark:a[3]+(b[3]-a[3])*t};}}return{top:SKY[0][1],bot:SKY[0][2],dark:0}}
const STARS=Array.from({length:60},()=>({x:Math.random(),y:Math.random()*0.6,s:Math.random()*1.5+0.6,t:Math.random()*6}));

// ---------- dibujo ----------
function rr(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
function ell(g,x,y,rx,ry,c){g.fillStyle=c;g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill();}
// ---------- arte estilo cuento: contornos marcados y sombreado suave ----------
const O='#4a2c17';
function P(g,fill,lw,sc){g.fillStyle=fill;g.fill();g.lineWidth=lw||2.2;g.strokeStyle=sc||O;g.lineJoin='round';g.stroke();}
function E(g,x,y,rx,ry,fill,rot,lw){g.beginPath();g.ellipse(x,y,rx,ry,rot||0,0,6.2832);P(g,fill,lw);}
function line(g,pts,c,w){g.strokeStyle=c;g.lineWidth=w;g.lineCap='round';g.lineJoin='round';g.beginPath();g.moveTo(pts[0],pts[1]);for(let i=2;i<pts.length;i+=2)g.lineTo(pts[i],pts[i+1]);g.stroke();}
function blob(g,cs,fill,oc,lw){ // unión de círculos con contorno
 g.fillStyle=oc;for(const c of cs){g.beginPath();g.arc(c[0],c[1],c[2]+lw,0,6.2832);g.fill();}
 g.fillStyle=fill;for(const c of cs){g.beginPath();g.arc(c[0],c[1],c[2],0,6.2832);g.fill();}
}
function drawBG(){
 const ph=(dist/40/900)%1;
 const sk=skyAt(ph),dk=sk.dark;
 const gr=ctx.createLinearGradient(0,0,0,GY);gr.addColorStop(0,sk.top);gr.addColorStop(1,sk.bot);
 ctx.fillStyle=gr;ctx.fillRect(0,0,VW,GY+2);
 const sunA=ph/0.6;
 if(sunA<1){const x=VW*(0.15+0.7*sunA),y=GY*0.5-Math.sin(sunA*Math.PI)*GY*0.38;
  ell(ctx,x,y,36,36,'rgba(255,240,150,.35)');E(ctx,x,y,22,22,ph>0.42?'#ffb347':'#ffe46b',0,3);}
 // nubes esponjosas con contorno
 for(let i=0;i<5;i++){let x=((i*260-dist*0.06)%(VW+300)+VW+300)%(VW+300)-150,y=38+((i*53)%4)*20,s=0.8+((i*7)%3)*0.15;
  blob(ctx,[[x,y,18*s],[x+20*s,y-10*s,20*s],[x+42*s,y-4*s,16*s],[x+58*s,y+2*s,11*s],[x-14*s,y+3*s,11*s]],'#ffffff','#8fb4d6',2.5);
  ctx.fillStyle='#ffffff';ctx.fillRect(x-16*s,y+2*s,78*s,12*s);ctx.fillStyle='#8fb4d6';ctx.fillRect(x-16*s,y+13*s,78*s,2.5);}
 // colinas
 hills(0.08,GY-78,40,'#a6db7e','#5f9c45',0.006,1);
 hills(0.2,GY-46,28,'#86c95d','#4f8a37',0.011,2);
 // arbustos y árboles redondos
 const span=260,off=(dist*0.35)%span;
 for(let i=-1;i<VW/span+2;i++){const k=Math.floor(dist*0.35/span)+i;const x=i*span-off+((k*97)%90);
  if(k%2===0){ctx.fillStyle=O;ctx.fillRect(x-4.5,GY-58,9,46);ctx.fillStyle='#8a5a32';ctx.fillRect(x-2.5,GY-58,5,46);
   blob(ctx,[[x,GY-70,22],[x-18,GY-58,15],[x+18,GY-58,16],[x,GY-52,15]],'#5fae45',O,2.2);
   ell(ctx,x-6,GY-78,8,5,'#86cc62');}
  else blob(ctx,[[x,GY-20,13],[x+16,GY-24,15],[x+32,GY-18,11]],'#4f9e3c',O,2.2);
 }
 // cerca de madera por tramos
 const fs=420,fo=(dist*0.7)%fs;
 for(let i=-1;i<VW/fs+2;i++){const x0=i*fs-fo;
  for(const ry of [GY-30,GY-17]){ctx.fillStyle=O;rr(ctx,x0-2,ry-2,176,9,3);ctx.fill();ctx.fillStyle='#c48a52';rr(ctx,x0,ry,172,5,2);ctx.fill();}
  for(let j=0;j<5;j++){const px=x0+j*42;ctx.beginPath();ctx.moveTo(px,GY-4);ctx.lineTo(px,GY-36);ctx.lineTo(px+4,GY-40);ctx.lineTo(px+8,GY-36);ctx.lineTo(px+8,GY-4);ctx.closePath();P(ctx,'#b07a45',2);
   line(ctx,[px+3,GY-30,px+3,GY-14],'#8a5a32',1.2);}
 }
 // pradera
 const gg=ctx.createLinearGradient(0,GY,0,VH);gg.addColorStop(0,'#7cc94f');gg.addColorStop(1,'#4f9a35');
 ctx.fillStyle=gg;ctx.fillRect(0,GY-6,VW,VH-GY+6);
 line(ctx,[0,GY-6,VW,GY-6],'#3f7a2a',2.4);
 ctx.fillStyle='#9ad86a';ctx.fillRect(0,GY,VW,5);
 // flores y pasto
 const rows=Math.min(18,Math.floor((VH-GY-8)/18));
 for(let r=0;r<rows;r++){const sp=70+r*9,off=dist*(1+r*0.08)+r*37,yb=GY+14+r*18;
  const i0=Math.floor(off/sp)-1,i1=i0+Math.ceil(VW/sp)+3;
  for(let i=i0;i<=i1;i++){ // posiciones fijas por índice: sin parpadeo
   let h=(i*73856093)^(r*19349663);h=(h^(h>>>13))*1274126177;h=(h^(h>>>16))>>>0;
   const x=i*sp-off+(h%41)-20,y=yb+((h>>>8)%9)-4,kind=(h>>>12)%3,white=(h>>>16)&1;
   if(x<-12||x>VW+12)continue;
   if(kind===0){ctx.fillStyle=white?'#ffffff':'#ffd23a';for(let a=0;a<5;a++){ctx.beginPath();ctx.arc(x+Math.cos(a*1.257)*3.2,y+Math.sin(a*1.257)*3.2,2.4,0,6.28);ctx.fill();}
    ctx.fillStyle=white?'#ffc21a':'#f08a1f';ctx.beginPath();ctx.arc(x,y,1.8,0,6.28);ctx.fill();}
   else line(ctx,[x-4,y+2,x-2,y-5,x,y+2,x+3,y-6,x+5,y+2],'#3f8a2c',1.4);}
 }
 const to=dist%46;for(let x=-to;x<VW;x+=46)line(ctx,[x,GY-4,x+3,GY-13,x+6,GY-4,x+10,GY-11,x+12,GY-4],'#3f7a2a',1.8);
 // noche
 if(dk>0){ctx.fillStyle='rgba(18,22,70,'+(dk*0.62)+')';ctx.fillRect(0,0,VW,VH);}
 if(dk>0.2){ctx.globalAlpha=Math.min(1,(dk-0.2)*3.3);ctx.fillStyle='#fff';
  for(const s of STARS){const tw=0.6+0.4*Math.sin(time*2+s.t);ctx.fillRect(s.x*VW,s.y*GY*0.8,s.s*tw+0.6,s.s*tw+0.6);}ctx.globalAlpha=1;}
 const moA=(ph-0.55)/0.42;
 if(moA>0&&moA<1){const x=VW*(0.15+0.7*moA),y=GY*0.5-Math.sin(moA*Math.PI)*GY*0.4;
  ell(ctx,x,y,30,30,'rgba(255,255,230,.18)');E(ctx,x,y,18,18,'#fff4c2',0,2.5);ell(ctx,x-5,y-4,3,3,'#e8dca0');ell(ctx,x+5,y+6,2.2,2.2,'#e8dca0');}
 return dk;
}
function hills(par,base,amp,col,oc,freq,seed){
 ctx.beginPath();ctx.moveTo(-5,GY);
 const o=dist*par;
 for(let x=0;x<=VW+16;x+=12){const t=(x+o)*freq;ctx.lineTo(x,base-amp*(0.5+0.5*Math.sin(t+seed)*Math.sin(t*0.37+seed*2)));}
 ctx.lineTo(VW+5,GY);ctx.closePath();P(ctx,col,2.5,oc);
}
function drawObs(o){
 const x=o.x,y=o.y,g=ctx;
 if(o.t==='cactus'){ // poste de madera
  g.beginPath();g.moveTo(x+1,y);g.lineTo(x+1,y-o.h+5);g.lineTo(x+o.w/2,y-o.h);g.lineTo(x+o.w-1,y-o.h+5);g.lineTo(x+o.w-1,y);g.closePath();P(g,'#b9804a',2.4);
  g.save();g.clip();g.fillStyle='#96633a';g.fillRect(x+o.w*0.62,y-o.h,o.w,o.h);g.restore();
  line(g,[x+o.w*0.35,y-o.h+10,x+o.w*0.35,y-o.h*0.45],'#7a4a28',1.3);
  E(g,x+o.w*0.5,y-o.h*0.3,2.6,2.6,'#7a4a28',0,1.2);
  if(o.seed>0.6)blob(g,[[x+o.w*0.3,y-3,5],[x+o.w*0.7,y-4,5]],'#5fae45',O,2);
 }else if(o.t==='rock'){
  if(o.seed>0.5){ // fardo de heno
   rr(g,x,y-o.h,o.w,o.h,7);P(g,'#f2c64c',2.4);
   g.save();rr(g,x,y-o.h,o.w,o.h,7);g.clip();g.fillStyle='#d9a531';g.fillRect(x,y-o.h*0.35,o.w,o.h);g.restore();
   for(let i=1;i<4;i++)line(g,[x+i*o.w/4-4,y-o.h+5,x+i*o.w/4+2,y-o.h+11],'#c08a20',1.3);
   line(g,[x+o.w*0.3,y-o.h,x+o.w*0.3,y],'#a0522d',2.2);line(g,[x+o.w*0.7,y-o.h,x+o.w*0.7,y],'#a0522d',2.2);
  }else{
   g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x-2,y-o.h*0.8,x+o.w*0.35,y-o.h);g.quadraticCurveTo(x+o.w*0.85,y-o.h*1.05,x+o.w,y-o.h*0.3);g.lineTo(x+o.w,y);g.closePath();P(g,'#a9a3b4',2.4);
   g.save();g.clip();ell(g,x+o.w*0.7,y,o.w*0.45,o.h*0.5,'#8a849a');g.restore();
   ell(g,x+o.w*0.35,y-o.h*0.72,o.w*0.13,o.h*0.1,'#d6d1df');
  }
 }else if(o.t==='log'){
  rr(g,x,y-o.h,o.w,o.h,11);P(g,'#a8693a',2.4);
  g.save();rr(g,x,y-o.h,o.w,o.h,11);g.clip();g.fillStyle='#8a5530';g.fillRect(x,y-o.h*0.38,o.w,o.h);g.restore();
  line(g,[x+12,y-o.h+8,x+o.w-26,y-o.h+8],'#6e4022',1.4);line(g,[x+20,y-o.h+16,x+o.w-30,y-o.h+16],'#6e4022',1.4);
  E(g,x+o.w-7,y-o.h/2,8,o.h/2-1,'#efc58a',0,2.2);g.lineWidth=1.2;g.beginPath();g.ellipse(x+o.w-7,y-o.h/2,4,o.h/4,0,0,6.28);g.stroke();
  blob(g,[[x+18,y-o.h,4],[x+24,y-o.h-1,3.5]],'#6cbf4c',O,1.8);
 }else if(o.t==='puddle'){
  E(g,x+o.w/2,y+4,o.w/2,6,'#62bdf0',0,2.2);ell(g,x+o.w/2-6,y+2.5,o.w/3,2,'rgba(255,255,255,.75)');
 }else if(o.t==='bird'){ // cuervo caricatura
  const f=Math.sin(o.ph);
  g.beginPath();g.moveTo(x+32,y-2);g.lineTo(x+44,y-7);g.lineTo(x+44,y+5);g.closePath();P(g,'#2d2a40',2);
  E(g,x+20,y,15,9.5,'#3b3754',0,2.2);
  g.beginPath();g.moveTo(x+14,y-3);g.quadraticCurveTo(x+22,y-4-f*20,x+34,y-4-f*16);g.quadraticCurveTo(x+28,y+2,x+16,y+3);g.closePath();P(g,'#2a2740',2);
  E(g,x+7,y-4,8.5,7.5,'#3b3754',0,2.2);
  g.beginPath();g.moveTo(x+1,y-6);g.lineTo(x-9,y-2.5);g.lineTo(x+1,y);g.closePath();P(g,'#ffc21a',1.8);
  E(g,x+6,y-6,3,3.2,'#fff',0,1.2);ell(g,x+5,y-6,1.6,1.8,'#111');
 }
}
function drawCoin(c){
 const s=Math.abs(Math.cos(time*4+c.ph*0.6));
 E(ctx,c.x,c.y,7.5*s+1.5,8,'#ffcc33',0,2);
 if(s>0.5){ell(ctx,c.x,c.y,4.5*s,5,'#ffe27a');ctx.fillStyle='#d99a10';ctx.fillRect(c.x-1,c.y-3,2,6);}
}
function drawHero(g,id,st){
 let n;
 const fr=Math.floor((st.anim||0)/Math.PI)%2;
 if(id==='capi'){
  n=st.dead||st.rot?'capi_hurt':(st.duck&&st.ground)?'capi_duck':!st.ground?'capi_run2':(fr?'capi_run2':'capi_run1');
 }else{
  const flap=!st.ground&&(st.flapT>0||st.glide||st.vy<0)||(st.rot>0);
  n=id==='gallina'?'gallina_run':id+(flap?'_flap':'_run');
  if(id==='gallo'&&st.ground&&!st.duck)n=fr?'gallo_flap':'gallo_run';
 }
 const im=SPR[n];
 g.save();
 const run=st.ground&&!st.duck;
 const bob=run?Math.abs(Math.sin(st.anim))*-3:0;
 g.translate(0,st.y+bob);
 if(st.rot&&id!=='capi')g.rotate(-st.rot);
 let sx=1,sy=1;
 if(!st.ground){sx=0.94;sy=1.07;}
 if(st.squash>0){sx=1+st.squash*0.18;sy=1-st.squash*0.16;}
 if(st.duck&&id!=='capi'){sx*=1.12;sy*=0.66;}
 if(run)g.rotate(Math.sin(st.anim*2)*0.03);
 else if(id==='gallina'&&!st.ground)g.rotate(st.glide?-0.06+Math.sin(time*9)*0.03:Math.max(-0.15,Math.min(0.15,(st.vy||0)/4000)));
 g.scale(sx,sy);
 if(im){const k=SPR_PX[id],w=im.width/k,h=im.height/k;g.drawImage(im,-w*0.5,-h+2,w,h);}
 g.restore();
}
function swing(st,i){return st.ground?Math.sin(st.anim+(i?Math.PI:0)):(i?0.7:-0.5);}
function capyLeg(g,x,a,c){
 g.save();g.translate(x,-16);g.rotate(a*0.45);
 rr(g,-5,-2,10,16,5);P(g,c,2.2);
 E(g,1.5,14,7,4,'#7d4c2a',0,2.2);
 line(g,[1,11.5,0.5,15.5],O,1.1);line(g,[4.5,11.5,4.5,15.5],O,1.1);
 g.restore();
}
function capy(g,st){
 capyLeg(g,-19,swing(st,1),'#9c6a3d');capyLeg(g,10,swing(st,0),'#9c6a3d');
 // cuerpo grande y redondo
 g.beginPath();g.ellipse(-6,-25,31,19,0,0,6.2832);g.fillStyle='#c08850';g.fill();
 g.save();g.clip();ell(g,-4,-6,36,12,'#a3703f');ell(g,-12,-40,18,6,'#d9a56b');g.restore();
 g.beginPath();g.ellipse(-6,-25,31,19,0,0,6.2832);g.lineWidth=2.4;g.strokeStyle=O;g.stroke();
 line(g,[-26,-34,-23,-38,-20,-34],'#8f5e34',1.4);line(g,[-12,-39,-9,-43,-6,-39],'#8f5e34',1.4);line(g,[-30,-20,-27,-23],'#8f5e34',1.4);
 capyLeg(g,-25,swing(st,0),'#b47c47');capyLeg(g,4,swing(st,1),'#b47c47');
 // cabeza
 g.save();g.translate(19,-38);
 E(g,-9,-13,5.5,6,'#a8713f',-0.4,2.2);ell(g,-9,-12,2.6,3.2,'#6e4425');
 rr(g,-14,-15,30,28,13);g.fillStyle='#c08850';g.fill();
 g.save();g.clip();ell(g,-8,12,16,9,'#a3703f');g.restore();
 rr(g,-14,-15,30,28,13);g.lineWidth=2.4;g.strokeStyle=O;g.stroke();
 rr(g,7,-9,23,21,10);P(g,'#8f5d37',2.4);
 ell(g,15,-5,6,2.5,'#a8744a');
 E(g,25,-3.5,5.5,4,'#4f2d18',0,1.6);ell(g,23.5,-4.8,1.6,1,'#8a6650');
 g.strokeStyle=O;g.lineWidth=1.6;g.beginPath();g.moveTo(14,6);g.quadraticCurveTo(19,9.5,25,5.5);g.stroke();
 line(g,[25,2,35,-1],O,0.9);line(g,[25,4,36,4],O,0.9);line(g,[24,6,34,9],O,0.9);
 E(g,3,-4,5.5,6.2,'#ffffff',0,1.8);ell(g,4.4,-3.4,3.4,3.9,'#2a160a');ell(g,5.6,-5,1.4,1.4,'#fff');
 g.strokeStyle=O;g.lineWidth=1.6;g.beginPath();g.moveTo(-1,-12.5);g.quadraticCurveTo(3.5,-14.5,8,-12);g.stroke();
 ell(g,2,6,4,2.4,'rgba(255,120,110,.45)');
 // mandarina
 const oy=-22+(st.orangeY||0);
 E(g,-2,oy,8.5,7.5,'#ff9a1f',0,2.2);ell(g,-4.5,oy-2.5,3,2,'#ffc46a');
 g.fillStyle=O;g.fillRect(-2.7,oy-10,1.8,4);
 E(g,2,oy-9,5,2.4,'#56b84a',-0.5,1.6);
 g.restore();
}
function birdLegs(g,st,xs,len,c){
 xs.forEach((x,i)=>{const a=swing(st,i%2)*0.5;const fx=x+Math.sin(a)*len*0.7,fy=-Math.cos(a)*len*0.1;
  line(g,[x,-len,fx,fy],O,4.6);line(g,[x,-len,fx,fy],c,2.6);
  line(g,[fx-3,fy,fx+5,fy],O,3.6);line(g,[fx-3,fy,fx+5,fy],c,1.8);});
}
function eye(g,x,y,r){E(g,x,y,r,r*1.1,'#fff',0,1.5);ell(g,x+r*0.25,y+r*0.1,r*0.58,r*0.65,'#1d1208');ell(g,x+r*0.45,y-r*0.3,r*0.25,r*0.25,'#fff');}
function hen(g,st){
 birdLegs(g,st,[-3,5],12,'#ffa41a');
 // cola esponjosa
 E(g,-15,-36,5,11,'#ffffff',-0.5,2.2);E(g,-19,-31,4.5,10,'#f1f3f6',-0.9,2.2);
 E(g,0,-24,18,14.5,'#ffffff',0,2.4);
 g.save();g.beginPath();g.ellipse(0,-24,18,14.5,0,0,6.28);g.clip();ell(g,2,-12,18,6,'#dfe4ec');g.restore();
 g.strokeStyle='#c9d0da';g.lineWidth=1.3;for(let i=0;i<3;i++){g.beginPath();g.arc(-6+i*7,-18,3.5,0.2,Math.PI-0.2);g.stroke();}
 // cabeza
 E(g,9,-50,3.6,3.6,'#ef3b2c',0,1.8);E(g,13.5,-51.5,4,4,'#ef3b2c',0,1.8);E(g,17.5,-49,3.4,3.4,'#ef3b2c',0,1.8);
 E(g,13,-40,9.5,9.5,'#ffffff',0,2.4);
 ell(g,8,-32,7,5,'#ffffff');
 g.beginPath();g.moveTo(21,-43);g.lineTo(28.5,-40);g.lineTo(21,-36.5);g.closePath();P(g,'#ffb300',1.8);
 E(g,21,-32.5,2.6,4,'#ef3b2c',0,1.6);
 eye(g,15,-42,3.3);ell(g,11,-35,3,1.8,'rgba(255,140,160,.6)');
 const flap=st.glide?-0.9:(st.flapT>0?Math.sin(st.flapT*40)*0.9:(st.ground?Math.sin(st.anim*0.5)*0.15:0.3));
 g.save();g.translate(-3,-26);g.rotate(flap);E(g,-3,4,12,7,'#f6f7f9',0,2.2);
 g.strokeStyle='#c9d0da';g.lineWidth=1.2;g.beginPath();g.arc(-6,6,3,0.3,Math.PI-0.3);g.stroke();g.beginPath();g.arc(0,6,3,0.3,Math.PI-0.3);g.stroke();g.restore();
}
function rooster(g,st){
 birdLegs(g,st,[-3,6],17,'#ffc21a');
 // cola grande y curva
 const fe=[['#1c5a49',-10,-80,-38,-44],['#1f7d78',-16,-84,-44,-34],['#e98a2a',-20,-70,-40,-30],['#2b8f62',-24,-66,-34,-24]];
 for(const [c,cx,cy,ex,ey] of fe){g.beginPath();g.moveTo(-10,-36);g.quadraticCurveTo(cx,cy,ex,ey);
  g.strokeStyle=O;g.lineWidth=9;g.stroke();g.strokeStyle=c;g.lineWidth=5.6;g.stroke();}
 E(g,0,-32,17,14,'#1f4e6e',0,2.4);
 g.save();g.beginPath();g.ellipse(0,-32,17,14,0,0,6.28);g.clip();ell(g,2,-20,18,6,'#163a54');g.restore();
 // plumas del cuello
 g.beginPath();g.moveTo(5,-30);g.lineTo(2,-44);g.quadraticCurveTo(6,-60,14,-64);g.lineTo(21,-58);g.quadraticCurveTo(20,-44,19,-36);
 g.lineTo(16,-32);g.lineTo(13,-36);g.lineTo(10,-29);g.lineTo(7,-35);g.closePath();P(g,'#e2582a',2.2);
 line(g,[8,-40,9,-50],'#f6a03a',1.6);line(g,[13,-40,14,-52],'#f6a03a',1.6);
 // cresta, cabeza
 E(g,9,-68,4.4,4.8,'#ef2f2a',0,2);E(g,14,-71,5,5.4,'#ef2f2a',0,2);E(g,19.5,-68,4.4,4.6,'#ef2f2a',0,2);E(g,23,-64,3.4,3.6,'#ef2f2a',0,2);
 E(g,15,-58,9,9,'#e9662d',0,2.4);
 E(g,21,-48,3.2,5.4,'#ef2f2a',0,1.8);
 g.beginPath();g.moveTo(22,-61);g.lineTo(31,-57);g.lineTo(22,-53.5);g.closePath();P(g,'#ffc21a',1.8);
 eye(g,17,-60,3.1);
 const flap=st.flapT>0?Math.sin(st.flapT*40)*0.9:(st.ground?Math.sin(st.anim*0.5)*0.15:0.3);
 g.save();g.translate(-3,-33);g.rotate(flap);E(g,-3,4,12,7,'#1b6a74',0,2.2);line(g,[-11,6,4,6],'#e98a2a',1.6);g.restore();
}
function drawHUDText(){
 if(state!=='play'||tutT<=0)return;
 const a=Math.min(1,tutT);
 ctx.globalAlpha=a;
 const t='Toca para saltar · Desliza abajo para agacharte';
 const fs=Math.min(22,VW/26);
 ctx.font='bold '+fs+'px "Trebuchet MS",sans-serif';ctx.textAlign='center';
 const w=ctx.measureText(t).width+34,y=Math.min(GY*0.32,120);
 ctx.fillStyle='rgba(255,255,255,.92)';rr(ctx,VW/2-w/2,y-fs,w,fs*2,fs);ctx.fill();
 ctx.fillStyle='#6b3f1f';ctx.fillText(t,VW/2,y+fs*0.35);
 const s=Math.sin(time*5);ctx.font=(fs*1.5)+'px sans-serif';ctx.fillText('👆',VW/2+w/2-20,y+fs*2.2+s*4);
 if(save.sel!=='capi'){ctx.font='bold '+(fs*0.8)+'px sans-serif';ctx.fillStyle='#fff';ctx.fillText(save.sel==='gallo'?'Toca otra vez en el aire para doble salto':'Mantén pulsado para planear',VW/2,y+fs*2.4);}
 ctx.globalAlpha=1;
}
function draw(){
 ctx.imageSmoothingQuality='high';
 ctx.setTransform(dpr*S,0,0,dpr*S,0,0);
 const dk=drawBG();
 for(const c of coins)drawCoin(c);
 for(const o of obs)drawObs(o);
 // sombra
 const sh=Math.max(0.3,1+p.y/120);
 ell(ctx,p.x,GY+2,(save.sel==='capi'?34:22)*sh,4*sh,'rgba(0,0,0,.18)');
 ctx.save();ctx.translate(p.x,GY);drawHero(ctx,save.sel,p);ctx.restore();
 for(const q of parts){ctx.globalAlpha=Math.max(0,q.life/q.max);ell(ctx,q.x,q.y,q.r,q.r,q.c);}
 ctx.globalAlpha=1;
 drawHUDText();
 if(state==='play'&&slowT>0){ctx.font='bold 18px sans-serif';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText('¡Splash!',p.x,GY+p.y-62);}
}
let last=performance.now();
function loop(t){
 const dt=Math.min(0.033,(t-last)/1000);last=t;
 if(state!=='paused')update(dt);
 draw();
 requestAnimationFrame(loop);
}
// ---------- instalar como app ----------
let deferred=null;
const standalone=()=>matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||navigator.standalone===true;
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;if(!standalone())$('installBtn').classList.remove('hidden');});
addEventListener('appinstalled',()=>{deferred=null;$('installBtn').classList.add('hidden');});
if(isIOS&&!standalone())$('installBtn').classList.remove('hidden');
$('installBtn').onclick=async()=>{audio();sfx.click();
 if(deferred){deferred.prompt();const r=await deferred.userChoice;deferred=null;if(r.outcome==='accepted')$('installBtn').classList.add('hidden');}
 else $('iosTip').classList.toggle('hidden');};
if('serviceWorker' in navigator){let _rl=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(_rl)return;_rl=true;location.reload();});
addEventListener('load',()=>navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(reg=>{reg.update();document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')reg.update();});}).catch(()=>{}));}
if(standalone()&&screen.orientation&&screen.orientation.lock)screen.orientation.lock('landscape').catch(()=>{});
resize();refreshTitle();show('title');
p.y=0;
requestAnimationFrame(loop);
window.__capi={drawHero,get GY(){return GY},get state(){return state},get p(){return p},get obs(){return obs},setDist(d){dist=d},jumpPress,jumpRelease,duckOn,duckOff,startGame,VERSION};
})();
