const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],te=new TextEncoder(),td=new TextDecoder();
let ws,ip,pid=1,rx=0,sim=false,opened=false;const H={t:[],h:[],g:[]};
// ---------- encodage MQTT ----------
const u16=n=>[n>>8,n&255],str=s=>{const b=te.encode(s);return[...u16(b.length),...b]};
const rl=n=>{const o=[];do{let d=n%128;n=Math.floor(n/128);o.push(n>0?d|128:d)}while(n>0);return o};
const hex=b=>[...b].slice(0,40).map(x=>x.toString(16).padStart(2,'0')).join(' ')+(b.length>40?' …':'');
const now=()=>new Date().toLocaleTimeString('fr',{hour12:false})+'.'+String(Date.now()%1000).padStart(3,'0');
const pubPkt=(t,pl)=>new Uint8Array([0x30,...rl(str(t).length+pl.length),...str(t),...te.encode(pl)]);
// ---------- config ----------
const F=['host','port','ip'];
try{F.forEach(k=>{const v=localStorage.getItem('iot_'+k);if(v)$('#'+k).value=v})}catch(e){}
$('#cfgBtn').onclick=()=>$('#cfg').classList.toggle('show');
$('#slow').oninput=e=>$('#slowv').textContent=e.target.value;
const badge=(c,t)=>{const b=$('#badge');b.className='badge '+c;b.textContent=t};
// ---------- journal ----------
function log(k,src,ev,d=''){const s=`<div><span style="color:var(--m)">${now()}</span> <b class="src-${src[0]}">${src}</b> ${ev} <span style="color:var(--m)">${d}</span></div>`;
 $$('.log').filter(l=>k.includes(l.dataset.k)).forEach(l=>{l.insertAdjacentHTML('afterbegin',s);if(l.children.length>150)l.lastChild.remove()})}
const L=(a,id)=>$(id).innerHTML=a.map(([k,t])=>`<li id="s-${k}">${t}</li>`).join('');
const S1=[['w','ESP32 : connexion WiFi (hotspot du PC)'],['i','ESP32 : IP reçue en DHCP'],['t','ESP32 : TCP 3-way handshake vers Mosquitto (SYN, SYN-ACK, ACK)'],['m','ESP32 : MQTT CONNECT → CONNACK'],['s','ESP32 : SUBSCRIBE (topic commande)'],['D1','Dashboard : WebSocket ouvert (TCP + HTTP Upgrade 101)'],['D2','Dashboard : MQTT CONNECT → CONNACK'],['D3','Dashboard : SUBSCRIBE → SUBACK'],['D4','Dashboard : 1er PUBLISH reçu']];
const S2=[['c1','Clic utilisateur'],['c2','Construction du paquet PUBLISH (QoS 1)'],['c3','Envoi au broker via WebSocket'],['c4','Broker répond PUBACK (accusé de réception)'],['c5','ESP32 reçoit le PUBLISH'],['c6','ESP32 pilote la GPIO du relais'],['c7','ESP32 publie le nouvel état'],['c8',"Dashboard reçoit l'état → pompe"]];
const resetSteps=()=>{L(S1,'#l1');L(S2,'#l2')};resetSteps();
const step=id=>{const e=document.getElementById('s-'+id);e&&e.classList.add('ok')};
const lit=(f,i)=>$$('#f'+f+' .node').forEach((n,k)=>n.classList.toggle('lit',k==i));
$$('nav button').forEach(b=>b.onclick=()=>{$$('nav button').forEach(x=>x.classList.toggle('act',x==b));$$('.pg').forEach(p=>p.classList.toggle('act',p.id=='p'+b.dataset.p))});
// ---------- connexion ----------
function send(first,body){const p=new Uint8Array([first,...rl(body.length),...body]);ws.send(p);return p}
function stop(){if(ws){ws.onclose=null;try{ws.close()}catch(e){}ws=null}clearInterval(simT);badge('off','Déconnecté')}
function start(useSim){ip=$('#ip').value.trim();if(!ip)return alert("Saisir l'IP de l'ESP32 (affichée dans le moniteur série)");
 try{F.forEach(k=>localStorage.setItem('iot_'+k,$('#'+k).value))}catch(e){}
 stop();resetSteps();sim=useSim;opened=false;
 if(sim){log('rc','SIM','Mode simulation','ESP32 + Mosquitto émulés dans le navigateur — mêmes paquets MQTT, mêmes octets');ws=makeSim();wire();ws.onopen()}
 else{log('rc','DASH','Ouverture WebSocket','handshake TCP (SYN, SYN-ACK, ACK) puis GET Upgrade — invisible en JS, visible dans Wireshark');
  ws=new WebSocket(`ws://${$('#host').value}:${$('#port').value}`,'mqtt');ws.binaryType='arraybuffer';wire();
  const w=ws;setTimeout(()=>{if(w===ws&&!opened){log('rc','DASH','Broker injoignable','IP ? Mosquitto lancé ? listener 9001 ? pare-feu ?');if($('#auto').checked)start(true);else stop()}},3000)}}
