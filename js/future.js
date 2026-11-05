// ===== COMPROMISSOS FUTUROS — MODAL V2 =====
async function openFutureInstallmentsModal(filter){
  filter=filter||'current';
  const data=await buildFutureData();
  if(!data.months.length){
    $('#futureInstallmentsInfo').innerHTML='';
    $('#futureInstallmentsBody').innerHTML='<p class="empty-state">Cadastre uma Conta Fixa com período para acompanhar os compromissos aqui.</p>';
    $('#futureInstallmentsModal').classList.add('show');
    return;
  }
  if(filter!=='all'&&filter!=='current'&&!data.monthData[filter])filter='current';
  futureModalFilter=filter;
  const curTotal=futureMonthTotal(data.monthData[data.currentKey],data.paidFixed);
  $('#futureInstallmentsInfo').innerHTML=futureToolbarHTML(data,filter,curTotal);
  $('#futureInstallmentsBody').innerHTML=futureMonthsHTML(data,filter);
  $('#futureInstallmentsModal').classList.add('show');
}
// __BUILD__
async function buildFutureData(){
  const fixedAll=(await db.fixedexpenses.toArray()).filter(e=>e.active);
  const pays=await db.fixedpayments.toArray();
  const paidFixed=new Set(pays.map(p=>p.expenseId+':'+p.monthKey));
  const now=new Date();
  const currentKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const monthData={};
  for(const f of fixedAll){
    const st=f.startMonth||(f.createdAt?f.createdAt.substring(0,7):currentKey);
    const cursor=new Date(parseInt(st.slice(0,4)),parseInt(st.slice(5,7))-1,1);
    const lastCursor=f.endMonth?new Date(parseInt(f.endMonth.slice(0,4)),parseInt(f.endMonth.slice(5,7))-1,1):new Date(now.getFullYear(),now.getMonth()+12,1);
    while(cursor<=lastCursor){
      const key=`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}`;
      if(!monthData[key])monthData[key]={items:[]};
      monthData[key].items.push({id:f.id,monthKey:key,description:f.name,category:f.category||'Contas Fixas',dueDay:f.dueDay||null,value:f.amount});
      cursor.setMonth(cursor.getMonth()+1);
    }
  }
  for(const key of Object.keys(monthData)){
    monthData[key].items.sort((a,b)=>((a.dueDay||99)-(b.dueDay||99))||a.description.localeCompare(b.description));
  }
  return {monthData,paidFixed,currentKey,months:Object.keys(monthData).sort()};
}
// __TOOLBAR__
function futureMonthTotal(month,paidFixed){
  if(!month)return 0;
  return month.items.filter(i=>!paidFixed.has(i.id+':'+i.monthKey)).reduce((s,i)=>s+i.value,0);
}
function futureLabel(key){
  const meses=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const [y,m]=key.split('-');
  return `${meses[parseInt(m)-1]}/${y}`;
}
function futureToolbarHTML(data,filter,curTotal){
  const opts=[
    `<option value="current"${filter==='current'?' selected':''}>Mês atual (${futureLabel(data.currentKey)})</option>`,
    `<option value="all"${filter==='all'?' selected':''}>Todos os meses</option>`,
    ...data.months.map(k=>`<option value="${k}"${filter===k?' selected':''}>${futureLabel(k)}</option>`)
  ].join('');
  return `<div class="future-toolbar">
    <label for="futureMonthFilter">Mostrar</label>
    <select id="futureMonthFilter" class="chart-month-filter" onchange="openFutureInstallmentsModal(this.value)">${opts}</select>
    <span class="future-current-total">Mês atual: <strong>${formatCurrency(curTotal)}</strong></span>
  </div>`;
}
// __MONTHS__
function futureMonthsHTML(data,filter){
  let keys;
  if(filter==='current')keys=data.monthData[data.currentKey]?[data.currentKey]:[];
  else if(filter==='all')keys=data.months;
  else keys=[filter];
  if(!keys.length)return '<p class="empty-state">Nenhum compromisso para este mês.</p>';
  return keys.map(key=>futureMonthHTML(data,key,filter)).join('');
}
function futureMonthHTML(data,key,filter){
  const month=data.monthData[key];
  if(!month)return '';
  const total=futureMonthTotal(month,data.paidFixed);
  const pending=month.items.filter(i=>!data.paidFixed.has(i.id+':'+i.monthKey)).length;
  const isCurrent=key===data.currentKey;
  const open=(filter==='all')?(isCurrent?' open':''):' open';
  return `<details class="future-month"${open}>
    <summary class="future-month-summary">
      <span class="future-month-label">📆 ${futureLabel(key)}${isCurrent?' <span class="future-now">atual</span>':''}</span>
      <span class="future-month-meta">${pending} pendente${pending!==1?'s':''}</span>
      <span class="future-month-total">${formatCurrency(total)}</span>
      <span class="future-chev" aria-hidden="true">⌄</span>
    </summary>
    <div class="future-items">${month.items.map(i=>futureItemHTML(i,data.paidFixed)).join('')}</div>
  </details>`;
}
function futureItemHTML(i,paidFixed){
  const paid=paidFixed.has(i.id+':'+i.monthKey);
  const dueDate=getFixDueDate(i,i.monthKey);
  const overdue=!paid&&dueDate<todayLocal();
  const due=i.dueDay?`dia ${parseInt(dueDate.slice(-2),10)}`:'sem dia';
  const status=paid?'Paga':overdue?'Em atraso':'Pendente';
  const action=paid
    ? `<button class="btn-sm future-paid" onclick="toggleFutureFixed(${i.id},'${i.monthKey}')">Paga</button>`
    : `<button class="btn-sm future-pay" onclick="toggleFutureFixed(${i.id},'${i.monthKey}')">Pagar</button>`;
  return `<div class="future-item${paid?' is-paid':''}${overdue?' is-overdue':''}">
    <span class="future-due${overdue?' is-overdue':''}">${due}</span>
    <div class="future-item-main">
      <div class="future-item-title">${escapeHtml(i.description)}</div>
      <div class="future-item-sub">${escapeHtml(i.category)} · <span class="future-item-status${overdue?' is-overdue':''}">${status}</span></div>
    </div>
    <span class="future-item-value">${formatCurrency(i.value)}</span>
    ${action}
  </div>`;
}
