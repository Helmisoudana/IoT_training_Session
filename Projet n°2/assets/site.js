/*! MIT License · Copyright (c) 2026 Helmi Soudana, IoT Trainer · https://github.com/Helmisoudana · voir LICENSE.txt */
// Navbar, pied de page et thème partagés par toutes les pages (une seule source à modifier).
(()=>{
const A={name:'Helmi Soudana',role:'IoT Trainer',year:2026,
  gh:'https://github.com/Helmisoudana',li:'https://www.linkedin.com/in/helmi-soudana/'};
const root=document.body.dataset.root||'',page=document.body.dataset.page||'home';
const ico=id=>`<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#${id}"/></svg>`;
document.body.insertAdjacentHTML('afterbegin',`<svg width="0" height="0" style="position:absolute;width:0;height:0" aria-hidden="true">
<symbol id="i-gh" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></symbol>
<symbol id="i-li" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></symbol>
<symbol id="i-logo" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><circle cx="4" cy="6" r="1.6"/><circle cx="20" cy="6" r="1.6"/><circle cx="12" cy="21" r="1.6"/><path d="M5.3 7l4.6 3.6M18.7 7l-4.6 3.6M12 15v4.4"/></g></symbol>
<symbol id="i-sun" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></g></symbol>
<symbol id="i-moon" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></symbol></svg>`);

const L=[['home','Accueil','index.html'],['p1','Page 1 · Système','page1/index.html'],['p2','Page 2 · Connexion','page2/index.html']];
document.getElementById('site-nav').innerHTML=`<nav class="nav" aria-label="Navigation principale">
<a class="brand" href="${root}index.html" aria-label="Accueil MQTT Lab">${ico('i-logo')}<b>MQTT Lab</b></a>
<div class="links">${L.map(([k,t,h])=>`<a href="${root+h}"${k===page?' aria-current="page"':''}>${t}</a>`).join('')}</div>
<div class="nr"><a class="ib" href="${A.gh}" target="_blank" rel="noopener" aria-label="GitHub de ${A.name}" title="GitHub">${ico('i-gh')}</a>
<a class="ib" href="${A.li}" target="_blank" rel="noopener" aria-label="LinkedIn de ${A.name}" title="LinkedIn">${ico('i-li')}</a>
<button class="ib" id="theme" type="button"></button></div></nav>`;

document.getElementById('site-footer').innerHTML=`<div class="ft">
<span>© ${A.year} <b>${A.name}</b> · ${A.role} · <a href="${root}LICENSE.txt">Licence MIT</a></span>
<span class="soc"><a href="${A.gh}" target="_blank" rel="noopener">${ico('i-gh')}GitHub</a><a href="${A.li}" target="_blank" rel="noopener">${ico('i-li')}LinkedIn</a></span></div>`;

const R=document.documentElement,btn=document.getElementById('theme');
const paint=()=>{const d=R.dataset.theme!=='light';btn.innerHTML=ico(d?'i-sun':'i-moon');btn.title=btn.ariaLabel=d?'Passer au thème clair':'Passer au thème sombre'};
btn.onclick=()=>{R.dataset.theme=R.dataset.theme==='light'?'dark':'light';try{localStorage.setItem('mqtt-theme',R.dataset.theme)}catch(e){}paint()};
paint();
if(matchMedia('(prefers-reduced-motion:reduce)').matches)document.querySelectorAll('svg').forEach(s=>s.pauseAnimations&&s.pauseAnimations());
})();
