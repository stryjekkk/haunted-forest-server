(()=>{
'use strict';
const $=id=>document.getElementById(id);
const canvas=$('canvas'),ctx=canvas.getContext('2d');let ws,id,code,trees=[],state={players:[],houses:[],decor:[],monsters:[]};
let camera={x:1100,y:750},world={w:2200,h:1500},view={w:innerWidth,h:innerHeight},keys=new Set(),lastMove=0,noticeTimer=0;
const emoji={pumpkin:'🎃',ghost:'👻',gravestone:'🪦',lantern:'🏮',web:'🕸️'};
const forestFloor=[];let rng=2026;function random(){rng=(rng*1664525+1013904223)>>>0;return rng/4294967296;}
for(let i=0;i<1300;i++)forestFloor.push({x:random()*2200,y:random()*1500,r:random()*2+1,c:random()>.6?'#294338':'#223d3a'});
function resize(){const d=Math.min(devicePixelRatio||1,2);view.w=innerWidth;view.h=innerHeight;canvas.width=view.w*d;canvas.height=view.h*d;canvas.style.width=view.w+'px';canvas.style.height=view.h+'px';ctx.setTransform(d,0,0,d,0,0);}addEventListener('resize',resize);resize();
function toast(text){const e=$('toast');e.textContent=text;e.classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>e.classList.remove('show'),3300);}
function send(data){if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data));}
function join(){let name=$('name').value.trim()||'Explorer';let room=$('room').value.trim().toUpperCase().replace(/[^A-Z0-9]/g,'');const search=new URLSearchParams(location.search);if(!room)room=search.get('room')||'';
  const configured=$('server').value.trim();
  if(!configured){$('error').textContent='Add your multiplayer server address first. Netlify cannot host the live WebSocket room server.';return;}
  let url;
  try {const parsed=new URL(configured);if(!['https:','http:','wss:','ws:'].includes(parsed.protocol))throw Error('Invalid protocol');url=parsed.href.replace(/^http:/,'ws:').replace(/^https:/,'wss:').replace(/\/$/,'');if(location.protocol==='https:' && !url.startsWith('wss:'))throw Error('HTTPS site requires a secure WSS connection');}
  catch{$('error').textContent='Enter a valid HTTPS server URL (for example https://your-game.onrender.com).';return;}
  localStorage.setItem('hauntedForestServer',configured);
  ws=new WebSocket(url);$('error').textContent='';$('start').disabled=true;
  ws.onopen=()=>send({type:'join',name,room});
  ws.onmessage=event=>{let m;try{m=JSON.parse(event.data)}catch{return;}
    if(m.type==='welcome'){id=m.id;code=m.code;world={w:m.width,h:m.height};trees=m.trees||[];$('roomcode').textContent=code;$('status').textContent='● CONNECTED';$('landing').style.display='none';history.replaceState(null,'',location.pathname+'?'+new URLSearchParams({room:code,server:$('server').value.trim()}));toast('🌕 Your Halloween adventure begins!');}
    if(m.type==='state'){state=m;updateHUD();}
    if(m.type==='notice')toast(m.message);
    if(m.type==='error'){$('error').textContent=m.message;$('start').disabled=false;}
    if(m.type==='chat')chatLine(m.name,m.text);
  };
  ws.onerror=()=>{$('error').textContent='Cannot connect to the multiplayer server. Check its URL and whether it is running.';$('start').disabled=false;};
  ws.onclose=()=>{$('status').textContent='● DISCONNECTED';if(id)toast('Disconnected from the forest. Reload to reconnect.');$('start').disabled=false;};
}
const query=new URLSearchParams(location.search);const invite=query.get('room');if(invite)$('room').value=invite;
const serverFromLink=query.get('server');const stored=localStorage.getItem('hauntedForestServer')||'';
if(serverFromLink||stored)$('server').value=serverFromLink||stored;
$('start').addEventListener('click',join);$('room').addEventListener('keydown',e=>{if(e.key==='Enter')join()});
$('copy').addEventListener('click',async()=>{const link=location.origin+location.pathname+'?'+new URLSearchParams({room:code,server:$('server').value.trim()});try{await navigator.clipboard.writeText(link);toast('Invite link copied! Share it with a friend.');}catch{prompt('Copy the invite link:',link);}});
function action(name){send({type:name});}document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>action(b.dataset.action)));
document.querySelectorAll('[data-decor]').forEach(b=>b.addEventListener('click',()=>send({type:'decorate',decor:b.dataset.decor})));
function chatLine(name,message){const p=document.createElement('div'),b=document.createElement('b');b.textContent=name+': ';p.append(b,document.createTextNode(message));$('messages').appendChild(p);while($('messages').children.length>7)$('messages').firstChild.remove();$('messages').scrollTop=$('messages').scrollHeight;}
$('chat').addEventListener('submit',e=>{e.preventDefault();const input=$('chatinput');if(input.value.trim())send({type:'chat',text:input.value.trim()});input.value='';});
const prevented=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ']);addEventListener('keydown',e=>{if(document.activeElement?.tagName==='INPUT')return;const k=e.key.toLowerCase();if(prevented.has(e.key))e.preventDefault();keys.add(k);if(e.repeat)return;if(k==='b')action('build');if(k==='h')action('hide');if('12345'.includes(k)){send({type:'decorate',decor:['pumpkin','ghost','gravestone','lantern','web'][Number(k)-1]});}});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
const dirMap={up:'arrowup',down:'arrowdown',left:'arrowleft',right:'arrowright'};
document.querySelectorAll('[data-dir]').forEach(b=>{const k=dirMap[b.dataset.dir];b.addEventListener('pointerdown',e=>{e.preventDefault();keys.add(k);b.setPointerCapture(e.pointerId)});b.addEventListener('pointerup',()=>keys.delete(k));b.addEventListener('pointercancel',()=>keys.delete(k));b.addEventListener('lostpointercapture',()=>keys.delete(k));});
function updateHUD(){const me=state.players.find(p=>p.id===id);if(!me)return;
  $('hearts').textContent='♥ '.repeat(me.health)||'—';$('homes').textContent=state.houses.filter(h=>h.owner===id).length+'/3';$('decorCount').textContent=state.decor.filter(d=>d.owner===id).length;$('playerCount').textContent=state.players.length;$('points').textContent=me.score;
  $('players').replaceChildren();for(const p of state.players){const r=document.createElement('div');r.className='playeritem';const d=document.createElement('span');d.className='dot';d.style.background=p.color;const n=document.createElement('span');n.textContent=p.name+(p.id===id?' (you)':'');const s=document.createElement('span');s.textContent=p.hidden?'🏠 Safe':'🏃 Running';r.append(d,n,s);$('players').append(r);}
}
function rounded(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.stroke();}}
function text(s,x,y,size=14,color='#fff',align='center'){ctx.font=`${size}px Inter,Arial,sans-serif`;ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(s,x,y);}
function emojiDraw(s,x,y,size=30){ctx.font=`${size}px serif`;ctx.textAlign='center';ctx.fillText(s,x,y);}
function tree(t){ctx.fillStyle='#07131060';ctx.beginPath();ctx.ellipse(t.x+8,t.y+13,t.r+14,t.r*.67,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#42372f';ctx.fillRect(t.x-5,t.y-1,10,28);for(let i=0;i<3;i++){ctx.beginPath();ctx.fillStyle=['#102923','#17392e','#214538'][i];ctx.arc(t.x+(i-1)*7,t.y-(i===1?11:3),t.r*(i===1?1.25:.85),0,Math.PI*2);ctx.fill();}ctx.fillStyle='#44634c';ctx.beginPath();ctx.arc(t.x-t.r*.25,t.y-t.r*.6,3,0,Math.PI*2);ctx.fill();}
function house(h){const x=h.x,y=h.y;ctx.fillStyle='#05060890';ctx.beginPath();ctx.ellipse(x,y+49,95,40,0,0,Math.PI*2);ctx.fill();rounded(x-67,y-35,134,90,7,'#574854','#17121d');ctx.fillStyle=['#382d50','#523a45','#3d4657','#564034'][h.style]||'#493247';ctx.beginPath();ctx.moveTo(x-82,y-35);ctx.lineTo(x,y-103);ctx.lineTo(x+82,y-35);ctx.closePath();ctx.fill();ctx.strokeStyle='#c49a73';ctx.lineWidth=3;ctx.stroke();rounded(x-47,y-14,32,31,4,'#ffcd73','#2d2022');rounded(x+20,y-14,32,31,4,'#ffcd73','#2d2022');ctx.strokeStyle='#61472f';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-31,y-14);ctx.lineTo(x-31,y+17);ctx.moveTo(x+36,y-14);ctx.lineTo(x+36,y+17);ctx.stroke();rounded(x-12,y+13,30,42,4,'#261e2a','#d9a371');ctx.fillStyle='#fbd489';ctx.beginPath();ctx.arc(x+10,y+34,3,0,Math.PI*2);ctx.fill();emojiDraw('🦇',x-2,y-55,22);rounded(x-65,y+64,130,22,5,'#101820d9');text(h.name.slice(0,22),x,y+79,11,'#fff0d7');}
function monster(m,i){const x=m.x,y=m.y;ctx.fillStyle='#05050775';ctx.beginPath();ctx.ellipse(x,y+20,25,10,0,0,Math.PI*2);ctx.fill();const aura=ctx.createRadialGradient(x,y,5,x,y,50);aura.addColorStop(0,'#fc3b3b55');aura.addColorStop(1,'#eb333300');ctx.fillStyle=aura;ctx.beginPath();ctx.arc(x,y,50,0,Math.PI*2);ctx.fill();emojiDraw(['👹','🧟','👺','💀','🧛'][i%5],x,y+12,43);}
function person(p){if(p.hidden)return;const x=p.x,y=p.y;ctx.fillStyle='#04050790';ctx.beginPath();ctx.ellipse(x,y+16,16,7,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=p.color;rounded(x-11,y-5,22,24,7,p.color);ctx.fillStyle='#f4c6a9';ctx.beginPath();ctx.arc(x,y-15,11,0,Math.PI*2);ctx.fill();ctx.fillStyle='#17222c';ctx.beginPath();ctx.arc(x-3,y-17,1.5,0,Math.PI*2);ctx.arc(x+4,y-17,1.5,0,Math.PI*2);ctx.fill();if(p.id===id){ctx.strokeStyle='#fff4a2';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y-2,24,0,Math.PI*2);ctx.stroke();}rounded(x-36,y-47,72,19,8,'#111520d9');text(p.name.slice(0,12),x,y-34,10,'#fff');for(let i=0;i<p.health;i++)text('♥',x-14+i*14,y-56,13,'#ff7f86');}
let t=0;
function draw(now){requestAnimationFrame(draw);t=now;
  const me=state.players.find(p=>p.id===id);if(me){camera.x+=(me.x-camera.x)*.075;camera.y+=(me.y-camera.y)*.075;}
  ctx.clearRect(0,0,view.w,view.h);ctx.fillStyle='#142826';ctx.fillRect(0,0,view.w,view.h);
  ctx.save();ctx.translate(view.w/2-camera.x,view.h/2-camera.y);
  ctx.fillStyle='#1a3530';ctx.fillRect(0,0,world.w,world.h);
  for(const f of forestFloor){ctx.fillStyle=f.c;ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,Math.PI*2);ctx.fill();}
  ctx.strokeStyle='#59775e60';ctx.lineWidth=9;ctx.strokeRect(5,5,world.w-10,world.h-10);
  ctx.fillStyle='#9ba97f18';ctx.beginPath();ctx.arc(world.w/2,world.h/2,185,0,Math.PI*2);ctx.fill();
  for(const d of state.decor)emojiDraw(emoji[d.type]||'🎃',d.x,d.y+7,29);
  for(const tr of trees)tree(tr);
  for(const h of state.houses)house(h);
  state.monsters.forEach(monster);
  for(const p of state.players)person(p);
  if(me?.hidden){const h=state.houses.find(h=>h.id===me.houseId);if(h){ctx.fillStyle='#60ffbb';ctx.beginPath();ctx.arc(h.x,h.y-110,7+Math.sin(now/200)*2,0,Math.PI*2);ctx.fill();text('YOU ARE SAFE INSIDE · PRESS H TO EXIT',h.x,h.y-125,12,'#d5ffe8');}}
  ctx.restore();
  const vignette=ctx.createRadialGradient(view.w/2,view.h/2,view.h*.2,view.w/2,view.h/2,Math.max(view.w,view.h)*.75);vignette.addColorStop(0,'#0000');vignette.addColorStop(1,'#02050bbb');ctx.fillStyle=vignette;ctx.fillRect(0,0,view.w,view.h);
  ctx.font='54px serif';ctx.textAlign='center';ctx.fillText('🌕',view.w-70,125);
  if(now-lastMove>65){let dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),dy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);if(dx||dy)send({type:'move',dx,dy});lastMove=now;}
}
requestAnimationFrame(draw);
})();