function wire(){ws.onopen=()=>{opened=true;step('D1');badge(sim?'sim':'real',sim?'Simulation':'Connecté (réel)');log('rc','DASH','WebSocket OPEN','101 Switching Protocols');
  const p=send(0x10,[...str('MQTT'),4,2,...u16(30),...str('dash-'+Math.random().toString(16).slice(2,8))]);
  log('rc','DASH','→ CONNECT',hex(p)+' | MQTT 3.1.1, clean session, keepalive 30 s')};
 ws.onmessage=e=>parse(new Uint8Array(e.data));
 ws.onclose=()=>{badge('off','Déconnecté');log('rc','DASH','Connexion fermée')}}
$('#bConn').onclick=()=>start(false);$('#bSim').onclick=()=>start(true);$('#bDisc').onclick=stop;
// ---------- décodage MQTT ----------
function parse(b){let i=0;while(i<b.length){let m=1,l=0,j=i+1,d;do{d=b[j++];l+=(d&127)*m;m*=128}while(d&128);onPkt(b[i]>>4,b.slice(i,j+l),b.slice(j,j+l));i=j+l}}
function onPkt(t,pk,bd){const h=hex(pk);
 if(t==2){step('D2');log('rc','BROKER','← CONNACK',h+' | code '+bd[1]+' (0 = accepté)');
  const p=send(0x82,[...u16(pid++),...str(ip+'/esp/#'),0]);log('rc','DASH','→ SUBSCRIBE',ip+'/esp/# | '+hex(p))}
 else if(t==9){step('D3');log('rc','BROKER','← SUBACK',h+' | abonnement confirmé')}
 else if(t==4){step('c4');lit(2,1);log('c','BROKER','← PUBACK',h+' | id '+(bd[0]<<8|bd[1]))}
 else if(t==13)log('rc','BROKER','← PINGRESP',h);
 else if(t==3){const q=(pk[0]>>1)&3;let j=1;while(pk[j++]&128);const tl=pk[j]<<8|pk[j+1];
  data(td.decode(pk.slice(j+2,j+2+tl)),td.decode(pk.slice(j+2+tl+(q?2:0))),pk)}}
