/*! MIT License · Copyright (c) 2026 Helmi Soudana, IoT Trainer · https://github.com/Helmisoudana · voir LICENSE.txt */
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// type de paquet : [numéro MQTT, couleur]
const TY={SYN:[0,'tcp'],'SYN-ACK':[0,'tcp'],ACK:[0,'tcp'],CONNECT:[1,'conn'],CONNACK:[2,'ack'],PUBLISH:[3,'pub'],PUBACK:[4,'ack'],PUBREC:[5,'ack'],PUBREL:[6,'pub'],PUBCOMP:[7,'ack'],SUBSCRIBE:[8,'sub'],SUBACK:[9,'ack'],UNSUBSCRIBE:[10,'sub'],UNSUBACK:[11,'ack'],PINGREQ:[12,'conn'],PINGRESP:[13,'ack'],DISCONNECT:[14,'conn']};
const WHY={
SYN:'TCP : le client frappe à la porte du broker (poignée de main en 3 temps).',
'SYN-ACK':'TCP : le broker répond qu’il est prêt.',
ACK:'TCP : tuyau ouvert, MQTT peut parler.',
CONNECT:'Premier paquet MQTT : identité du client, type de session, keep-alive, LWT éventuel.',
CONNACK:'Le broker accepte la session (sessionPresent indique si une ancienne session est reprise).',
SUBSCRIBE:'Le client demande à recevoir les topics qui correspondent à un filtre.',
SUBACK:'Abonnement enregistré, avec le QoS accordé.',
UNSUBSCRIBE:'Le client demande à retirer un filtre.',
UNSUBACK:'Désabonnement confirmé.',
PUBLISH:'Un message : topic + valeur + QoS (+ retain).',
PUBACK:'QoS 1 : accusé de réception.',
PUBREC:'QoS 2, étape 1 : message reçu et mémorisé.',
PUBREL:'QoS 2, étape 2 : l’émetteur autorise la livraison.',
PUBCOMP:'QoS 2, étape 3 : terminé, aucun doublon.',
PINGREQ:'Keep-alive : « je suis toujours là ».',
PINGRESP:'Le broker répond.',
DISCONNECT:'Fermeture propre de la session.'};

let clients=[],cnt={},br,gen=0,waiters=[],chain=Promise.resolve(),pidN=0;
const hot=new Set();
const pid=()=>pidN=pidN%65535+1;
const cl=id=>clients.find(c=>c.id===id);
const nm=id=>id==='B'?'Broker':id;
const sp=()=>+$('#speed').value;
// Après un reset, les anciens traitements ne reprennent jamais (gen a changé)
const delay=ms=>{const g=gen;return new Promise(r=>setTimeout(()=>g===gen&&r(),ms/sp()))};
const gate=()=>$('#step').checked?new Promise(r=>{waiters.push(r);$('#next').disabled=false}):0;
$('#next').onclick=()=>{$('#next').disabled=true;waiters.splice(0).forEach(r=>r())};
$('#step').onchange=()=>{if(!$('#step').checked)$('#next').click()};
const run=fn=>{chain=chain.then(fn).catch(e=>console.error(e))};

// Filtres MQTT : + = un niveau, # = tous les niveaux suivants
function match(f,t){const a=f.split('/'),b=t.split('/');for(let i=0;i<a.length;i++){if(a[i]==='#')return true;if(i>=b.length)return false;if(a[i]!=='+'&&a[i]!==b[i])return false}return a.length===b.length}

