
const CATS={gasto:['Comida','Transporte','Hogar','Servicios','Salud','Ocio','Educación','Ropa','Deudas','Otros'],ingreso:['Sueldo','Pensión','Extra','Regalo','Otros']};
const MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const COLS=['tx','goals','debts'];
const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,'0');
const clp=n=>'$'+Math.round(n).toLocaleString('es-CL');
const parseMoney=s=>parseInt(String(s).replace(/\D/g,''),10)||0;
const now=new Date();
const todayISO=now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate());
const thisMonth=todayISO.slice(0,7);
function shiftMonth(k,d){let[y,m]=k.split('-').map(Number);m+=d;while(m<1){m+=12;y--}while(m>12){m-=12;y++}return y+'-'+pad(m)}
const monthLabel=k=>{const[y,m]=k.split('-');return MESES[m-1]+' '+y};
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}

/* ---------- almacenamiento: en este mismo teléfono ---------- */
const LKEY='cuentas-claras-v1', BKKEY='cuentas-claras-ultimo-respaldo';
let S={tx:[],goals:[],debts:[]};
let ready=true;
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const pbId=uid;
function lsGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
function lsSet(k,v){try{localStorage.setItem(k,v);return true}catch(e){return false}}
function save(){if(!lsSet(LKEY,JSON.stringify(S)))toast('No se pudo guardar en el teléfono. Revisa el espacio disponible.')}
function load(){
  const raw=lsGet(LKEY);
  if(raw===null)return;
  try{const d=JSON.parse(raw);for(const c of COLS)if(Array.isArray(d[c]))S[c]=d[c].filter(x=>x&&!x.ex)}catch(e){}
}
async function put(col,obj){const i=S[col].findIndex(x=>x.id===obj.id);i<0?S[col].push(obj):S[col][i]=obj;save();render()}
async function patch(col,id,p){const cur=S[col].find(x=>x.id===id);if(cur)await put(col,{...cur,...p})}
async function remove(col,id){S[col]=S[col].filter(x=>x.id!==id);save();render()}
function daysSinceBackup(){const t=Number(lsGet(BKKEY));return t?Math.floor((Date.now()-t)/864e5):null}
function markBackup(){lsSet(BKKEY,String(Date.now()));render()}
function init(){
  load();render();
  try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
  if('serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
}

let month=thisMonth,view='inicio',filter='todos',txType='gasto',txCat='Comida';

function toast(msg){const t=$('toast');t.textContent=msg;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,2400)}
function monthTx(k){return S.tx.filter(t=>t.date&&t.date.slice(0,7)===k)}
function totals(k){let i=0,g=0;for(const t of monthTx(k)){t.type==='ingreso'?i+=t.amount:g+=t.amount}return{i,g}}
const loadingRow='<div class="empty">Cargando tus datos…</div>';

function txRow(t){
  const ing=t.type==='ingreso';
  const [y,m,d]=t.date.split('-');
  return `<div class="tx"><div class="dot">${esc(t.cat.slice(0,2))}</div>
    <div class="meta"><b>${esc(t.note||t.cat)}</b><small>${esc(t.cat)} · ${Number(d)} ${MESES[m-1].slice(0,3)}</small></div>
    <span class="num ${ing?'amt-in':'amt-out'}">${ing?'+':'−'}${clp(t.amount)}</span>
    <button class="del" data-del="${t.id}" aria-label="Borrar movimiento">✕</button></div>`;
}