setInterval(()=>{if(ws&&ws.readyState==1){send(0xC0,[]);log('rc','DASH','→ PINGREQ','c0 00 (keepalive)');if(sim)setTimeout(()=>ws.onmessage({data:new Uint8Array([0xD0,0]).buffer}),40)}},15000);
const M={WIFI:['w','rc'],IP:['i','rc'],TCP:['t','rc'],MQTT_CONNECT:[0,'rc'],MQTT_CONNACK:['m','rc'],SUBSCRIBE:['s','rc'],READ:[0,'r',0],JSON:[0,'r',1],PUB_DHT:[0,'r',2],PUB_GAS:[0,'r',2],RX_CMD:['c5','c',2],GPIO:['c6','c',3],PUB_ETAT:['c7','c',1]};
function tr(o){const m=M[o.step]||[0,'rc'];if(m[0])step(m[0]);log(m[1],'ESP32',o.step,`[esp ${o.ms} ms] ${o.d}`);if(m[1]=='r')lit(1,m[2]);if(m[1]=='c')lit(2,m[2])}
const push=(k,v)=>{H[k].push(v);if(H[k].length>60)H[k].shift()};
function data(topic,pl,pk){rx++;$('#kn').textContent=rx;const n=topic.split('/esp/')[1],h=hex(pk);
 if(n=='trace'){try{tr(JSON.parse(pl))}catch(e){}return}
 if(n=='pompe/cmd')return;
 step('D4');
 if(n=='dht22'){const o=JSON.parse(pl);push('t',o.t);push('h',o.h);$('#vt').textContent=$('#kt').textContent=o.t;$('#vh').textContent=$('#kh').textContent=o.h;lit(1,3);log('r','BROKER','→ PUBLISH '+n,pl+' | '+h);decode(pk)}
 else if(n=='gas'){push('g',+pl);$('#vg').textContent=pl;lit(1,3);log('r','BROKER','→ PUBLISH '+n,pl+' | '+h);decode(pk)}
 else if(n=='pompe/etat'){setPump(pl=='ON');step('c8');lit(2,0);log('c','BROKER','→ PUBLISH etat',pl+' | '+h)}
 draw()}
function decode(pk){const q=(pk[0]>>1)&3;let j=1;while(pk[j++]&128);const tl=pk[j]<<8|pk[j+1];
 $('#dec').textContent=`Octet 1 : 0x${pk[0].toString(16)} → type ${pk[0]>>4} (PUBLISH), QoS ${q}, RETAIN ${pk[0]&1}\nRemaining Length : ${pk.length-j} octets\nTopic (${tl} octets) : ${td.decode(pk.slice(j+2,j+2+tl))}\nPayload : ${td.decode(pk.slice(j+2+tl+(q?2:0)))}\n\nHex : ${hex(pk)}`}
function setPump(on){$$('.pump').forEach(p=>p.classList.toggle('spin',on));$$('.ps').forEach(e=>e.textContent=on?'ON':'OFF')}
async function cmd(v){if(!ws||ws.readyState!=1)return alert('Non connecté');
 $$('#l2 li').forEach(l=>l.classList.remove('ok'));const w=()=>new Promise(r=>setTimeout(r,+$('#slow').value));
 lit(2,0);step('c1');log('c','DASH','Clic bouton',v);await w();
 const t=ip+'/esp/pompe/cmd',id=pid++;step('c2');log('c','DASH','Construction PUBLISH',`QoS 1, topic=${t}, payload=${v}, packetId=${id}`);await w();
 lit(2,1);const p=send(0x32,[...str(t),...u16(id),...te.encode(v)]);step('c3');log('c','DASH','→ PUBLISH',hex(p))}