/* ---------- Animation et journal ---------- */
// Les paquets volent entre les nœuds du schéma
const elOf=id=>document.getElementById(id==='B'?'bnode':'n-'+id);
function fly(a,b,type,cls,drop){const g=gen;return new Promise(res=>{
  if(rq)flushSchema();
  const A=elOf(a).getBoundingClientRect(),B=elOf(b).getBoundingClientRect();
  const p=document.createElement('div');p.className='pk '+cls;p.textContent=type;$('#fx').append(p);
  const x0=A.left+A.width/2,y0=A.top+A.height/2,x1=B.left+B.width/2,y1=B.top+B.height/2,k=drop?.55:1;
  const xy=t=>`translate(${x0+(x1-x0)*t}px,${y0+(y1-y0)*t}px) translate(-50%,-50%)`;
  p.animate([{transform:xy(0)},{transform:xy(k)}],{duration:1100/sp(),easing:'ease-in-out',fill:'forwards'}).onfinish=()=>{
    if(g!==gen){p.remove();return}
    if(drop){p.classList.add('lost');p.textContent='✕ perdu';setTimeout(()=>{p.remove();res()},700/sp())}
    else{p.remove();res()}
  };
});}
const add=li=>{const L=$('#log');L.append(li);if(L.childElementCount>400)L.firstElementChild.remove();L.scrollTop=1e9};
async function send(a,b,type,info='',drop=false){
  await gate();
  const [n,c]=TY[type],li=document.createElement('li');li.className=c;
  li.innerHTML=`<div class="h"><b>${type}</b><span>${nm(a)} → ${nm(b)}</span><i>${n?'type '+n:'TCP'}</i></div><p>${WHY[type]}</p>${info?`<code>${esc(info)}</code>`:''}`;
  add(li);await fly(a,b,type,c,drop);
}
async function note(cls,t){
  await gate();
  const li=document.createElement('li');li.className='note '+cls;
  li.innerHTML=`<p>${cls==='bk'?'<b>Broker</b> ':''}${esc(t).replace(/\n/g,'<br>')}</p>`;
  add(li);await delay(250);
}
const bn=t=>note('bk',t);
const flash=id=>{const e=$('#'+id);e.classList.remove('fl');void e.offsetWidth;e.classList.add('fl')};
// Fait briller une flèche du schéma pendant un envoi
function pulse(k){hot.add(k);renderSchema();setTimeout(()=>{hot.delete(k);renderSchema()},1600/sp())}

/* ---------- QoS ---------- */
// Envoi d'un PUBLISH, avec perte simulée : QoS 0 = perdu, QoS 1/2 = renvoi avec DUP
async function sendPub(a,b,info,q){
  const drop=$('#lose').checked;$('#lose').checked=false;
  await send(a,b,'PUBLISH',info,drop);
  if(!drop)return true;
  if(!q){await note('warn','Paquet perdu. En QoS 0 il n’y a aucun accusé : l’émetteur ne le saura jamais.');return false}
  await note('warn','Aucun accusé reçu avant le délai : l’émetteur renvoie le paquet avec DUP=1.');
  await delay(700);await send(a,b,'PUBLISH',info+' · DUP=1');return true;
}
// rx = celui qui a reçu le PUBLISH, tx = celui qui l'a envoyé
async function qosFlow(rx,tx,q,id){
  if(q===1)await send(rx,tx,'PUBACK','id='+id);
  if(q===2){await send(rx,tx,'PUBREC','id='+id);await send(tx,rx,'PUBREL','id='+id);await send(rx,tx,'PUBCOMP','id='+id)}
}

