const SCHEDULE = {
  cajero:    { in:'08:00', out:'17:00' },
  asistente: { in:'08:30', out:'17:30' },
  gerente:   { in:'09:00', out:'18:00' }
};
const TOLERANCE = 10;
const ROLE_LABEL = { cajero:'Cajero', asistente:'Asistente', gerente:'Gerente' };

const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const store = {
  get:(k,d)=>{ try{ return JSON.parse(localStorage.getItem(k)) ?? d }catch{ return d } },
  set:(k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)) }catch{} }
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,10);
const pad = n => String(n).padStart(2,'0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const hm  = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toMin = t => { const [h,m]=t.split(':').map(Number); return h*60+m; };
const fmtDate = s => new Date(s+'T00:00:00').toLocaleDateString('es-PY',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

window.addEventListener('error', ev => {
  const b = $('#loginError');
  if (b) { b.textContent = 'Error: ' + ev.message; b.classList.remove('d-none'); }
});

function avatarFor(name){
  const ini = name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><rect width='120' height='120' fill='#9FE870'/><text x='50%' y='54%' text-anchor='middle' dominant-baseline='middle' font-family='Arial' font-size='46' font-weight='800' fill='#163300'>${ini}</text></svg>`;
  return 'data:image/svg+xml;utf8,'+encodeURIComponent(svg);
}
const photoOf = u => store.get('tc_photo_'+u.user,null) || avatarFor(u.name);

function toast(msg){
  $('#toastMsg').textContent=msg;
  try{ bootstrap.Toast.getOrCreateInstance($('#toast'),{delay:2800}).show(); }
  catch{ const t=$('#toast'); t.style.display='block'; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2800); }
}

let users   = store.get('tc_users', null);
let records = store.get('tc_records', null);

if(!users){
  users = [
    {user:'cajero1',    pass:'1234', name:'Carlos Benítez', role:'cajero'},
    {user:'asistente1', pass:'1234', name:'Ana Rolón',      role:'asistente'},
    {user:'gerente1',   pass:'1234', name:'Marta Giménez',  role:'gerente'},
  ];
  store.set('tc_users',users);
}

function calcLate(role, timeStr){
  const diff = toMin(timeStr) - toMin(SCHEDULE[role].in);
  return diff > TOLERANCE ? diff : 0;
}

if(!records){
  records=[]; let seed=7; const rnd=()=>{seed=(seed*9301+49297)%233280;return seed/233280;};
  const base=new Date();
  for(let i=1;i<=12;i++){
    const d=new Date(base); d.setDate(d.getDate()-i); if([0,6].includes(d.getDay())) continue;
    users.forEach(u=>{
      if(rnd()<.08) return;
      const off=Math.round((rnd()-.35)*34), inM=toMin(SCHEDULE[u.role].in)+off;
      const t=`${pad(Math.floor(inM/60))}:${pad(inM%60)}`;
      const outM=toMin(SCHEDULE[u.role].out)+Math.round(rnd()*30);
      records.push({id:uid(),user:u.user,date:ymd(d),in:t,out:`${pad(Math.floor(outM/60))}:${pad(outM%60)}`,late:calcLate(u.role,t),geo:null});
    });
  }
  store.set('tc_records',records);
}
const saveRecords = ()=>store.set('tc_records',records);

let simTime = store.get('tc_sim', null);
function now(){
  const d=new Date();
  if(simTime){ const [h,m]=simTime.split(':').map(Number); d.setHours(h,m,0,0); }
  return d;
}

let me = null;
function login(u,p){
  const found = users.find(x=>x.user===u.trim().toLowerCase() && x.pass===p);
  if(!found) return false;
  me = found; store.set('tc_session',found.user); startApp(); return true;
}
function doLogin(){
  try{
    if(!login($('#lUser').value,$('#lPass').value)){
      $('#loginError').textContent='Usuario o contraseña incorrectos.';
      $('#loginError').classList.remove('d-none');
    }
  }catch(err){
    $('#loginError').textContent='Error: '+err.message; $('#loginError').classList.remove('d-none');
  }
}
$('#loginBtn').addEventListener('click',doLogin);
['#lUser','#lPass'].forEach(s=>$(s).addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); doLogin(); } }));
$('#togglePass').onclick=()=>{ const i=$('#lPass'); i.type=i.type==='password'?'text':'password'; };
$('#logoutBtn').onclick=()=>{
  me=null; store.set('tc_session',null);
  $('#appScreen').style.display='none'; $('#loginScreen').style.display='flex';
  $('#lUser').value=''; $('#lPass').value=''; $('#loginError').classList.add('d-none');
};

function show(view){
  $$('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+view));
  $$('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  if(view==='home')    renderHome();
  if(view==='history') renderHistory();
  if(view==='reports') renderReport();
  if(view==='team')    renderTeam();
  if(view==='profile') renderProfile();
  $('.content').scrollTop=0;
}
$$('#nav button').forEach(b=>b.onclick=()=>show(b.dataset.view));

function startApp(){
  $('#loginScreen').style.display='none'; $('#appScreen').style.display='flex';
  $('#topAvatar').src=photoOf(me); $('#topName').textContent=me.name; $('#topRole').textContent=ROLE_LABEL[me.role];
  const isMgr = me.role==='gerente';
  $('#navTeam').style.display   = isMgr?'':'none';
  $('#fRoleWrap').style.display = isMgr?'':'none';
  const today=now();
  $('#fFrom').value=ymd(new Date(today.getTime()-14*864e5)); $('#fTo').value=ymd(today);
  show('home');
}

setInterval(()=>{
  if(!me) return;
  const d=now(), s = simTime ? '00' : pad(new Date().getSeconds());
  $('#clock').textContent=`${pad(d.getHours())}:${pad(d.getMinutes())}:${s}`;
},1000);

const todayRec = ()=>records.find(r=>r.user===me.user && r.date===ymd(now()));

function renderHome(){
  const d=now();
  $('#dateLabel').textContent=fmtDate(ymd(d));
  $('#clock').textContent=`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  $('#schedLabel').textContent=`${SCHEDULE[me.role].in} - ${SCHEDULE[me.role].out}`;
  $('#tolLabel').textContent=TOLERANCE;

  const r=todayRec(), box=$('#todayStatus');
  if(!r){
    box.className='status-card mb-3';
    box.innerHTML='<span class="s-ico"><i class="bi bi-hourglass-split"></i></span><div>Aún no marcaste tu entrada hoy.</div>';
  } else {
    const late=r.late>0;
    box.className=`status-card mb-3 ${late?'is-late':'is-ok'}`;
    box.innerHTML=`<span class="s-ico"><i class="bi ${late?'bi-exclamation-lg':'bi-check-lg'}"></i></span>
      <div>Entrada <b>${r.in}</b> · ${late?`<b>${r.late} min de retraso</b>`:'Puntual'}${r.out?`<br>Salida <b>${r.out}</b>`:''}</div>`;
  }
  $('#btnIn').disabled=!!r;
  $('#btnOut').disabled=!r||!!(r&&r.out);

  const mp=ymd(d).slice(0,7), mine=records.filter(x=>x.user===me.user&&x.date.startsWith(mp));
  const late=mine.filter(x=>x.late>0).length;
  const pct=mine.length?Math.round((mine.length-late)/mine.length*100):0;
  $('#stDays').textContent=mine.length; $('#stLate').textContent=late; $('#stPunct').textContent=pct+'%';
  const bar=$('#punctBar'); bar.style.width=pct+'%';
  bar.className='bar-fill '+(pct>=80?'':pct>=60?'mid':'low');
}

function getGeo(){
  return new Promise(res=>{
    if(!$('#geoSwitch').checked || !navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(
      p=>res({lat:+p.coords.latitude.toFixed(5),lng:+p.coords.longitude.toFixed(5)}),
      ()=>res(null),{timeout:6000});
  });
}
$('#btnIn').onclick=async()=>{
  if(todayRec()) return;
  const d=now(), t=hm(d), late=calcLate(me.role,t), geo=await getGeo();
  records.push({id:uid(),user:me.user,date:ymd(d),in:t,out:null,late,geo}); saveRecords();
  toast(late>0?`Entrada ${t}. Llegaste ${late} min tarde.`:`Entrada ${t}. ¡Puntual!`); renderHome();
};
$('#btnOut').onclick=async()=>{
  const r=todayRec(); if(!r||r.out) return;
  r.out=hm(now()); const g=await getGeo(); if(g) r.geoOut=g;
  saveRecords(); toast(`Salida registrada a las ${r.out}`); renderHome();
};

function recCard(r, showUser){
  const u=users.find(x=>x.user===r.user)||{user:r.user,name:r.user,role:'cajero'};
  const hrs = r.out ? ((toMin(r.out)-toMin(r.in))/60).toFixed(1)+' h' : '—';
  return `<div class="rec">
    <img src="${photoOf(u)}" class="avatar" alt="">
    <div class="info">
      ${showUser?`<div class="n">${esc(u.name)} <span class="text-secondary fw-medium">· ${ROLE_LABEL[u.role]}</span></div>`:''}
      <div class="t">Entrada <b>${r.in}</b> · Salida <b>${r.out||'—'}</b> · ${hrs}${r.geo?' · <i class="bi bi-geo-alt-fill"></i>':''}</div>
    </div>
    <span class="chip ${r.late>0?'chip-late':'chip-ok'}">${r.late>0?`+${r.late} min`:'Puntual'}</span>
  </div>`;
}
function groupByDate(list){
  const g={}; list.forEach(r=>(g[r.date]=g[r.date]||[]).push(r));
  return Object.keys(g).sort().reverse().map(d=>({date:d,items:g[d].sort((a,b)=>a.in.localeCompare(b.in))}));
}
const emptyState=(icon,text)=>`<div class="empty"><i class="bi ${icon}"></i>${text}</div>`;

function renderHistory(){
  const groups=groupByDate(records.filter(r=>r.user===me.user));
  $('#historyList').innerHTML = groups.length
    ? groups.map(g=>`<div class="day-group"><div class="day-head"><span class="d">${fmtDate(g.date)}</span></div>${g.items.map(r=>recCard(r,false)).join('')}</div>`).join('')
    : emptyState('bi-inbox','Todavía no hay registros');
}

function filteredRecords(){
  const from=$('#fFrom').value, to=$('#fTo').value, role=$('#fRole').value, st=$('#fStatus').value;
  return records.filter(r=>{
    if(me.role!=='gerente' && r.user!==me.user) return false;
    if(from && r.date<from) return false;
    if(to && r.date>to) return false;
    if(role){ const u=users.find(x=>x.user===r.user); if(!u||u.role!==role) return false; }
    if(st==='ok' && r.late>0) return false;
    if(st==='late' && r.late===0) return false;
    return true;
  });
}
function renderReport(){
  const list=filteredRecords(), groups=groupByDate(list);
  const late=list.filter(r=>r.late>0), totalLate=late.reduce((a,r)=>a+r.late,0);
  $('#repStats').innerHTML=`
    <div class="col-4"><div class="tile tile-mint"><b>${list.length}</b><small>Registros</small></div></div>
    <div class="col-4"><div class="tile tile-red"><b>${late.length}</b><small>Tardanzas</small></div></div>
    <div class="col-4"><div class="tile"><b>${totalLate}</b><small>Min. perdidos</small></div></div>`;
  $('#reportList').innerHTML = groups.length ? groups.map(g=>{
    const l=g.items.filter(r=>r.late>0).length;
    return `<div class="day-group">
      <div class="day-head"><span class="d">${fmtDate(g.date)}</span>
      <span class="chip chip-neutral">${g.items.length} asist. · ${l} tarde</span></div>
      ${g.items.map(r=>recCard(r, me.role==='gerente')).join('')}</div>`;
  }).join('') : emptyState('bi-search','No hay datos para esos filtros');
}
$('#btnFilter').onclick=renderReport;
$('#btnCsv').onclick=()=>{
  const list=filteredRecords().sort((a,b)=>a.date.localeCompare(b.date));
  const rows=[['Fecha','Empleado','Rol','Entrada','Salida','Minutos tarde','Estado']];
  list.forEach(r=>{ const u=users.find(x=>x.user===r.user)||{name:r.user,role:''};
    rows.push([r.date,u.name,ROLE_LABEL[u.role]||'',r.in,r.out||'',r.late,r.late>0?'Tarde':'Puntual']); });
  const csv='﻿'+rows.map(r=>r.map(c=>`"${c}"`).join(',')).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download=`informe_asistencia_${ymd(new Date())}.csv`; a.click();
  toast('Informe exportado a CSV');
};

function renderTeam(){
  $('#teamList').innerHTML=users.map(u=>`<div class="member">
    <img src="${photoOf(u)}" class="avatar" alt="">
    <div class="info"><div class="fw-bold">${esc(u.name)}</div><small>@${esc(u.user)} · ${ROLE_LABEL[u.role]}</small></div>
    ${u.user!==me.user?`<button class="btn-del" data-del="${esc(u.user)}"><i class="bi bi-trash"></i></button>`:'<span class="chip chip-ok">Tú</span>'}</div>`).join('');
  $$('[data-del]').forEach(b=>b.onclick=()=>{
    if(!b.dataset.sure){
      b.dataset.sure='1'; b.textContent='¿Seguro?';
      setTimeout(()=>{ if(b.isConnected){ delete b.dataset.sure; b.innerHTML='<i class="bi bi-trash"></i>'; } },3000);
      return;
    }
    users=users.filter(u=>u.user!==b.dataset.del); store.set('tc_users',users); renderTeam(); toast('Empleado eliminado');
  });
}
$('#addUserBtn').addEventListener('click',()=>{
  const u=$('#nUser').value.trim().toLowerCase(), n=$('#nName').value.trim(), p=$('#nPass').value;
  if(!u||!n||!p) return toast('Completa nombre, usuario y contraseña');
  if(users.some(x=>x.user===u)) return toast('Ese usuario ya existe');
  users.push({user:u,pass:p,name:n,role:$('#nRole').value});
  store.set('tc_users',users);
  ['#nName','#nUser','#nPass'].forEach(s=>$(s).value='');
  renderTeam(); toast('Empleado registrado');
});

function renderProfile(){
  $('#profAvatar').src=photoOf(me);
  $('#profName').textContent=me.name; $('#profRole').textContent=ROLE_LABEL[me.role];
  $('#schedTable').innerHTML=Object.entries(SCHEDULE).map(([r,s])=>`<tr><td>${ROLE_LABEL[r]}</td><td>${s.in}</td><td>${s.out}</td></tr>`).join('');
  $('#simTime').value=simTime||'';
}
$('#photoInput').onchange=e=>{
  const f=e.target.files[0]; if(!f) return;
  const img=new Image, rd=new FileReader();
  rd.onload=()=>{ img.onload=()=>{
      const c=document.createElement('canvas'), s=200; c.width=c.height=s;
      const m=Math.min(img.width,img.height);
      c.getContext('2d').drawImage(img,(img.width-m)/2,(img.height-m)/2,m,m,0,0,s,s);
      const data=c.toDataURL('image/jpeg',.8); store.set('tc_photo_'+me.user,data);
      $('#profAvatar').src=data; $('#topAvatar').src=data; toast('Foto actualizada'); };
    img.src=rd.result; };
  rd.readAsDataURL(f);
};
$('#simApply').onclick=()=>{ const v=$('#simTime').value; if(!v) return toast('Elige una hora'); simTime=v; store.set('tc_sim',v); toast('Hora simulada: '+v); };
$('#simClear').onclick=()=>{ simTime=null; store.set('tc_sim',null); $('#simTime').value=''; toast('Usando la hora real'); };

function applyTheme(t){
  document.documentElement.setAttribute('data-bs-theme',t); store.set('tc_theme',t);
  $('#themeBtn i').className = t==='dark'?'bi bi-sun-fill':'bi bi-moon-stars-fill';
}
$('#themeBtn').onclick=()=>applyTheme(document.documentElement.getAttribute('data-bs-theme')==='dark'?'light':'dark');
applyTheme(store.get('tc_theme','light'));

const sess=store.get('tc_session',null);
if(sess){ const u=users.find(x=>x.user===sess); if(u){ me=u; startApp(); } }