// ---------- simulateur (ESP32 + broker) ----------
let simT;
function makeSim(){const s={readyState:1,pump:false,t0:Date.now(),
 ms:()=>Date.now()-s.t0,
 emit(b,d=40){setTimeout(()=>s.onmessage&&s.onmessage({data:new Uint8Array(b).buffer}),d)},
 trace(st,d,delay){setTimeout(()=>s.onmessage&&s.onmessage({data:pubPkt(ip+'/esp/trace',JSON.stringify({step:st,ms:s.ms(),d})).buffer}),delay)},
 close(){clearInterval(simT)},
 send(p){const t=p[0]>>4;
  if(t==1)s.emit([0x20,2,0,0]);
  else if(t==8){s.emit([0x90,3,p[2],p[3],0]);boot()}
  else if(t==3){let j=1;while(p[j++]&128);const tl=p[j]<<8|p[j+1],v=td.decode(p.slice(j+2+tl+2)),id=[p[j+2+tl],p[j+3+tl]];
   s.emit([0x40,2,...id],60);s.trace('RX_CMD','payload recu = '+v,400);
   s.trace('GPIO','digitalWrite(RELAIS, '+(v=='ON'?'HIGH':'LOW')+')',700);
   s.trace('PUB_ETAT','publish '+ip+'/esp/pompe/etat = '+v,1000);setTimeout(()=>s.onmessage({data:pubPkt(ip+'/esp/pompe/etat',v).buffer}),1100)}
  return p}};
 function boot(){const a=[['WIFI','connecte au hotspot (simule)'],['IP','WiFi.localIP() = '+ip],['TCP','SYN → SYN-ACK → ACK vers broker:1883'],['MQTT_CONNECT','client.connect() envoie CONNECT'],['MQTT_CONNACK','CONNACK code 0'],['SUBSCRIBE','subscribe '+ip+'/esp/pompe/cmd']];
  a.forEach((x,i)=>s.trace(x[0],x[1],150+i*350));
  let k=0;setTimeout(()=>{simT=setInterval(()=>{k++;const T=(24+3*Math.sin(k/5)+Math.random()).toFixed(1),Hh=(55+8*Math.cos(k/7)+Math.random()*2).toFixed(1),G=Math.round(700+300*Math.sin(k/9)+(k%25>20?1500:0)+Math.random()*80);
   s.trace('READ','dht.readTemperature() / analogRead(34)',0);s.trace('JSON',`{"t":${T},"h":${Hh}}`,120);
   s.trace('PUB_DHT','publish dht22',240);setTimeout(()=>s.onmessage({data:pubPkt(ip+'/esp/dht22',`{"t":${T},"h":${Hh}}`).buffer}),260);
   s.trace('PUB_GAS','publish gas',360);setTimeout(()=>s.onmessage({data:pubPkt(ip+'/esp/gas',''+G).buffer}),380)},2000)},2400)}
 return s}
// ---------- graphiques ----------
function line(id,ser,min,max){const c=$('#'+id),x=c.getContext('2d'),W=c.width,V=c.height;x.clearRect(0,0,W,V);x.fillStyle='#6b7794';x.font='11px sans-serif';x.textAlign='left';
 for(let i=0;i<=4;i++){const y=V-20-(V-30)*i/4;x.strokeStyle='#e3e8f2';x.beginPath();x.moveTo(35,y);x.lineTo(W,y);x.stroke();x.fillText(Math.round(min+(max-min)*i/4),2,y+4)}
 ser.forEach(([d,col])=>{x.strokeStyle=col;x.lineWidth=2;x.beginPath();d.forEach((v,i)=>{const px=35+(W-40)*i/59,py=V-20-(V-30)*(v-min)/(max-min);i?x.lineTo(px,py):x.moveTo(px,py)});x.stroke()})}
function gauge(v){const x=$('#gg').getContext('2d');x.clearRect(0,0,240,140);x.lineWidth=16;x.lineCap='round';x.strokeStyle='#e3e8f2';x.beginPath();x.arc(120,120,90,Math.PI,2*Math.PI);x.stroke();
 x.strokeStyle=v>2000?'#f03e3e':'#12b886';x.beginPath();x.arc(120,120,90,Math.PI,Math.PI*(1+Math.min(v/4095,1)));x.stroke();x.fillStyle='#1f2a44';x.font='bold 26px sans-serif';x.textAlign='center';x.fillText(v,120,112);$('#al').textContent=v>2000?'⚠ GAZ ÉLEVÉ':''}
function draw(){line('c1',[[H.t,'#e8590c'],[H.h,'#1c7ed6']],0,100);line('c2',[[H.g,'#f59f00']],0,4095);gauge(H.g.at(-1)||0)}
draw();
