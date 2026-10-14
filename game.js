// Capi Corre — juego de carreras infinito con un capibara
(function(){
'use strict';
const VERSION='0.2';
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
 if(H>W){S=W/440;VW=W/S;VH=H/S;GY=Math.round(VH*0.62);}
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
 p={x:150,y:0,vy:0,ground:true,duck:false,hold:false,holdT:0,squash:0,anim:0,orangeY:0,orangeV:0,glide:false,flapT:0,rot:0,dead:false,dustT:0};
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
  const g=pc.getContext('2d');g.scale(2,2);g.translate(c.id==='capi'?48:55,76);const k=c.id==='capi'?1.15:1.05;g.scale(k,k);
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
function hb(){ // caja de choque del jugador
 const ch=save.sel;
 if(p.duck&&p.ground)return ch==='capi'?{x:p.x-30,y:GY+p.y-26,w:68,h:24}:ch==='gallo'?{x:p.x-14,y:GY+p.y-36,w:32,h:34}:{x:p.x-14,y:GY+p.y-26,w:32,h:24};
 if(ch==='gallina')return{x:p.x-14,y:GY+p.y-42,w:30,h:40};
 if(ch==='gallo')return{x:p.x-14,y:GY+p.y-52,w:34,h:50};
 return{x:p.x-30,y:GY+p.y-44,w:66,h:40};
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
function drawBG(){
 const ph=(dist/40/900)%1; // un ciclo cada 900 puntos
 const sk=skyAt(ph);
 const gr=ctx.createLinearGradient(0,0,0,GY);gr.addColorStop(0,sk.top);gr.addColorStop(1,sk.bot);
 ctx.fillStyle=gr;ctx.fillRect(0,0,VW,GY+2);
 // estrellas
 if(sk.dark>0.2){ctx.globalAlpha=Math.min(1,(sk.dark-0.2)*3.3);ctx.fillStyle='#fff';
  for(const s of STARS){const tw=0.6+0.4*Math.sin(time*2+s.t);ctx.globalAlpha*=1;ctx.fillRect(s.x*VW,s.y*GY,s.s*tw+0.5,s.s*tw+0.5);}ctx.globalAlpha=1;}
 // sol y luna: recorren el cielo
 const sunA=ph/0.6;
 if(sunA<1){const x=VW*(0.15+0.7*sunA),y=GY*0.55-Math.sin(sunA*Math.PI)*GY*0.4;
  ell(ctx,x,y,34,34,'rgba(255,240,150,.35)');ell(ctx,x,y,24,24,ph>0.42?'#ffb347':'#ffe76a');}
 const moA=(ph-0.55)/0.42;
 if(moA>0&&moA<1){const x=VW*(0.15+0.7*moA),y=GY*0.55-Math.sin(moA*Math.PI)*GY*0.42;
  ell(ctx,x,y,30,30,'rgba(255,255,230,.18)');ell(ctx,x,y,18,18,'#fff7d6');ell(ctx,x+7,y-5,15,15,sk.top);}
 const dk=sk.dark;
 // nubes
 ctx.globalAlpha=0.85-dk*0.8;
 for(let i=0;i<5;i++){let x=((i*260-dist*0.06)%(VW+300)+VW+300)%(VW+300)-150,y=40+((i*53)%4)*22;
  ell(ctx,x,y,40,14,'#fff');ell(ctx,x+22,y-10,24,16,'#fff');ell(ctx,x-18,y-6,20,12,'#fff');}
 ctx.globalAlpha=1;
 // colinas lejanas
 hills(0.1,GY-70,38,mix('#9bd38a','#2b3a5e',dk*1.6>1?1:dk*1.6),0.006,1);
 hills(0.25,GY-38,26,mix('#6cbf5e','#223150',dk*1.6>1?1:dk*1.6),0.011,2);
 // árboles acacia en la orilla
 const tcol=mix('#4e9d43','#1b2a44',Math.min(1,dk*1.6)),trunk=mix('#7a5230','#2a2236',Math.min(1,dk*1.6));
 const span=230;let off=(dist*0.45)%span;
 for(let i=-1;i<VW/span+2;i++){const k=Math.floor(dist*0.45/span)+i;const x=i*span-off+((k*97)%80);
  const h=46+((k*31)%5)*8;
  if(k%3===0){ // juncos
   ctx.strokeStyle=tcol;ctx.lineWidth=3;for(let j=0;j<5;j++){ctx.beginPath();ctx.moveTo(x+j*5,GY-12);ctx.quadraticCurveTo(x+j*5-4,GY-30,x+j*6-6,GY-40-j%2*8);ctx.stroke();}
  }else{
   ctx.fillStyle=trunk;ctx.fillRect(x-3,GY-14-h,6,h);
   ctx.beginPath();ctx.moveTo(x,GY-14-h*0.6);ctx.lineTo(x-14,GY-14-h);ctx.lineTo(x-10,GY-14-h);ctx.lineTo(x,GY-14-h*0.7);ctx.fill();
   ell(ctx,x,GY-18-h,36,11,tcol);ell(ctx,x-14,GY-24-h,18,8,tcol);ell(ctx,x+12,GY-23-h,20,8,tcol);
  }
 }
 // pasto de orilla
 ctx.fillStyle=mix('#8fd16a','#2d4a3e',Math.min(1,dk*1.4));ctx.fillRect(0,GY-14,VW,16);
 // camino
 ctx.fillStyle=mix('#f2d79b','#6a6070',Math.min(1,dk*1.3));ctx.fillRect(0,GY,VW,24);
 ctx.fillStyle=mix('#e0bf7a','#57506a',Math.min(1,dk*1.3));
 let po=(dist)%40;for(let x=-po;x<VW;x+=40){ctx.fillRect(x,GY+8,10,3);ctx.fillRect(x+22,GY+16,6,3);}
 ctx.fillStyle=mix('#6fbf4c','#2a4a3a',Math.min(1,dk*1.4));
 let go=(dist)%60;for(let x=-go;x<VW;x+=60){ctx.beginPath();ctx.moveTo(x,GY);ctx.lineTo(x+4,GY-8);ctx.lineTo(x+8,GY);ctx.lineTo(x+12,GY-6);ctx.lineTo(x+15,GY);ctx.fill();}
 // río
 const wy=GY+24;
 const wg=ctx.createLinearGradient(0,wy,0,VH);wg.addColorStop(0,mix('#5fc6ee','#1f3566',Math.min(1,dk*1.5)));wg.addColorStop(1,mix('#2f97d4','#121f44',Math.min(1,dk*1.5)));
 ctx.fillStyle=wg;ctx.fillRect(0,wy,VW,VH-wy);
 ctx.fillStyle='rgba(255,255,255,'+(0.45-dk*0.4)+')';
 let ro=(dist*1.2)%90;for(let x=-ro;x<VW+90;x+=90){const y=wy+12+((Math.floor((x+ro+dist*1.2)/90))%3)*10;rr(ctx,x,y,30,3,1.5);ctx.fill();}
 let lo=(dist*1.1)%340;for(let x=-lo;x<VW+340;x+=340){ell(ctx,x+60,wy+26,13,4.5,mix('#5bbf55','#24443a',Math.min(1,dk*1.5)));ell(ctx,x+66,wy+24,3,2.4,'#ff9ec7');}
 if(VH-wy>70){ell(ctx,VW*0.5,wy+(VH-wy)*0.6,VW*0.6,(VH-wy)*0.3,'rgba(255,255,255,.04)');}
 return dk;
}
function hills(par,base,amp,col,freq,seed){
 ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(0,GY);
 const o=dist*par;
 for(let x=0;x<=VW+16;x+=16){const t=(x+o)*freq;ctx.lineTo(x,base-amp*(0.5+0.5*Math.sin(t+seed)*Math.sin(t*0.37+seed*2)));}
 ctx.lineTo(VW,GY);ctx.closePath();ctx.fill();
}
function drawObs(o){
 const x=o.x,y=o.y;
 if(o.t==='cactus'){
  ctx.fillStyle='#3fae4f';rr(ctx,x+o.w*0.25,y-o.h,o.w*0.5,o.h,o.w*0.25);ctx.fill();
  const ay=y-o.h*(0.45+o.seed*0.2);
  rr(ctx,x-1,ay-14,o.w*0.28,16,4);ctx.fill();rr(ctx,x-1,ay,o.w*0.5,6,3);ctx.fill();
  rr(ctx,x+o.w*0.72,ay-20+o.seed*8,o.w*0.28,16,4);ctx.fill();rr(ctx,x+o.w*0.5,ay-6+o.seed*8,o.w*0.5,6,3);ctx.fill();
  ctx.fillStyle='#2b8a3c';ctx.fillRect(x+o.w*0.47,y-o.h+5,2,o.h-8);
  ctx.fillStyle='#ff7eb6';if(o.seed>0.5){ell(ctx,x+o.w*0.5,y-o.h,4.5,3.5,'#ff7eb6');}
 }else if(o.t==='rock'){
  ctx.fillStyle='#9a8f9f';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+o.w*0.12,y-o.h*0.75);ctx.lineTo(x+o.w*0.45,y-o.h);ctx.lineTo(x+o.w*0.85,y-o.h*0.8);ctx.lineTo(x+o.w,y);ctx.fill();
  ctx.fillStyle='#bdb3c2';ctx.beginPath();ctx.moveTo(x+o.w*0.2,y-o.h*0.7);ctx.lineTo(x+o.w*0.45,y-o.h*0.92);ctx.lineTo(x+o.w*0.55,y-o.h*0.6);ctx.fill();
  ell(ctx,x+o.w*0.7,y-3,7,3,'#7cc95a');
 }else if(o.t==='log'){
  ctx.fillStyle='#9a6234';rr(ctx,x,y-o.h,o.w,o.h,10);ctx.fill();
  ctx.fillStyle='#7d4c25';ctx.fillRect(x+12,y-o.h+8,o.w-26,3);ctx.fillRect(x+18,y-o.h+16,o.w-34,3);
  ell(ctx,x+o.w-6,y-o.h/2,8,o.h/2,'#e8b77a');ell(ctx,x+o.w-6,y-o.h/2,4,o.h/4,'#c68a4c');
  ell(ctx,x+20,y-o.h-2,6,3,'#5bbf55');
 }else if(o.t==='puddle'){
  ell(ctx,x+o.w/2,y+5,o.w/2,6,'#4fb4ea');ell(ctx,x+o.w/2-6,y+3,o.w/3,2.5,'rgba(255,255,255,.6)');
 }else if(o.t==='bird'){
  const f=Math.sin(o.ph);
  ell(ctx,x+20,y,15,10,'#ff6b6b');ell(ctx,x+20,y+3,10,6,'#ffd0c0');
  ctx.fillStyle='#e04848';ctx.beginPath();ctx.moveTo(x+16,y-2);ctx.quadraticCurveTo(x+24,y-2-f*18,x+34,y-2-f*14);ctx.lineTo(x+26,y+2);ctx.fill();
  ell(ctx,x+7,y-4,8,7,'#ff6b6b');ell(ctx,x+5,y-6,2.3,2.3,'#222');ell(ctx,x+4.4,y-6.6,0.9,0.9,'#fff');
  ctx.fillStyle='#ffb22e';ctx.beginPath();ctx.moveTo(x,y-5);ctx.lineTo(x-7,y-3);ctx.lineTo(x,y-1);ctx.fill();
  ctx.fillStyle='#e04848';ctx.beginPath();ctx.moveTo(x+34,y);ctx.lineTo(x+42,y-5);ctx.lineTo(x+42,y+4);ctx.fill();
 }
}
function drawCoin(c){
 const s=Math.abs(Math.cos(time*4+c.ph*0.6));
 ell(ctx,c.x,c.y,8*s+1.5,8,'#f2a500');ell(ctx,c.x,c.y,6*s+1,6,'#ffd84a');
 if(s>0.5){ctx.fillStyle='#f2a500';ctx.fillRect(c.x-1,c.y-3.5,2,7);}
}
function drawHero(g,id,st){
 g.save();
 const run=st.ground&&!st.duck;
 const bob=run?Math.abs(Math.sin(st.anim))*-2.5:0;
 g.translate(0,st.y+bob);
 if(st.rot)g.rotate(-st.rot);
 let sx=1,sy=1;
 if(!st.ground){sx=0.92;sy=1.1;}
 if(st.squash>0){sx=1+st.squash*0.25;sy=1-st.squash*0.22;}
 if(st.duck){sx*=1.12;sy*=0.66;}
 g.scale(sx,sy);
 if(id==='gallina')hen(g,st);else if(id==='gallo')rooster(g,st);else capy(g,st);
 g.restore();
}
function legs(g,st,xs,len,col,w){
 g.strokeStyle=col;g.lineWidth=w;g.lineCap='round';
 xs.forEach((x,i)=>{const a=st.ground?Math.sin(st.anim+(i%2?Math.PI:0))*0.6:(i%2?0.5:-0.4);
  g.beginPath();g.moveTo(x,-len);g.lineTo(x+Math.sin(a)*len*0.8,-Math.cos(a)*len*0.15);g.stroke();});
}
function capy(g,st){
 // patas cortas y gruesas
 legs(g,st,[-22,-12,6,15],8,'#7a4526',7);
 // cuerpo de barril
 rr(g,-34,-38,58,32,15);g.fillStyle='#b8693a';g.fill();
 g.save();rr(g,-34,-38,58,32,15);g.clip();g.fillStyle='#9a5530';g.fillRect(-36,-40,62,11);
 g.fillStyle='#c98050';g.fillRect(-36,-15,62,10);g.restore();
 // cabeza grande y rectangular
 rr(g,10,-46,34,26,8);g.fillStyle='#b8693a';g.fill();
 g.fillStyle='#9a5530';rr(g,12,-46,30,6,4);g.fill();
 // hocico ancho y plano
 rr(g,32,-42,16,23,6);g.fillStyle='#8f4f2c';g.fill();
 rr(g,44,-40,4,6,2);g.fillStyle='#3a2114';g.fill();
 g.strokeStyle='#3a2114';g.lineWidth=1.4;g.lineCap='round';g.beginPath();g.moveTo(40,-25);g.lineTo(46,-25);g.stroke();
 // orejitas arriba
 ell(g,16,-47,4.5,4,'#8f4f2c');ell(g,16,-47,2.2,2,'#5e3220');
 // ojo pequeño y alto
 ell(g,27,-40,2.6,2.6,'#1e120a');ell(g,27.8,-40.8,0.9,0.9,'#fff');
 ell(g,24,-31,3.5,2,'rgba(255,120,110,.45)');
 // mandarina
 const oy=-54+(st.orangeY||0);
 ell(g,23,oy,8.5,7.5,'#ff9a1f');ell(g,21,oy-2,3,2,'#ffc46a');
 g.fillStyle='#4caf50';g.beginPath();g.ellipse(27,oy-8,5,2.4,-0.5,0,Math.PI*2);g.fill();
 g.fillStyle='#6b4423';g.fillRect(22.5,oy-9,1.6,3);
}
function rooster(g,st){
 legs(g,st,[-3,6],17,'#ffb000',3.2);
 // cola arqueada
 const tail=[['#1e9e6a',-0.2],['#16a3b5',0.25],['#ff8a1f',0.7],['#2bbf5a',1.1]];
 g.lineCap='round';
 tail.forEach(([c,a],i)=>{g.strokeStyle=c;g.lineWidth=6-i*0.6;g.beginPath();g.moveTo(-12,-30);
  g.quadraticCurveTo(-30-i*2,-62+a*14,-34+i*3,-30+a*10);g.stroke();});
 ell(g,0,-30,17,14,'#c8452a');ell(g,2,-26,12,9,'#ffd166');
 // cuello alto
 g.fillStyle='#e67a2a';g.beginPath();g.moveTo(4,-38);g.quadraticCurveTo(8,-52,12,-58);g.lineTo(20,-54);g.quadraticCurveTo(16,-44,14,-34);g.fill();
 ell(g,15,-56,9,9,'#f3a03a');
 // cresta grande y barbas
 ell(g,9,-66,4,4.5,'#ff2d2d');ell(g,14,-68,4.5,5,'#ff2d2d');ell(g,19,-65,4,4.5,'#ff2d2d');
 ell(g,21,-48,3,5,'#ff2d2d');
 g.fillStyle='#ffb000';g.beginPath();g.moveTo(22,-58);g.lineTo(30,-55);g.lineTo(22,-52);g.fill();
 ell(g,17,-58,2.3,2.5,'#222');ell(g,17.8,-59,0.9,0.9,'#fff');
 const flap=st.flapT>0?Math.sin(st.flapT*40)*0.9:(st.ground?Math.sin(st.anim*0.5)*0.15:0.3);
 g.save();g.translate(-2,-32);g.rotate(flap);ell(g,-3,4,12,7,'#8e2f1c');g.restore();
}
function hen(g,st){
 legs(g,st,[-4,5],12,'#ff9a1f',3);
 g.fillStyle='#fff';g.beginPath();g.moveTo(-14,-26);g.lineTo(-26,-42);g.lineTo(-20,-24);g.lineTo(-28,-34);g.lineTo(-16,-18);g.fill();
 ell(g,0,-24,18,15,'#fffaf0');
 ell(g,13,-38,10,10,'#fffaf0');
 g.fillStyle='#ff4d4d';ell(g,10,-49,3.5,3.5,'#ff4d4d');ell(g,15,-50,3.5,3.5,'#ff4d4d');ell(g,19,-47,3,3,'#ff4d4d');
 ell(g,21,-31,2.5,4,'#ff4d4d');
 g.fillStyle='#ffb22e';g.beginPath();g.moveTo(21,-39);g.lineTo(28,-36);g.lineTo(21,-33);g.fill();
 ell(g,16,-40,2.4,2.6,'#222');ell(g,16.8,-41,0.9,0.9,'#fff');
 ell(g,10,-33,3,2,'rgba(255,140,160,.6)');
 // ala
 const flap=st.glide?-0.9:(st.flapT>0?Math.sin(st.flapT*40)*0.9:(st.ground?Math.sin(st.anim*0.5)*0.15:0.3));
 g.save();g.translate(-2,-26);g.rotate(flap);ell(g,-4,4,13,7,'#f0e6d6');g.restore();
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
 ctx.setTransform(dpr*S,0,0,dpr*S,0,0);
 const dk=drawBG();
 if(dk>0){ctx.fillStyle='rgba(15,20,60,'+(dk*0.35)+')';ctx.fillRect(0,0,VW,VH);}
 for(const c of coins)drawCoin(c);
 for(const o of obs)drawObs(o);
 // sombra
 const sh=Math.max(0.3,1+p.y/120);
 ell(ctx,p.x,GY+2,24*sh,4*sh,'rgba(0,0,0,.18)');
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
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
if(standalone()&&screen.orientation&&screen.orientation.lock)screen.orientation.lock('landscape').catch(()=>{});
resize();refreshTitle();show('title');
p.y=0;
requestAnimationFrame(loop);
window.__capi={drawHero,get GY(){return GY},get state(){return state},get p(){return p},get obs(){return obs},setDist(d){dist=d},jumpPress,jumpRelease,duckOn,duckOff,startGame,VERSION};
})();