function renderInicio(){
  const{i,g}=totals(month),s=i-g;
  $('saldo').textContent=(s<0?'−':'')+clp(Math.abs(s));
  $('ing').textContent=clp(i);$('gas').textContent=clp(g);
  const ahorro=monthTx(month).filter(t=>t.cat==='Ahorro').reduce((a,t)=>a+t.amount,0);
  const deudas=monthTx(month).filter(t=>t.cat==='Deudas').reduce((a,t)=>a+t.amount,0);
  $('rate').textContent=i?`Pagaste ${clp(deudas)} en deudas y apartaste ${clp(ahorro)} para tus metas`:'Aún no registras ingresos este mes';
  const by={};for(const t of monthTx(month))if(t.type==='gasto')by[t.cat]=(by[t.cat]||0)+t.amount;
  const arr=Object.entries(by).sort((a,b)=>b[1]-a[1]),max=arr[0]?arr[0][1]:1;
  $('cats').innerHTML=!ready?loadingRow:arr.length?arr.map(([c,v])=>`<div class="cat"><span>${esc(c)}<small>${Math.round(v/g*100)}%</small></span><span class="num">${clp(v)}</span><div class="bar"><i style="width:${v/max*100}%"></i></div></div>`).join(''):'<div class="empty">Sin gastos este mes. Toca + para registrar el primero.</div>';
  renderChart();
  const rec=[...monthTx(month)].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  $('recent').innerHTML=!ready?loadingRow:rec.length?rec.map(txRow).join(''):'<div class="empty">No hay movimientos en este mes. Empieza registrando tu sueldo con el botón +.</div>';
}
function niceMax(v){if(v<=0)return 100000;const p=Math.pow(10,Math.floor(Math.log10(v))),n=v/p;return(n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*p}
function short(v){return v>=1e6?(v/1e6).toLocaleString('es-CL',{maximumFractionDigits:1})+'M':v>=1e3?Math.round(v/1e3)+'k':String(v)}
function renderChart(){
  const ks=[];for(let i=5;i>=0;i--)ks.push(shiftMonth(month,-i));
  const data=ks.map(k=>totals(k)),top=niceMax(Math.max(...data.map(d=>Math.max(d.i,d.g))));
  const W=340,H=170,L=34,B=22,T=10,ch=H-B-T,cw=(W-L)/6,bw=Math.min(14,cw/3.2);
  let s=`<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Ingresos y gastos de los últimos 6 meses">`;
  for(const f of[0,.5,1]){const y=T+ch-ch*f;s+=`<line x1="${L}" x2="${W}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="1"/><text x="${L-6}" y="${y+4}" text-anchor="end">${short(top*f)}</text>`}
  data.forEach((d,j)=>{const cx=L+cw*j+cw/2,hi=d.i/top*ch,hg=d.g/top*ch,cur=ks[j]===month;
    s+=`<rect x="${cx-bw-1}" y="${T+ch-hi}" width="${bw}" height="${hi}" rx="2" fill="var(--in)" opacity="${cur?1:.55}"/>`;
    s+=`<rect x="${cx+1}" y="${T+ch-hg}" width="${bw}" height="${hg}" rx="2" fill="var(--out)" opacity="${cur?1:.55}"/>`;
    s+=`<text x="${cx}" y="${H-6}" text-anchor="middle" style="${cur?'fill:var(--ink);font-weight:600':''}">${MESES[Number(ks[j].slice(5))-1].slice(0,3)}</text>`});
  $('chart').innerHTML=s+'</svg>';
}
function renderMov(){
  if(!ready){$('movList').innerHTML=loadingRow;return}
  const list=monthTx(month).filter(t=>filter==='todos'||t.type===filter).sort((a,b)=>b.date.localeCompare(a.date));
  if(!list.length){$('movList').innerHTML='<div class="empty">No hay movimientos con este filtro.</div>';return}
  let h='',last='';for(const t of list){if(t.date!==last){last=t.date;const dt=new Date(t.date+'T12:00');h+=`<div class="day">${dt.toLocaleDateString('es-CL',{weekday:'long',day:'numeric',month:'long'})}</div>`}h+=txRow(t)}
  $('movList').innerHTML=h;
}
function goalSaved(id){return S.tx.filter(t=>t.goalId===id).reduce((a,t)=>a+t.amount,0)}
function renderMetas(){
  if(!ready){$('goals').innerHTML=loadingRow;return}
  $('goals').innerHTML=S.goals.length?S.goals.map(g=>{const sv=goalSaved(g.id),p=Math.min(100,sv/g.target*100);
    return `<div class="goal"><div class="top"><h2>${esc(g.name)}</h2><span class="num">${Math.round(p)}%</span></div>
      <div class="prog"><i style="width:${p}%"></i></div>
      <div class="nums"><span class="num">${clp(sv)} de ${clp(g.target)}</span><span>${sv>=g.target?'¡Meta cumplida!':'Faltan '+clp(g.target-sv)}</span></div>
      <form class="inline" data-goal="${g.id}"><input type="text" id="ap-${g.id}" class="num money" inputmode="numeric" placeholder="Monto a aportar" aria-label="Monto a aportar"><button class="btn" type="submit">Aportar</button></form>
      <div><button class="del" data-delgoal="${g.id}">Eliminar meta</button></div></div>`}).join(''):'<div class="empty">Todavía no tienes metas. Crea una abajo.</div>';
}

const ST={aldia:'Al día',repactada:'Repactada',pendiente:'Sin arreglar'};
function debtPaid(id){return S.tx.filter(t=>t.debtId===id).reduce((a,t)=>a+t.amount,0)}
function renderDeudas(){
  const debts=[...S.debts].sort((a,b)=>(a.orden??99)-(b.orden??99));
  let tot=0,cuo=0,pend=0;
  for(const d of debts){tot+=Math.max(0,(d.total||0)-debtPaid(d.id));if(d.status!=='pendiente')cuo+=d.cuota||0;if(d.status==='pendiente')pend++}
  $('dTotal').textContent=clp(tot);$('dCuotas').textContent=clp(cuo);$('dPend').textContent=pend+' de '+debts.length;
  const ing=totals(thisMonth).i;
  $('dRate').textContent=ing&&cuo?`Tus cuotas son el ${Math.round(cuo/ing*100)}% de tus ingresos de este mes`:'Registra tus ingresos del mes para ver cuánto se va en cuotas';
  if(!ready){$('debts').innerHTML=loadingRow;return}
  $('debts').innerHTML=debts.length?debts.map(d=>{const paid=debtPaid(d.id),rest=Math.max(0,(d.total||0)-paid),p=d.total?Math.min(100,paid/d.total*100):0;
    return `<div class="debt" data-debt="${d.id}">
      <div class="row-head"><h2>${esc(d.name)}</h2><span class="pill ${d.status}">${ST[d.status]||d.status}</span></div>
      ${d.total?`<div class="goal" style="padding:0;border:0"><div class="prog"><i style="width:${p}%"></i></div><div class="nums"><span class="num">Pagado ${clp(paid)}</span><span class="num">Falta ${clp(rest)}</span></div></div>`:''}
      <div class="grid">
        <label>Debo en total<input type="text" class="num money" inputmode="numeric" id="dt-${d.id}" data-k="total" value="${d.total?clp(d.total):''}" placeholder="$0"></label>
        <label>Cuota mensual<input type="text" class="num money" inputmode="numeric" id="dc-${d.id}" data-k="cuota" value="${d.cuota?clp(d.cuota):''}" placeholder="$0"></label>
        <label>Día de pago<input type="text" class="num" inputmode="numeric" id="dd-${d.id}" data-k="dia" value="${d.dia||''}" placeholder="1-31"></label>
      </div>
      <div class="actions">
        <select id="ds-${d.id}" data-k="status" aria-label="Estado de la deuda">${Object.entries(ST).map(([k,v])=>`<option value="${k}" ${k===d.status?'selected':''}>${v}</option>`).join('')}</select>
        <button class="btn" type="button" data-pay="${d.id}">Registrar pago${d.cuota?' de '+clp(d.cuota):''}</button>
        <button class="del" type="button" data-deldebt="${d.id}">Quitar</button>
      </div></div>`}).join(''):'<div class="empty">No tienes deudas registradas.</div>';
}
$('debts').addEventListener('change',e=>{const el=e.target,k=el.dataset.k;if(!k)return;const id=el.closest('[data-debt]').dataset.debt;
  const v=k==='status'?el.value:k==='dia'?Math.min(31,parseMoney(el.value)):parseMoney(el.value);patch('debts',id,{[k]:v})});
$('debts').addEventListener('click',e=>{
  const p=e.target.closest('[data-pay]');
  if(p){const d=S.debts.find(x=>x.id===p.dataset.pay);if(!d.cuota){toast('Primero ingresa la cuota mensual');return}
    put('tx',{id:uid(),type:'gasto',amount:d.cuota,cat:'Deudas',debtId:d.id,date:todayISO,note:'Pago cuota '+d.name});toast('Pago a '+d.name+' registrado');return}
  const x=e.target.closest('[data-deldebt]');
  if(x){if(x.classList.contains('arm'))remove('debts',x.dataset.deldebt);else{x.classList.add('arm');x.textContent='¿Quitar?'}}
});
$('debtForm').onsubmit=e=>{e.preventDefault();const n=$('dName').value.trim();if(!n)return;put('debts',{id:uid(),name:n,status:'pendiente',total:0,cuota:0,dia:0,orden:S.debts.length});$('dName').value=''};

function render(){
  $('monthLabel').textContent=monthLabel(month);
  $('next').disabled=month>=thisMonth;$('next').style.opacity=month>=thisMonth?.35:1;
  const ds=daysSinceBackup(),hasData=S.tx.length>0;
  $('bkBanner').hidden=!(hasData&&(ds===null||ds>=7));
  $('bkBannerText').textContent=ds===null?'Aún no guardas un respaldo de tus datos.':`Hace ${ds} días que no guardas un respaldo.`;
  $('lastBk').textContent=ds===null?'Todavía no has guardado ningún respaldo.':ds===0?'Último respaldo: hoy.':`Último respaldo: hace ${ds} día${ds===1?'':'s'}.`;
  for(const v of['inicio','mov','metas','deudas','ajustes'])$('v-'+v).hidden=v!==view;
  document.querySelectorAll('nav.tabs [data-go]').forEach(b=>{if(b.dataset.go===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
  document.querySelector('.month').hidden=!(view==='inicio'||view==='mov');
  if(view==='inicio')renderInicio();if(view==='mov')renderMov();if(view==='metas')renderMetas();if(view==='deudas')renderDeudas();
}

/* navegación y borrado en dos toques */
document.addEventListener('click',e=>{
  const go=e.target.closest('[data-go]');if(go){view=go.dataset.go;render();window.scrollTo(0,0);return}
  const del=e.target.closest('[data-del]');
  if(del){if(del.classList.contains('arm')){remove('tx',del.dataset.del);toast('Movimiento borrado')}
    else{document.querySelectorAll('[data-del].arm').forEach(b=>{b.classList.remove('arm');b.textContent='✕'});del.classList.add('arm');del.textContent='¿Borrar?'}return}
  const dg=e.target.closest('[data-delgoal]');
  if(dg){if(dg.classList.contains('arm')){remove('goals',dg.dataset.delgoal);toast('Meta eliminada')}
    else{dg.classList.add('arm');dg.textContent='Toca de nuevo para eliminar'}return}
});
$('prev').onclick=()=>{month=shiftMonth(month,-1);render()};
$('next').onclick=()=>{if(month<thisMonth){month=shiftMonth(month,1);render()}};
$('filter').onclick=e=>{const b=e.target.closest('[data-f]');if(!b)return;filter=b.dataset.f;$('filter').querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed',c===b));renderMov()};

/* montos con separador de miles */
document.addEventListener('input',e=>{if(e.target.classList.contains('money')){const v=parseMoney(e.target.value);e.target.value=v?clp(v):''}});

/* hoja de registro */
function drawCats(){$('catChips').innerHTML=CATS[txType].map(c=>`<button type="button" class="chip" data-c="${c}" aria-pressed="${c===txCat}">${c}</button>`).join('')}
function openSheet(){$('sheet').hidden=false;$('sheetBg').hidden=false;$('date').value=month===thisMonth?todayISO:month+'-01';drawCats();setTimeout(()=>$('amt').focus(),50)}
function closeSheet(){$('sheet').hidden=true;$('sheetBg').hidden=true}
$('openAdd').onclick=openSheet;$('closeAdd').onclick=closeSheet;$('sheetBg').onclick=closeSheet;
$('typeSeg').onclick=e=>{const b=e.target.closest('[data-t]');if(!b)return;txType=b.dataset.t;txCat=CATS[txType][0];$('typeSeg').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));drawCats()};
$('catChips').onclick=e=>{const b=e.target.closest('[data-c]');if(!b)return;txCat=b.dataset.c;drawCats()};
$('txForm').onsubmit=e=>{e.preventDefault();const a=parseMoney($('amt').value);if(!a){toast('Ingresa un monto mayor a $0');return}
  const date=$('date').value||todayISO;
  put('tx',{id:uid(),type:txType,amount:a,cat:txCat,date,note:$('note').value.trim()});
  month=date.slice(0,7);$('amt').value='';$('note').value='';closeSheet();render();toast((txType==='gasto'?'Gasto':'Ingreso')+' guardado')};

/* metas */
$('goalForm').onsubmit=e=>{e.preventDefault();const n=$('gName').value.trim(),t=parseMoney($('gTarget').value);if(!n||!t){toast('Completa nombre y monto');return}
  put('goals',{id:uid(),name:n,target:t});$('gName').value='';$('gTarget').value='';toast('Meta creada')};
$('goals').addEventListener('submit',e=>{e.preventDefault();const f=e.target,id=f.dataset.goal,inp=f.querySelector('input'),a=parseMoney(inp.value);if(!a)return;
  const g=S.goals.find(x=>x.id===id);put('tx',{id:uid(),type:'gasto',amount:a,cat:'Ahorro',goalId:id,date:todayISO,note:'Aporte a '+g.name});inp.value='';toast('Aporte de '+clp(a)+' registrado')});

/* respaldo */
$('copyBk').onclick=()=>{const txt=JSON.stringify(S);const out=$('bkOut');out.value=txt;
  const fb=()=>{out.hidden=false;out.focus();out.select();toast('Selecciona y copia el texto')};
  try{navigator.clipboard.writeText(txt).then(()=>{markBackup();toast('Respaldo copiado. Pégalo en Notas o en un correo.')},fb)}catch(e){fb()}};
function restoreFrom(text){
  let d;try{d=JSON.parse(text);if(!d||!Array.isArray(d.tx))throw 0}catch(e){toast('Ese contenido no es un respaldo válido');return false}
  const n={tx:[],goals:[],debts:[]};
  for(const c of COLS)for(const it of (Array.isArray(d[c])?d[c]:[]))if(it&&it.id&&!it.ex)n[c].push(it);
  S=n;save();view='inicio';month=thisMonth;render();toast('Datos restaurados');return true;
}
$('restore').onclick=()=>{if(restoreFrom($('bkIn').value))$('bkIn').value=''};
$('bkFile').onchange=e=>{const f=e.target.files&&e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>restoreFrom(String(r.result));r.readAsText(f);e.target.value=''};
$('exportBk').onclick=async()=>{
  const name='cuentas-claras-'+todayISO+'.json';
  const blob=new Blob([JSON.stringify({app:'Cuentas Claras',fecha:todayISO,...S},null,1)],{type:'application/json'});
  const file=new File([blob],name,{type:'application/json'});
  try{
    if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:name});markBackup();toast('Respaldo listo');return}
  }catch(err){if(err&&err.name==='AbortError')return}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);markBackup();toast('Respaldo descargado');
};
$('wipe').onclick=async function(){if(this.dataset.arm){delete this.dataset.arm;this.textContent='Borrar todos los datos';
    S={tx:[],goals:[],debts:[]};save();view='inicio';render();toast('Datos borrados')}
  else{this.dataset.arm=1;this.textContent='Toca de nuevo para confirmar'}};

render();
init();

