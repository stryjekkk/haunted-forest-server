const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const WebSocket = require('ws');

const PORT = Number(process.env.PORT) || 3000;
const WIDTH = 2200, HEIGHT = 1500;
const rooms = new Map();
const MIME = {'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.ico':'image/x-icon'};
const server = http.createServer((req,res)=>{
  let pathname;
  try { pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  if (pathname === '/') pathname='/index.html';
  const publicDir=path.join(__dirname,'public');
  const file=path.resolve(publicDir,'.'+pathname);
  if (!file.startsWith(publicDir+path.sep)) {res.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404).end('Not found');return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'}).end(data);
  });
});
const wss = new WebSocket.Server({server});
const rand=(a,b)=>a+Math.random()*(b-a);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const safeName=(value)=>String(value||'Explorer').replace(/[^a-zA-Z0-9 _-]/g,'').trim().slice(0,18)||'Explorer';
const key=()=>crypto.randomBytes(3).toString('hex').toUpperCase();
const spawn=(n=0)=>({x:WIDTH/2+(n%5-2)*60,y:HEIGHT/2+(Math.floor(n/5)-1)*60});
function makeTrees(){
  const trees=[];
  for(let i=0;i<105;i++){
    const t={x:rand(55,WIDTH-55),y:rand(55,HEIGHT-55),r:rand(15,30)};
    if(dist(t,{x:WIDTH/2,y:HEIGHT/2})<230) continue;
    trees.push(t);
  }
  return trees;
}
function newRoom(code){
  return {code,players:new Map(),houses:[],decor:[],monsters:[0,1,2,3,4].map((_,i)=>({id:i,x:rand(90,WIDTH-90),y:rand(90,HEIGHT-90),target:null,ang:rand(0,6.28)})),trees:makeTrees(),created:Date.now(),monsterTime:0};
}
function send(ws,obj){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj));}
function broadcast(room,obj){const s=JSON.stringify(obj);for(const p of room.players.values())if(p.ws.readyState===WebSocket.OPEN)p.ws.send(s);}
const validSpot=(room,x,y,spacing=0)=> x>55&&x<WIDTH-55&&y>55&&y<HEIGHT-55 && !room.trees.some(t=>Math.hypot(t.x-x,t.y-y)<t.r+spacing) && !room.houses.some(h=>Math.hypot(h.x-x,h.y-y)<80+spacing);
function join(ws,msg){
  const code = typeof msg.room==='string' && /^[A-Z0-9]{4,8}$/.test(msg.room.toUpperCase()) ? msg.room.toUpperCase() : key();
  let room=rooms.get(code);
  if(!room){room=newRoom(code);rooms.set(code,room);}
  if(room.players.size>=12){send(ws,{type:'error',message:'Room is full (12 players maximum).'});return;}
  const id=crypto.randomUUID();
  const pos=spawn(room.players.size);
  const player={id,name:safeName(msg.name),color:['#ffb9d9','#8ebcff','#ffda89','#b5f1b1','#dfbaff','#ff9f91'][room.players.size%6],x:pos.x,y:pos.y,health:3,hidden:false,houseId:null,score:0,lastHit:0,ws};
  room.players.set(id,player);ws.room=code;ws.playerId=id;
  send(ws,{type:'welcome',id,code,width:WIDTH,height:HEIGHT,trees:room.trees});
  broadcast(room,{type:'notice',message:`${player.name} entered the haunted forest!`});
}
function act(ws,msg){
  const room=rooms.get(ws.room),p=room?.players.get(ws.playerId);
  if(!p)return;
  if(msg.type==='move'){
    if(p.hidden)return;
    const dx=clamp(Number(msg.dx)||0,-1,1),dy=clamp(Number(msg.dy)||0,-1,1);
    const l=Math.hypot(dx,dy)||1;const speed=7;
    const x=clamp(p.x+dx/l*speed,25,WIDTH-25),y=clamp(p.y+dy/l*speed,25,HEIGHT-25);
    const blocked=room.trees.some(t=>Math.hypot(t.x-x,t.y-y)<t.r+13);
    if(!blocked){p.x=x;p.y=y;}
    return;
  }
  if(msg.type==='build'){
    if(p.hidden)return;
    if(room.houses.filter(h=>h.owner===p.id).length>=3){send(ws,{type:'notice',message:'You can build up to 3 houses!'});return;}
    const x=clamp(p.x+55,65,WIDTH-65),y=clamp(p.y+18,65,HEIGHT-65);
    if(!validSpot(room,x,y,85)){send(ws,{type:'notice',message:'Find a clearing to build your spooky house.'});return;}
    const house={id:crypto.randomUUID(),owner:p.id,x,y,style:room.houses.length%4,name:`${p.name}'s haunted house`};
    room.houses.push(house);broadcast(room,{type:'notice',message:`${p.name} built a haunted house!`});return;
  }
  if(msg.type==='decorate'){
    const type=['pumpkin','ghost','gravestone','lantern','web'].includes(msg.decor)?msg.decor:'pumpkin';
    if(room.decor.filter(d=>d.owner===p.id).length>=50){send(ws,{type:'notice',message:'Maximum 50 decorations per player.'});return;}
    if(p.hidden)return;
    const x=clamp(p.x+rand(-28,28),30,WIDTH-30),y=clamp(p.y+rand(-28,28),30,HEIGHT-30);
    room.decor.push({id:crypto.randomUUID(),owner:p.id,type,x,y});
    p.score+=5;return;
  }
  if(msg.type==='hide'){
    if(p.hidden){p.hidden=false;const h=room.houses.find(h=>h.id===p.houseId);if(h){p.x=h.x+75;p.y=h.y+55;}p.houseId=null;return;}
    const h=room.houses.find(h=>Math.hypot(h.x-p.x,h.y-p.y)<130);
    if(!h){send(ws,{type:'notice',message:'Move near a house to hide!'});return;}
    p.hidden=true;p.houseId=h.id;p.x=h.x;p.y=h.y;return;
  }
  if(msg.type==='chat'){
    const text=String(msg.text||'').replace(/[<>]/g,'').slice(0,100).trim();
    if(text)broadcast(room,{type:'chat',name:p.name,text});
  }
}
wss.on('connection',ws=>{
  ws.on('message',raw=>{
    if(raw.length>1024)return;
    let msg;try{msg=JSON.parse(raw.toString())}catch{return;}
    if(!ws.playerId){if(msg.type==='join')join(ws,msg);}else act(ws,msg);
  });
  ws.on('close',()=>{
    const room=rooms.get(ws.room),p=room?.players.get(ws.playerId);
    if(!p)return;
    room.players.delete(p.id);broadcast(room,{type:'notice',message:`${p.name} left the forest.`});
    if(!room.players.size)rooms.delete(room.code);
  });
});
function tick(){
  for(const room of rooms.values()){
    const players=[...room.players.values()];
    for(const m of room.monsters){
      const targets=players.filter(p=>!p.hidden && p.health>0);
      targets.sort((a,b)=>dist(a,m)-dist(b,m));
      const target=targets[0];
      if(target && dist(target,m)<420){
        const theta=Math.atan2(target.y-m.y,target.x-m.x);m.ang=theta;
        m.x=clamp(m.x+Math.cos(theta)*2.6,18,WIDTH-18);m.y=clamp(m.y+Math.sin(theta)*2.6,18,HEIGHT-18);
        if(dist(m,target)<26 && Date.now()-target.lastHit>1800){
          target.health--;target.lastHit=Date.now();broadcast(room,{type:'notice',message:`👹 A monster caught ${target.name}! ${target.health} hearts left.`});
          if(target.health<=0){target.health=3;target.x=WIDTH/2;target.y=HEIGHT/2;target.hidden=false;broadcast(room,{type:'notice',message:`${target.name} respawned at the moonlit clearing.`});}
        }
      }else{
        if(Math.random()<0.02)m.ang=rand(0,Math.PI*2);
        m.x=clamp(m.x+Math.cos(m.ang)*0.75,18,WIDTH-18);
        m.y=clamp(m.y+Math.sin(m.ang)*0.75,18,HEIGHT-18);
      }
    }
    const state={type:'state',players:players.map(({ws,lastHit,...p})=>p),houses:room.houses,decor:room.decor,monsters:room.monsters};
    broadcast(room,state);
  }
}
setInterval(tick,100);
server.listen(PORT,()=>console.log(`Haunted Forest listening on http://localhost:${PORT}`));
