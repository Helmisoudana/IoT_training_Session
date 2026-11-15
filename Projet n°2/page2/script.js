/*! MIT License · Copyright (c) 2026 Helmi Soudana, IoT Trainer · https://github.com/Helmisoudana · voir LICENSE.txt */
const $=id=>document.getElementById(id);
const X={S:110,B:400,D:690},N={S:'Capteur',B:'Broker',D:'Dashboard'},NS='http://www.w3.org/2000/svg';
const T={SYN:[0,'tcp'],'SYN-ACK':[0,'tcp'],ACK:[0,'tcp'],CONNECT:[1,'conn'],CONNACK:[2,'ack'],PUBLISH:[3,'pub'],PUBACK:[4,'ack'],PUBREC:[5,'ack'],PUBREL:[6,'pub'],PUBCOMP:[7,'ack'],SUBSCRIBE:[8,'sub'],SUBACK:[9,'ack'],PINGREQ:[12,'conn'],PINGRESP:[13,'ack'],DISCONNECT:[14,'conn']};
const WHY={
SYN:'TCP : le client frappe à la porte du broker (poignée de main en 3 temps). MQTT n’a pas encore commencé.',
'SYN-ACK':'TCP : le broker répond qu’il est prêt.',
ACK:'TCP : le client confirme. Le tuyau est ouvert, MQTT peut parler.',
CONNECT:'Premier paquet MQTT : « je suis ce client, j’ouvre une session ».',
CONNACK:'Le broker accepte (code 0). La session MQTT est ouverte.',
SUBSCRIBE:'Le client indique au broker quels topics l’intéressent (filtre + QoS demandé).',
SUBACK:'Abonnement accepté. Le broker retient ce filtre pour ce client.',
PUBLISH:'Un message avec un topic et une valeur. L’émetteur ignore qui le recevra : c’est le broker qui trie.',
PUBACK:'QoS 1 : accusé de réception, le message est bien arrivé.',
PUBREC:'QoS 2, étape 1 : message reçu et mémorisé.',
PUBREL:'QoS 2, étape 2 : l’émetteur autorise la livraison, une seule fois.',
PUBCOMP:'QoS 2, étape 3 : terminé, aucun doublon possible.',
PINGREQ:'Keep-alive : « je suis toujours là ».',
PINGRESP:'Le broker répond. Sans ping régulier, il fermerait la session.',
DISCONNECT:'Fermeture propre de la session MQTT.'};
let st,gen=0,busy=false,stepRes=null;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const speed=()=>+$('speed').value, dur=()=>1100/speed();
const chk=g=>{if(g!==gen)throw'abort'};
const delay=ms=>new Promise(r=>setTimeout(r,ms/speed()));
const pid=()=>(st.pid=st.pid%65535+1);
function match(f,t){const a=f.split('/'),b=t.split('/');for(let i=0;i<a.length;i++){if(a[i]==='#')return true;if(i>=b.length)return false;if(a[i]!=='+'&&a[i]!==b[i])return false}return a.length===b.length}
function gate(){if(!$('step').checked)return Promise.resolve();$('next').disabled=false;return new Promise(r=>{stepRes=r})}
$('next').onclick=()=>{$('next').disabled=true;if(stepRes){const r=stepRes;stepRes=null;r()}};
function log(a,b,type,info){
 const [n,c]=T[type],li=document.createElement('li');li.className=c;
 li.innerHTML=`<div class="h"><b>${type}</b><span>${N[a]} → ${N[b]}</span><i>${n?'type '+n:'TCP'}</i></div><p>${WHY[type]}</p>${info?`<code>${esc(info)}</code>`:''}`;
 $('log').appendChild(li);$('log').scrollTop=$('log').scrollHeight;
}
function note(txt,cls=''){const li=document.createElement('li');li.className='note '+cls;li.innerHTML=`<p>${esc(txt)}</p>`;$('log').appendChild(li);$('log').scrollTop=$('log').scrollHeight}
function fly(a,b,type,c,drop,g){return new Promise(res=>{
 const dir=X[b]>X[a]?1:-1,y=dir>0?112:150,w=type.length*8+22,grp=document.createElementNS(NS,'g');
 grp.setAttribute('class','pk '+c);
 grp.innerHTML=`<rect x="${-w/2}" y="-12" width="${w}" height="24" rx="12"/><text y="4">${type}</text>`;
 $('pk').appendChild(grp);
 const x0=X[a]+dir*65,x1=X[b]-dir*65,D=dur(),t0=performance.now(),end=drop?.55:1;
 (function f(t){
  if(g!==gen){grp.remove();return res()}
  const k=Math.min((t-t0)/D,1);
  grp.setAttribute('transform',`translate(${x0+(x1-x0)*k*end},${y})`);
  if(k<1)return requestAnimationFrame(f);
  if(drop){grp.classList.add('lost');grp.querySelector('text').textContent='✕ perdu';setTimeout(()=>{grp.remove();res()},800/speed())}
  else{grp.remove();res()}
 })(t0);
});}
async function send(a,b,type,info='',drop=false){
 const g=gen;await gate();chk(g);
 log(a,b,type,info);
 await fly(a,b,type,T[type][1],drop,g);chk(g);
}
function render(){
 for(const w of['S','D']){const e=$('t'+w);e.textContent=st[w]?'● connecté':'● déconnecté';e.classList.toggle('ok',st[w])}
 $('l1').classList.toggle('on',st.S);$('l2').classList.toggle('on',st.D);
 const li=(a,e)=>a.length?a.map(x=>`<li>${esc(x)}</li>`).join(''):`<li class="e">${e}</li>`;
 $('uC').innerHTML=li([st.S&&'esp32-capteur',st.D&&'dashboard-web'].filter(Boolean),'Aucun client');
 $('uS').innerHTML=li(st.subs.map(s=>`${s.f} (QoS ${s.q})`),'Aucun abonnement');
 $('uR').innerHTML=li(Object.entries(st.ret).map(([t,m])=>`${t} = ${m.v}`),'Aucun message retenu');
 $('uL').innerHTML=li(st.last?[`${st.last.t} = ${st.last.v}`]:[],'Rien reçu pour l’instant');
 const d={bS:busy||st.S,bD:busy||st.D,bSub:busy||!st.D,bPub:busy||!st.S,bPing:busy||!st.S,bXS:busy||!st.S,bXD:busy||!st.D,bAll:busy};
 for(const k in d)$(k).disabled=d[k];
}
async function connect(w){
 const id=w==='S'?'esp32-capteur':'dashboard-web';
 await send(w,'B','SYN');await send('B',w,'SYN-ACK');await send(w,'B','ACK');
 await send(w,'B','CONNECT',`clientId=${id} · keepAlive=60 s · cleanSession=true`);
 await send('B',w,'CONNACK','returnCode=0 (accepté)');
 st[w]=true;render();
}
async function subscribe(){
 const f=$('filter').value.trim()||'#',q=+$('subq').value;
 await send('D','B','SUBSCRIBE',`filtre=${f} · QoS demandé=${q} · id=${pid()}`);
 st.subs=st.subs.filter(s=>s.f!==f);st.subs.push({f,q});render();
 await send('B','D','SUBACK',`QoS accordé=${q}`);
 for(const[t,m]of Object.entries(st.ret))if(match(f,t)){note(`Le broker envoie aussitôt le message retenu de « ${t} » au nouvel abonné.`);await deliver(t,m.v,m.q,true,q)}
}
async function deliver(t,v,pq,rf,sq){
 const q=Math.min(pq,sq),id=q?pid():'';
 if(q<pq)note(`Le QoS livré est le minimum entre celui du message (${pq}) et celui de l’abonnement (${sq}) : ${q}.`);
 await send('B','D','PUBLISH',`topic=${t} · payload=${v} · QoS=${q}${rf?' · retain=1':''}${q?' · id='+id:''}`);
 if(q===1)await send('D','B','PUBACK','id='+id);
 if(q===2){await send('D','B','PUBREC','id='+id);await send('B','D','PUBREL','id='+id);await send('D','B','PUBCOMP','id='+id)}
 st.last={t,v};render();
}
async function publish(){
 const t=$('topic').value.trim(),v=$('payload').value,q=+$('qos').value,rt=$('retain').checked,loss=$('loss').checked;
 if(!t){note('Le topic ne peut pas être vide.','warn');return}
 const id=q?pid():'',info=dup=>`topic=${t} · payload=${v} · QoS=${q}${rt?' · retain=1':''}${q?' · id='+id:''}${dup?' · DUP=1':''}`;
 await send('S','B','PUBLISH',info(),loss);
 if(loss){
  if(!q){note('Message perdu. En QoS 0, personne ne le sait : aucun accusé, aucune retransmission.','warn');return}
  note('Aucun accusé reçu : le capteur attend, puis renvoie le même paquet (DUP=1).','warn');
  await delay(900);await send('S','B','PUBLISH',info(true));
 }
 if(q===1)await send('B','S','PUBACK','id='+id);
 if(q===2){await send('B','S','PUBREC','id='+id);await send('S','B','PUBREL','id='+id);await send('B','S','PUBCOMP','id='+id)}
 if(rt){st.ret[t]={v,q};note(`Retain : le broker garde « ${v} » pour le topic « ${t} » et le donnera aux futurs abonnés.`);render()}
 const subs=st.subs.filter(s=>match(s.f,t));
 if(st.D&&subs.length){
  note(`Le broker cherche les abonnés de « ${t} » : ${subs.length} filtre(s) correspond(ent).`);
  await deliver(t,v,q,false,Math.max(...subs.map(s=>s.q)));
 }else note('Aucun abonné connecté ne correspond à ce topic : le broker ne livre rien'+(rt?' (mais il garde le message retenu).':'.'),'warn');
}
async function ping(){await send('S','B','PINGREQ');await send('B','S','PINGRESP')}
async function bye(w){
 await send(w,'B','DISCONNECT');st[w]=false;if(w==='D')st.subs=[];
 note(w==='D'?'Le dashboard est parti : ses abonnements sont supprimés.':'Le capteur est parti : la connexion TCP est fermée.');render();
}
async function all(){reset();await connect('S');await connect('D');await subscribe();await publish()}
async function act(fn){
 if(busy)return;busy=true;render();
 try{await fn()}catch(e){if(e!=='abort')console.error(e)}
 finally{busy=false;$('next').disabled=true;render()}
}
function reset(){
 gen++;if(stepRes){const r=stepRes;stepRes=null;r()}
 st={S:false,D:false,subs:[],ret:{},pid:0,last:null};
 $('log').innerHTML='';$('pk').innerHTML='';$('next').disabled=true;render();
}
$('bS').onclick=()=>act(()=>connect('S'));
$('bD').onclick=()=>act(()=>connect('D'));
$('bSub').onclick=()=>act(subscribe);
$('bPub').onclick=()=>act(publish);
$('bPing').onclick=()=>act(ping);
$('bXS').onclick=()=>act(()=>bye('S'));
$('bXD').onclick=()=>act(()=>bye('D'));
$('bAll').onclick=()=>act(all);
$('bRst').onclick=()=>{reset();busy=false;render()};
reset();