/* ---------- Scénarios MQTT ---------- */
async function connect(c){
  if($('#tcp').checked){await send(c.id,'B','SYN');await send('B',c.id,'SYN-ACK');await send(c.id,'B','ACK')}
  const will=c.wt.trim()?{t:c.wt.trim(),p:c.wp}:null;
  await send(c.id,'B','CONNECT',`clientId=${c.id} · cleanSession=${c.clean} · keepAlive=60 s`+(will?` · will=${will.t}`:''));
  const old=br.sess[c.id],keep=!c.clean&&old;
  await bn('Vérifie que le clientId est unique, puis cherche une session existante.');
  if(keep)await bn(`Session persistante retrouvée : ${br.subs.filter(s=>s.id===c.id).length} abonnement(s) et ${old.queue.length} message(s) en attente conservés.`);
  else{
    br.subs=br.subs.filter(s=>s.id!==c.id);c.subs.forEach(s=>s.on=false);
    await bn('Nouvelle session (clean) : aucun abonnement conservé, le client devra se réabonner.');
  }
  const s=br.sess[c.id]=keep?old:{queue:[]};
  Object.assign(s,{online:false,clean:c.clean,will});
  renderBroker();flash('pSess');
  await send('B',c.id,'CONNACK',`sessionPresent=${!!keep} · returnCode=0`);
  s.online=true;c.on=true;renderBroker();renderClients();
  if(s.queue.length){
    await bn(`Vide la file d’attente de ${c.id} (${s.queue.length} message(s)).`);
    await Promise.all(s.queue.splice(0).map(m=>toClient(c,m,2)));renderBroker();
  }
}
async function subscribe(c,s){
  if(!s.f.trim())return note('warn','Le filtre ne peut pas être vide.');
  await send(c.id,'B','SUBSCRIBE',`filtre=${s.f} · QoS demandé=${s.q} · id=${pid()}`);
  await bn(`Ajoute la ligne (${s.f}, ${c.id}, QoS ${s.q}) dans la table des abonnements.`);
  br.subs=br.subs.filter(x=>!(x.id===c.id&&x.f===s.f));br.subs.push({f:s.f,id:c.id,q:s.q});s.on=true;
  renderBroker();flash('pSubs');renderClients();
  await send('B',c.id,'SUBACK',`QoS accordé=${s.q}`);
  const ret=Object.entries(br.topics).filter(([t,i])=>i.r&&match(s.f,t));
  await bn(ret.length?`Parcourt les messages retenus : ${ret.length} correspond(ent) au filtre, envoyés tout de suite.`:'Aucun message retenu ne correspond au filtre.');
  await Promise.all(ret.map(([t,i])=>toClient(c,{t,v:i.v,q:i.q,r:1},s.q)));
}
async function unsubscribe(c,s){
  await send(c.id,'B','UNSUBSCRIBE','filtre='+s.f);
  br.subs=br.subs.filter(x=>!(x.id===c.id&&x.f===s.f));s.on=false;
  await bn(`Retire la ligne (${s.f}, ${c.id}) de la table des abonnements.`);
  renderBroker();flash('pSubs');renderClients();
  await send('B',c.id,'UNSUBACK');
}
async function publish(c,p){
  const t=p.t.trim();
  if(!t||/[+#]/.test(t))return note('warn','Topic invalide : un topic de publication ne contient ni + ni #.');
  const q=p.q,id=q?pid():'';
  pulse(`p-${c.id}-${c.pubs.indexOf(p)}`);
  if(!await sendPub(c.id,'B',`topic=${t} · payload=${p.v} · QoS=${q}${p.r?' · retain=1':''}${q?' · id='+id:''}`,q))return;
  await qosFlow('B',c.id,q,id);
  await route(t,p.v,q,p.r);
}
// Le cœur du broker : arbre des topics, retain, recherche des abonnés, fan-out
async function route(t,v,q,r){
  const i=br.topics[t]??={v,n:0,r:false,q};i.v=v;i.n++;
  if(r){i.r=v!=='';i.q=q}
  await bn(`Met à jour l’arbre des topics : « ${t} » = ${v}.`+(r?(v===''?' Retain avec valeur vide : le message retenu est effacé.':' Retain=1 : le broker garde ce message pour les futurs abonnés.'):''));
  renderBroker();flash('pTree');
  await bn('Cherche les abonnés : il teste chaque filtre de la table contre le topic.');
  const tests=br.subs.map(s=>({s,ok:match(s.f,t)}));
  await note('bk',tests.length?tests.map(x=>`${x.ok?'✔':'✘'} ${x.s.f}  (${x.s.id}, QoS ${x.s.q})`).join('\n'):'La table des abonnements est vide.');
  const by={};tests.filter(x=>x.ok).forEach(x=>by[x.s.id]=Math.max(by[x.s.id]??0,x.s.q));
  const ids=Object.keys(by);
  if(!ids.length)return note('warn','Aucun abonné : le message n’est livré à personne.');
  await bn(`${ids.length} client(s) à servir`+(ids.length>1?' : le broker envoie une copie à chacun (fan-out), en parallèle.':'.'));
  await Promise.all(ids.map(id=>{
    const c=cl(id),m={t,v,q,r:0},s=br.sess[id];
    if(s.online)return toClient(c,m,by[id]);
    const qq=Math.min(q,by[id]);
    if(qq){s.queue.push({t,v,q:qq});renderBroker();return bn(`${id} est hors ligne (session persistante) : message mis en file d’attente (QoS ${qq}).`)}
    return bn(`${id} est hors ligne et le QoS vaut 0 : message abandonné.`);
  }));
}
// Livraison broker → client : QoS = min(QoS du message, QoS de l'abonnement)
async function toClient(c,m,sq){
  const q=Math.min(m.q,sq),id=q?pid():'';
  c.subs.forEach((s,i)=>{if(s.on&&match(s.f,m.t))pulse(`s-${c.id}-${i}`)});
  if(q<m.q)await bn(`QoS livré à ${c.id} = min(message ${m.q}, abonnement ${sq}) = ${q}.`);
  if(!await sendPub('B',c.id,`topic=${m.t} · payload=${m.v} · QoS=${q}${m.r?' · retain=1':''}${q?' · id='+id:''}`,q))return;
  await qosFlow(c.id,'B',q,id);
  c.inbox.unshift(`${m.t} = ${m.v}  (QoS ${q})`);c.inbox.length=Math.min(c.inbox.length,4);showInbox(c);renderSchema();
}
async function ping(c){
  await send(c.id,'B','PINGREQ');await bn(`Remet à zéro le compteur keep-alive de ${c.id}.`);await send('B',c.id,'PINGRESP');
}
async function bye(c,clean){
  const s=br.sess[c.id];
  if(clean){await send(c.id,'B','DISCONNECT');await bn(`Déconnexion propre : le broker oublie le LWT de ${c.id}.`)}
  else{
    await note('warn','Connexion coupée sans DISCONNECT (Wi-Fi, batterie…).');
    await bn(`Silence de ${c.id} : il attend 1,5 × keep-alive (accéléré ici), puis déclare le client mort.`);await delay(1200);
  }
  c.on=false;s.online=false;
  if(s.clean){
    delete br.sess[c.id];br.subs=br.subs.filter(x=>x.id!==c.id);c.subs.forEach(x=>x.on=false);
    await bn('Session clean : session et abonnements supprimés.');
  }else await bn('Session persistante conservée : abonnements gardés, messages QoS ≥ 1 mis en file.');
  renderBroker();renderClients();flash('pSess');
  if(!clean&&s.will){await bn(`Publie le LWT de ${c.id} sur « ${s.will.t} ».`);await route(s.will.t,s.will.p,1,0)}
}

/* ---------- Affichage ---------- */
const tbl=(h,r)=>r.length?`<table><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr>${r.map(x=>`<tr>${x.map(y=>`<td>${y}</td>`).join('')}</tr>`).join('')}</table>`:'<p class="e">vide</p>';
function renderBroker(){
  $('#tSess').innerHTML=tbl(['client','état','session','LWT','file'],Object.entries(br.sess).map(([id,s])=>[id,s.online?'<b class="on">en ligne</b>':'hors ligne',s.clean?'clean':'persistante',s.will?esc(s.will.t):'—',s.queue.length]));
  $('#tSubs').innerHTML=tbl(['filtre','client','QoS'],br.subs.map(s=>[esc(s.f),s.id,s.q]));
  const root={k:{}};
  for(const t in br.topics){let n=root;t.split('/').forEach(p=>n=(n.k[p]??={k:{}}));n.t=t}
  const draw=n=>Object.entries(n.k).map(([p,c])=>{
    const i=c.t&&br.topics[c.t];
    return `<li>${esc(p)}${i?` <code>${esc(i.v)}</code>${i.r?' <em>retain</em>':''} <small>${br.subs.filter(s=>match(s.f,c.t)).length} abonné(s) · ${i.n} msg</small>`:''}${Object.keys(c.k).length?`<ul>${draw(c)}</ul>`:''}</li>`}).join('');
  $('#tTree').innerHTML=Object.keys(br.topics).length?`<ul class="tree">${draw(root)}</ul>`:'<p class="e">aucun topic vu</p>';
  renderSchema();
}
const qs=(v,d)=>`<select data-k="q" ${d?'disabled':''}>${[0,1,2].map(n=>`<option ${n==v?'selected':''}>${n}</option>`).join('')}</select>`;
function card(c){
  const on=c.on;
  return `<article class="card cl ${on?'on':''}" id="c-${c.id}" data-c="${c.id}">
  <header><h3>${c.id}</h3><span class="bd">${on?'connecté':'hors ligne'}</span><button data-a="rm" title="Supprimer le client">✕</button></header>
  <div class="row"><label class="chk"><input type="checkbox" data-k="clean" ${c.clean?'checked':''} ${on?'disabled':''}> clean session</label>
    <input data-k="wt" value="${esc(c.wt)}" placeholder="LWT topic" size="16" ${on?'disabled':''}><input data-k="wp" value="${esc(c.wp)}" size="7" ${on?'disabled':''}></div>
  <div class="row">${on?'<button data-a="dis">Déconnecter</button><button data-a="cut">Couper</button><button data-a="ping">Ping</button>':'<button data-a="con" class="go">Connecter</button>'}</div>
  <h4>Publishers <button data-a="addp">+</button></h4>
  ${c.pubs.map((p,i)=>`<div class="row" data-t="p" data-i="${i}"><input data-k="t" value="${esc(p.t)}" aria-label="topic"><input data-k="v" value="${esc(p.v)}" size="5" aria-label="valeur">${qs(p.q)}<label class="chk"><input type="checkbox" data-k="r" ${p.r?'checked':''}>retain</label><button data-a="pub" ${on?'':'disabled'}>Publier</button><button data-a="rmp" title="Supprimer">✕</button></div>`).join('')}
  <h4>Subscribers <button data-a="adds">+</button></h4>
  ${c.subs.map((s,i)=>`<div class="row" data-t="s" data-i="${i}"><input data-k="f" value="${esc(s.f)}" aria-label="filtre" ${s.on?'disabled':''}>${qs(s.q,s.on)}${s.on?'<button data-a="unsub">Se désabonner</button>':`<button data-a="sub" ${on?'':'disabled'}>S’abonner</button>`}<button data-a="rms" ${s.on?'disabled':''} title="Supprimer">✕</button></div>`).join('')}
  <ul class="in" id="in-${c.id}"></ul></article>`;
}
function showInbox(c){const e=document.getElementById('in-'+c.id);if(e)e.innerHTML=c.inbox.map(x=>`<li>${esc(x)}</li>`).join('')||'<li class="e">aucun message reçu</li>'}
function renderClients(){
  $('#clients').innerHTML=clients.map(card).join('')||'<p class="e">Ajoutez un ESP32 ou une application.</p>';
  clients.forEach(showInbox);renderSchema();
}

/* ---------- Schéma avec flèches ---------- */
function schema(){
  // un client avec au moins un publisher (ou sans rien) va à gauche ; abonné seulement = à droite
  const L=clients.filter(c=>c.pubs.length||!c.subs.length),R=clients.filter(c=>!L.includes(c));
  const node=c=>`<div class="nd ${c.on?'on':''}" id="n-${c.id}">
    <div class="nh"><b>${c.id}</b><small>${c.on?'connecté':'hors ligne'}</small></div>
    ${c.pubs.map((p,i)=>`<div class="ln" id="r-p-${c.id}-${i}"><i class="tag p">PUB</i> ${esc(p.t)} <code>${esc(p.v)}</code></div>`).join('')}
    ${c.subs.map((s,i)=>`<div class="ln" id="r-s-${c.id}-${i}"><i class="tag s">SUB</i> ${esc(s.f)}</div>`).join('')}
    ${c.inbox[0]?`<div class="rx">reçu : ${esc(c.inbox[0])}</div>`:''}</div>`;
  $('#colP').innerHTML=L.map(node).join('')||'<p class="e">Publishers</p>';
  $('#colS').innerHTML=R.map(node).join('')||'<p class="e">Subscribers</p>';
  const T=Object.entries(br.topics).slice(-6);
  $('#bnode').innerHTML=`<div class="nh"><b>Broker</b><small>${br.subs.length} abonnement(s)</small></div>
    <ul>${T.map(([t,i])=>`<li>${esc(t)} <code>${esc(i.v)}</code>${i.r?' <em>retain</em>':''}</li>`).join('')||'<li class="e">aucun topic</li>'}</ul>`;
  drawArrows(L);
}
function drawArrows(L){
  const o=$('#sch').getBoundingClientRect(),B=$('#bnode').getBoundingClientRect(),A=[];
  clients.forEach(c=>{
    const left=L.includes(c);
    c.pubs.forEach((p,i)=>A.push({k:`p-${c.id}-${i}`,side:'L',cls:'p',on:c.on,out:false,lb:`QoS ${p.q}${p.r?' · retain':''}`}));
    c.subs.forEach((s,i)=>A.push({k:`s-${c.id}-${i}`,side:left?'L':'R',cls:'s',on:s.on,out:true,lb:`QoS ${s.q}`}));
  });
  A.forEach(a=>{
    const el=document.getElementById('r-'+a.k);if(!el)return;
    const r=el.getBoundingClientRect();
    a.ok=true;a.y=r.top+r.height/2-o.top;a.x=(a.side==='L'?r.right:r.left)-o.left;
  });
  let svg='<defs>'+[['p','pub'],['s','sub'],['off','tcp']].map(([m,v])=>
    `<marker id="m-${m}" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9z" style="fill:var(--${v})"/></marker>`).join('')+'</defs>';
  for(const side of['L','R']){
    const S=A.filter(a=>a.ok&&a.side===side).sort((a,b)=>a.y-b.y);
    const bx=(side==='L'?B.left:B.right)-o.left;
    S.forEach((a,j)=>{
      const by=B.top-o.top+B.height*(j+1)/(S.length+1);               // points d'attache répartis sur le broker
      const [x0,y0,x1,y1]=a.out?[bx,by,a.x,a.y]:[a.x,a.y,bx,by],dx=(x1-x0)/2,m=a.on?a.cls:'off';
      svg+=`<path class="ar ${m}${hot.has(a.k)?' hot':''}" d="M${x0} ${y0}C${x0+dx} ${y0} ${x1-dx} ${y1} ${x1} ${y1}" marker-end="url(#m-${m})"/>`+
           `<text class="al" x="${(x0+x1)/2}" y="${(y0+y1)/2-5}">${a.lb}</text>`;
    });
  }
  $('#arrows').innerHTML=svg;
}
// rendu groupé : au plus un redessin par image (performance)
let rq=0;
function renderSchema(){rq||(rq=requestAnimationFrame(flushSchema))}
function flushSchema(){if(rq){cancelAnimationFrame(rq);rq=0}schema()}
window.addEventListener('resize',renderSchema);

/* ---------- Gestion des clients ---------- */
function addClient(k){
  const id=`${k}-${cnt[k]=(cnt[k]||0)+1}`;
  clients.push({id,k,on:false,clean:true,wt:k==='esp32'?`lab/${id}/status`:'',wp:'offline',inbox:[],
    pubs:k==='esp32'?[{t:`lab/${id}/temp`,v:'27.5',q:1,r:false}]:[],
    subs:k==='app'?[{f:'lab/#',q:1,on:false}]:[]});
  renderClients();
}
function removeClient(c){
  delete br.sess[c.id];br.subs=br.subs.filter(s=>s.id!==c.id);
  clients=clients.filter(x=>x!==c);renderClients();renderBroker();
}
function reset(){
  gen++;waiters=[];chain=Promise.resolve();hot.clear();
  br={sess:{},subs:[],topics:{}};
  clients.forEach(c=>{c.on=false;c.inbox=[];c.subs.forEach(s=>s.on=false)});
  $('#log').innerHTML='';$('#fx').innerHTML='';$('#next').disabled=true;
  renderClients();renderBroker();
}
function demo(){
  clients=[];cnt={};addClient('esp32');addClient('app');addClient('app');
  Object.assign(clients[1].subs[0],{f:'lab/#',q:2});Object.assign(clients[2].subs[0],{f:'lab/+/temp',q:0});
  reset();
  const [e,a,b]=clients;
  run(()=>connect(a));run(()=>subscribe(a,a.subs[0]));
  run(()=>connect(b));run(()=>subscribe(b,b.subs[0]));
  run(()=>connect(e));run(()=>publish(e,e.pubs[0]));
}

$('#clients').addEventListener('input',e=>{
  const el=e.target,k=el.dataset.k;if(!k)return;
  const c=cl(el.closest('.cl').dataset.c),r=el.closest('[data-i]'),v=el.type==='checkbox'?el.checked:el.value;
  if(r)(r.dataset.t==='p'?c.pubs:c.subs)[+r.dataset.i][k]=k==='q'?+v:v;else c[k]=v;
  renderSchema();
});
$('#clients').addEventListener('click',e=>{
  const b=e.target.closest('button[data-a]');if(!b)return;
  const c=cl(b.closest('.cl').dataset.c),r=b.closest('[data-i]'),i=r?+r.dataset.i:-1;
  const A={
    con:()=>run(()=>connect(c)),dis:()=>run(()=>bye(c,true)),cut:()=>run(()=>bye(c,false)),ping:()=>run(()=>ping(c)),
    addp:()=>{c.pubs.push({t:`lab/${c.id}/temp`,v:'27.5',q:1,r:false});renderClients()},
    rmp:()=>{c.pubs.splice(i,1);renderClients()},
    pub:()=>run(()=>publish(c,c.pubs[i])),
    adds:()=>{c.subs.push({f:'lab/#',q:1,on:false});renderClients()},
    rms:()=>{c.subs.splice(i,1);renderClients()},
    sub:()=>run(()=>subscribe(c,c.subs[i])),unsub:()=>run(()=>unsubscribe(c,c.subs[i])),
    rm:()=>removeClient(c)};
  A[b.dataset.a]();
});
$('#addE').onclick=()=>addClient('esp32');
$('#addA').onclick=()=>addClient('app');
$('#demo').onclick=demo;
$('#rst').onclick=reset;
reset();