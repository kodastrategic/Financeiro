const SEED_CATEGORIES = [
  {name:'Salário',type:'income',color:'#3b82f6'},{name:'Freelance',type:'income',color:'#8b5cf6'},
  {name:'Investimentos',type:'income',color:'#22c55e'},{name:'Vendas',type:'income',color:'#f59e0b'},
  {name:'Prêmio',type:'income',color:'#ec4899'},{name:'Outras Receitas',type:'income',color:'#6366f1'},
  {name:'Alimentação',type:'expense',color:'#ef4444'},{name:'Contas Fixas',type:'expense',color:'#f97316'},
  {name:'Mercado',type:'expense',color:'#eab308'},{name:'Transporte',type:'expense',color:'#14b8a6'},
  {name:'Lazer',type:'expense',color:'#ec4899'},{name:'Saúde',type:'expense',color:'#06b6d4'},
  {name:'Educação',type:'expense',color:'#8b5cf6'},{name:'Moradia',type:'expense',color:'#d946ef'},
  {name:'Assinaturas',type:'expense',color:'#64748b'},{name:'Impostos',type:'expense',color:'#dc2626'},
  {name:'Emergência',type:'expense',color:'#f59e0b'},{name:'Outras Despesas',type:'expense',color:'#84cc16'}
];
const SEED_COMMANDS = [
  {keyword:'entrada',category:'Outras Receitas',type:'income'},{keyword:'saida',category:'Outras Despesas',type:'expense'},
  {keyword:'salario',category:'Salário',type:'income'},{keyword:'freela',category:'Freelance',type:'income'},
  {keyword:'invest',category:'Investimentos',type:'income'},{keyword:'mercado',category:'Mercado',type:'expense'},
  {keyword:'combustivel',category:'Transporte',type:'expense'},{keyword:'transporte',category:'Transporte',type:'expense'},
  {keyword:'lazer',category:'Lazer',type:'expense'},{keyword:'saude',category:'Saúde',type:'expense'},
  {keyword:'educacao',category:'Educação',type:'expense'},{keyword:'alimentacao',category:'Alimentação',type:'expense'},
  {keyword:'contas',category:'Contas Fixas',type:'expense'},{keyword:'moradia',category:'Moradia',type:'expense'},
  {keyword:'internet',category:'Assinaturas',type:'expense'},{keyword:'assinaturas',category:'Assinaturas',type:'expense'}
];
// db é fornecido pelo supabase-config.js + js/db.js

let charts={}, editingCategory=null, backupTimer=null;
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const todayLocal=()=>new Date().toLocaleDateString('en-CA');

// === AUTO-BACKUP (cloud, no localStorage needed) ===
function scheduleBackup(){}
async function exportBackupToFile(){
  const all=await db.transactions.toArray(),cmds=await db.commands.toArray(),cats=await db.categories.toArray(),
    cards=await db.cards.toArray(),insts=await db.installments.toArray(),debts=await db.debts.toArray(),
    dps=await db.debtpayments.toArray(),ips=await db.invoicepayments.toArray(),recs=await db.recurrings.toArray(),
    fes=await db.fixedexpenses.toArray(),fps=await db.fixedpayments.toArray(),bgs=await db.budgets.toArray();
  const data={version:7,exportedAt:new Date().toISOString(),data:{transactions:all,commands:cmds,categories:cats,cards,installments:insts,debts,debtPayments:dps,invoicePayments:ips,recurrings:recs,fixedExpenses:fes,fixedPayments:fps,budgets:bgs}};
  downloadFile(JSON.stringify(data,null,2),`financeapp_autobackup_${formatDateTime(new Date())}.json`,'application/json');
}

document.addEventListener('DOMContentLoaded',async()=>{
  try{
    await seedData(); await loadCategoriesSelect(); await loadCommandsTable(); await loadCategoriesTable();
    setupTabNavigation(); setupChat(); setupCommandForm(); setupCategoryForm();
    setupCardForm(); setupInstallmentForm(); setupDebtForm(); setupRecurringForm(); setupFixedForm();
    setupEditTxForm(); setupBudgetForm();
    await loadCardSelect(); await loadFixedTable(); await loadBudgetsTable();
    await refreshDashboard(); setupChartGlow(); setupTopChartFilters(); renderChatHistory(); scrollChatToTop(); $('#chatInput').focus();
  }catch(e){console.error(e);showNotification('Erro: '+e.message);}
});

async function seedData(){
  const cc=await db.categories.count();
  if(cc===0){
    await db.categories.bulkAdd(SEED_CATEGORIES);
  } else {
    const all=await db.categories.toArray();
    for(const c of all){
      if(!c.color){const s=SEED_CATEGORIES.find(x=>x.name===c.name);c.color=s?.color||getDefaultColor(c.name);await db.categories.put(c);}
    }
  }
  const cmdCount=await db.commands.count();
  if(cmdCount===0){
    await db.commands.bulkAdd(SEED_COMMANDS);
  }
}

function setupTabNavigation(){
  $$('.tab-btn').forEach(b=>{
    b.addEventListener('click',()=>{
      $$('.tab-btn').forEach(x=>x.classList.remove('active'));
      $$('.tab-content').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');$(`#${b.dataset.tab}`).classList.add('active');
      if(b.dataset.tab==='dashboard')Object.values(charts).forEach(c=>c?.resize());
      if(b.dataset.tab==='chat'){$('#chatInput').focus();scrollChatToTop();}
      if(b.dataset.tab==='cards'){loadCardsTable();loadInstallmentsTable();loadRecurringsTable();loadFixedTable();loadDebtsTable();loadDebtPaymentsTable();loadCardSelect();}
      if(b.dataset.tab==='commands'){loadBudgetsTable();}
    });
  });
}

// ===== CHAT =====
function setupChat(){
  const input=$('#chatInput'), send=$('#chatSend'), box=$('#autocompleteBox');
  let autoTimer;
  input.addEventListener('input',()=>{
    clearTimeout(autoTimer);
    autoTimer=setTimeout(()=>showAutocomplete(input,box),150);
  });
  input.addEventListener('keydown',(e)=>{
    if(e.key==='Enter'){hideAutocomplete(box);sendMessage();}
    if(e.key==='Tab'&&box.style.display!=='none'){e.preventDefault();selectAutocomplete(input,box);}
    if(e.key==='Escape')hideAutocomplete(box);
  });
  send.addEventListener('click',()=>{hideAutocomplete(box);sendMessage();});
}
function sendMessage(){
  const input=$('#chatInput'),text=input.value.trim();
  if(!text)return;processCommand(text);input.value='';hideAutocomplete($('#autocompleteBox'));
}
async function showAutocomplete(input,box){
  const text=input.value;
  if(!text.startsWith('/')){box.style.display='none';return;}
  const partial=text.slice(1).toLowerCase();
  const cmds=await db.commands.toArray();
  const filtered=cmds.filter(c=>c.keyword.includes(partial)).slice(0,8);
  if(!filtered.length||text.includes(' ')){box.style.display='none';return;}
  box.innerHTML=filtered.map(c=>`<div data-keyword="${c.keyword}" data-category="${c.category}" data-type="${c.type}" onclick="selectAutocompleteItem('/${c.keyword} ')">/${c.keyword} <span style="color:${c.type==='income'?'#22c55e':'#ef4444'};font-size:0.75rem">${c.category}</span></div>`).join('');
  box.style.display='block';
}
function selectAutocompleteItem(val){
  const input=$('#chatInput');input.value=val;input.focus();hideAutocomplete($('#autocompleteBox'));
}
function selectAutocomplete(input,box){
  const sel=box.querySelector('.auto-item-sel')||box.firstElementChild;
  if(sel&&sel.dataset.keyword)input.value='/'+sel.dataset.keyword+' ';
  hideAutocomplete(box);
}
function hideAutocomplete(b){b.style.display='none';}

async function markInstallmentPaid(id,count){
  const inst=await db.installments.get(id);
  if(!inst)return;
  inst.paidInstallments=(inst.paidInstallments||0)+count;
  await db.installments.put(inst);
  const tx={type:'expense',category:'Contas Fixas',description:`Parcela ${inst.paidInstallments}/${inst.installmentCount} - ${inst.description}`,amount:inst.installmentValue,date:todayLocal(),command:'fatura',createdAt:new Date().toISOString()};
  await db.transactions.add(tx);
  await refreshDashboard();renderChatHistory();loadInstallmentsTable();scheduleBackup();
  showNotification(`✅ Pagamento: ${inst.description} (${inst.paidInstallments}/${inst.installmentCount})`);
}

async function processCommand(text){
  const parsed=parseCommand(text);
  if(!parsed){
    addChatMessage(`Formato inválido. Use: <code>/comando valor</code>`,'msg-error');
    addChatMessage(`<span>${escapeHtml(text)}</span>`,'msg-user');
    return;
  }
  const result=await executeCommand(parsed.keyword,parsed.amount,text);
  if(!result.success){
    addChatMessage(`<strong>${result.message}</strong><br><span style="font-size:0.82rem">Crie o comando na aba Comandos</span>`,'msg-error');
    addChatMessage(`<span>${escapeHtml(text)}</span>`,'msg-user');
    return;
  }
  const{tx,balance}=result;
  addChatMessage(`<div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div class="msg-tx-header"><span>${tx.type==='income'?'📈':'📉'} <strong>${tx.type==='income'?'Receita':'Despesa'}</strong></span><span class="msg-tx-category">${tx.category}</span></div><div class="msg-tx-amount ${tx.type}">${tx.type==='income'?'+':'-'} ${formatCurrency(tx.amount)}</div><div class="msg-tx-balance">Saldo: ${formatCurrency(balance)}</div><div class="msg-tx-date">${formatDate(tx.date)}</div></div><div style="display:flex;gap:0.3rem;flex-shrink:0"><button class="btn-sm" onclick="editTransaction(${tx.id})" title="Editar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button><button class="btn-sm danger" onclick="deleteTransaction(${tx.id})" title="Excluir">✕</button></div>`,'msg-tx '+tx.type);
  addChatMessage(`<span>${escapeHtml(text)}</span>`,'msg-user');
}

function parseCommand(text){
  text=text.trim();const m=text.match(/^\/(\w+)\s+([\d.,]+)$/);
  if(!m)return null;const keyword=m[1].toLowerCase(),amount=parseFloat(m[2].replace(',','.'));
  if(isNaN(amount)||amount<=0)return null;return{keyword,amount};
}

async function executeCommand(keyword,amount,rawText){
  const cmd=await db.commands.get(keyword);
  if(!cmd)return{success:false,message:`Comando /${keyword} não encontrado.`};
  const tx={type:cmd.type,category:cmd.category,description:rawText,amount,date:todayLocal(),command:keyword,createdAt:new Date().toISOString()};
  delete tx.id;await db.transactions.add(tx);await refreshDashboard();scheduleBackup();
  const all=await db.transactions.toArray();const balance=all.reduce((s,t)=>s+(t.type==='income'?t.amount:-t.amount),0);
  return{success:true,tx,balance};
}
async function deleteTransaction(id){
  if(!confirm('Excluir esta transação?'))return;await db.transactions.delete(id);
  await refreshDashboard();renderChatHistory();scrollChatToTop();showNotification('Excluída.');scheduleBackup();
}

async function editTransaction(id){
  const tx=await db.transactions.get(id);
  if(!tx)return showNotification('Transação não encontrada.');
  $('#editTxAmount').value=tx.amount;
  $('#editTxDate').value=tx.date;
  $('#editTxType').value=tx.type;
  const cats=await db.categories.toArray();
  const sel=$('#editTxCategory');
  sel.innerHTML=cats.map(c=>`<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
  sel.value=tx.category;
  $('#editTxDesc').value=tx.description||'';
  $('#editTxForm').dataset.txId=id;
  $('#editTxModal').classList.add('show');
}

function setupEditTxForm(){
  $('#editTxForm').addEventListener('submit',async(e)=>{
    e.preventDefault();
    const id=parseInt($('#editTxForm').dataset.txId);
    if(!id)return;
    const amount=parseFloat($('#editTxAmount').value)||0;
    const category=$('#editTxCategory').value;
    const date=$('#editTxDate').value;
    const type=$('#editTxType').value;
    const desc=$('#editTxDesc').value.trim();
    if(!amount||!category||!date)return showNotification('Preencha valor, categoria e data.');
    const tx=await db.transactions.get(id);
    if(!tx)return showNotification('Transação não encontrada.');
    tx.amount=amount;tx.category=category;tx.date=date;tx.type=type;
    if(desc)tx.description=desc;
    await db.transactions.put(tx);
    closeModal('editTxModal');
    await refreshDashboard();await renderChatHistory();scrollChatToTop();showNotification('Transação atualizada!');scheduleBackup();
  });
}


async function renderChatHistory(){
  const all=await db.transactions.orderBy('date').toArray();
  const c=$('#chatMessages');c.innerHTML=`<div class="msg-system"><span>💡 Digite <strong>/entrada 500</strong> ou <strong>/saida 120</strong></span></div>`;
  let balance=0,balMap={};
  for(const t of all){balance+=t.type==='income'?t.amount:-t.amount;balMap[t.date]=balance;}
  const sorted=[...all].sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);
  for(const t of sorted){
    addChatMessage(`<div style="display:flex;justify-content:space-between;align-items:flex-start"><div><div class="msg-tx-header"><span>${t.type==='income'?'📈':'📉'} <strong>${t.type==='income'?'Receita':'Despesa'}</strong></span><span class="msg-tx-category">${t.category}</span><span style="font-size:0.72rem;color:var(--text-muted);margin-left:0.4rem">${t.command?'/'+t.command:''}</span></div><div class="msg-tx-amount ${t.type}">${t.type==='income'?'+':'-'} ${formatCurrency(t.amount)}</div><div class="msg-tx-balance">Saldo: ${formatCurrency(balMap[t.date])}</div><div class="msg-tx-date">${formatDate(t.date)}</div></div><div style="display:flex;gap:0.3rem;flex-shrink:0"><button class="btn-sm" onclick="editTransaction(${t.id})" title="Editar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button><button class="btn-sm danger" onclick="deleteTransaction(${t.id})" title="Excluir">✕</button></div>`,'msg-tx '+t.type);
  }
  scrollChatToTop();
}
function addChatMessage(html,cls){const d=document.createElement('div');d.className=cls;d.innerHTML=html;$('#chatMessages').prepend(d);}
function scrollChatToTop(){const c=$('#chatMessages');c.scrollTop=0;}

// ===== DASHBOARD =====
async function refreshDashboard(){
  const tx=await db.transactions.toArray(),cards=await db.cards.toArray(),insts=await db.installments.toArray(),debts=await db.debts.toArray();
  await renderSummaryCards(tx,cards,insts,debts);destroyAllCharts();
  await renderChartBalanceLine(tx,insts,debts);renderChartExpenseCategory(tx,insts);renderChartIncomeCategory(tx);
  renderChartMonthlyExpense(tx,insts);renderChartIncomePeriod(tx);renderChartExpensePeriod(tx);
  await renderChartFutureCommitments(insts,debts);renderChartInvestmentLine(tx);
  renderChartComparison(tx);await populateMonthFilters(tx);
  const topExpenseFilter=$('#filterTopExpense').value||'current';
  const topIncomeFilter=$('#filterTopIncome').value||'current';
  renderChartTopExpense(tx,topExpenseFilter);renderChartTopIncome(tx,topIncomeFilter);
  renderChartIndebtedness(insts,debts,cards);await renderChartCashFlow(tx,insts,debts);
}
function destroyAllCharts(){Object.values(charts).forEach(c=>c?.destroy());charts={};}
function makeChart(id,cfg){if(charts[id]){charts[id].destroy();delete charts[id];}const c=document.getElementById(id);if(!c)return null;charts[id]=new Chart(c,cfg);return charts[id];}
function barGradient(ctx,ca,t,b){if(!ca)return t;const g=ctx.createLinearGradient(0,ca.top,0,ca.bottom);g.addColorStop(0,t);g.addColorStop(1,b);return g;}
function barGradientHorizontal(ctx,ca,l,r){if(!ca)return l;const g=ctx.createLinearGradient(ca.left,0,ca.right,0);g.addColorStop(0,l);g.addColorStop(1,r);return g;}

async function renderSummaryCards(tx,cards,insts,debts){
  const income=tx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const expense=tx.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const balance=income-expense;
  const now=new Date(),thisMonth=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const monthIncome=tx.filter(t=>t.type==='income'&&t.date.startsWith(thisMonth)).reduce((s,t)=>s+t.amount,0);
  const monthExpense=tx.filter(t=>t.type==='expense'&&t.date.startsWith(thisMonth)).reduce((s,t)=>s+t.amount,0);
  const futureInstValue=insts.filter(i=>i.paidInstallments<i.installmentCount).reduce((s,i)=>s+(i.installmentCount-i.paidInstallments)*i.installmentValue,0);
  const totalDebt=debts.filter(d=>d.currentAmount>0).reduce((s,d)=>s+d.currentAmount,0);
  const overdueDebt=debts.reduce((s,d)=>s+d.currentAmount,0);
  const avgIncome=getAvgMonthly(tx,'income',3),avgExpense=getAvgMonthly(tx,'expense',3);
  const monthlyCommitments=await getFutureMonthly(insts);
  const projected=balance+avgIncome-avgExpense-(monthlyCommitments[0]||0);
  const totalLimit=cards.reduce((s,c)=>s+(c.limit||0),0);
  const allRecs=await db.recurrings.toArray();
  const allFixed=await db.fixedexpenses.toArray();
  const usedLimit=cards.reduce((s,c)=>{
    const cardInsts=insts.filter(i=>i.cardId===c.id&&i.paidInstallments<i.installmentCount);
    const instUsed=cardInsts.reduce((sum,i)=>sum+(i.installmentCount-i.paidInstallments)*i.installmentValue,0);
    const cardRecs=allRecs.filter(r=>r.cardId===c.id&&r.active);
    const recUsed=cardRecs.reduce((sum,r)=>sum+r.amount,0);
    return s+instUsed+recUsed;
  },0);
  const creditPct=totalLimit>0?Math.round(usedLimit/totalLimit*100):0;
  $('#dBalance').textContent=formatCurrency(balance);
  $('#dProjected').textContent=formatCurrency(projected);
  $('#dMonthIncome').textContent=formatCurrency(monthIncome);
  $('#dMonthExpense').textContent=formatCurrency(monthExpense);
  $('#dFutureInstallments').textContent=formatCurrency(futureInstValue);
  $('#dTotalDebt').textContent=formatCurrency(totalDebt);
  $('#dOverdueDebt').textContent=formatCurrency(overdueDebt);
  const fixedTotal=allFixed.filter(e=>e.active).reduce((s,e)=>s+e.amount,0);
  $('#dFixedExpenses').textContent=formatCurrency(fixedTotal);
  $('#dCreditUsed').textContent=creditPct+'%';

  const budgets=await db.budgets.toArray();
  const alertsEl=$('#budgetAlerts');
  if(budgets.length){
    const monthTx=tx.filter(t=>t.date.startsWith(thisMonth)&&t.type==='expense');
    const spentMap={};
    monthTx.forEach(t=>{spentMap[t.category]=(spentMap[t.category]||0)+t.amount;});
    for(const i of insts){
      if(i.paidInstallments>=i.installmentCount)continue;
      const first=new Date(i.firstInstallmentDate+'T12:00:00');
      for(let p=i.paidInstallments;p<i.installmentCount;p++){
        const d=new Date(first.getFullYear(),first.getMonth()+p,first.getDate());
        if(d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()){
          if(i.category)spentMap[i.category]=(spentMap[i.category]||0)+i.installmentValue;
          break;
        }
      }
    }
    let alertHtml='';
    for(const b of budgets){
      const spent=spentMap[b.category]||0;
      const pct=Math.round(spent/b.limit*100);
      if(pct>=80){
        const isDanger=pct>=100;
        alertHtml+=`<div class="card card-subtle" style="border-color:${isDanger?'rgba(239,68,68,0.3)':'rgba(245,158,11,0.3)'}"><span class="card-label">${isDanger?'🚨':'⚠️'} ${escapeHtml(b.category)}</span><span class="card-value" style="font-size:1.1rem;color:${isDanger?'var(--expense)':'#f59e0b'}">${formatCurrency(spent)} / ${formatCurrency(b.limit)}</span><div class="progress-bar" style="margin-top:0.3rem"><div class="progress-bar-fill ${isDanger?'progress-danger':'progress-warn'}" style="width:${Math.min(100,pct)}%"></div></div></div>`;
      }
    }
    if(alertHtml){alertsEl.innerHTML=alertHtml;alertsEl.style.display='grid';}
    else alertsEl.style.display='none';
  }else{alertsEl.style.display='none';}
}

function getAvgMonthly(tx,type,months){
  const now=new Date(),monthly={};
  for(let i=0;i<months;i++){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    monthly[key]=0;
  }
  for(const t of tx){
    if(t.type!==type)continue;
    const m=t.date.substring(0,7);
    if(monthly[m]!==undefined)monthly[m]+=t.amount;
  }
  const vals=Object.values(monthly).filter(v=>v>0);
  return vals.length?vals.reduce((s,v)=>s+v,0)/vals.length:0;
}

async function getFutureMonthly(insts){
  const now=new Date(),map={};
  for(let i=0;i<12;i++){
    const d=new Date(now.getFullYear(),now.getMonth()+i+1,1);
    map[`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`]=0;
  }
  for(const i of insts){
    if(i.paidInstallments>=i.installmentCount)continue;
    const first=new Date(i.firstInstallmentDate+'T12:00:00');
    for(let p=i.paidInstallments;p<i.installmentCount;p++){
      const d=new Date(first.getFullYear(),first.getMonth()+p,first.getDate());
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if(map[key]!==undefined)map[key]+=i.installmentValue;
    }
  }
  const all=await db.recurrings.toArray();
  for(const rec of all){
    if(!rec.active||!rec.startDate)continue;
    const recStart=rec.startDate.substring(0,7);
    for(const key of Object.keys(map)){
      if(key>=recStart)map[key]+=rec.amount;
    }
  }
  const fixedAll=await db.fixedexpenses.toArray();
  for(const f of fixedAll){
    if(!f.active)continue;
    for(const key of Object.keys(map))map[key]+=f.amount;
  }
  return Object.values(map);
}

async function renderChartBalanceLine(tx,insts,debts){
  const sorted=[...tx].sort((a,b)=>a.date.localeCompare(b.date));
  const daily={};let running=0;
  for(const t of sorted){running+=t.type==='income'?t.amount:-t.amount;daily[t.date]=running;}
  const dates=Object.keys(daily).sort(),vals=dates.map(d=>daily[d]);
  if(!dates.length){makeChart('chartBalanceLine',{type:'line',data:{labels:['Sem dados'],datasets:[{data:[0],borderColor:'rgba(255,255,255,0.08)'}]},options:{responsive:true,plugins:{legend:{display:false}}}});return;}
  const lastDate=new Date(dates[dates.length-1]+'T12:00:00'),lastVal=vals[vals.length-1];
  const avgIncome=getAvgMonthly(tx,'income',3),avgExpense=getAvgMonthly(tx,'expense',3);
  const months=await getFutureMonthly(insts);
  const projDates=[],projVals=[];
  let projBalance=lastVal;
  for(let i=1;i<=12;i++){
    const d=new Date(lastDate.getFullYear(),lastDate.getMonth()+i,1);
    projDates.push(`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`);
    projBalance+=avgIncome-avgExpense-(months[i-1]||0);
    projVals.push(projBalance);
  }
  makeChart('chartBalanceLine',{
    type:'line',
    data:{
      labels:[...dates.map(d=>formatDateShort(d)),...projDates],
      datasets:[
        {label:'Real',data:vals,borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,0.08)',fill:true,tension:0.4,pointRadius:2,borderWidth:2},
        {label:'Projetado',data:[...Array(vals.length-1).fill(null),lastVal,...projVals],borderColor:'#8b5cf6',backgroundColor:'rgba(139,92,246,0.05)',fill:true,tension:0.4,pointRadius:2,borderWidth:2,borderDash:[5,5]}
      ]
    },
    options:{responsive:true,plugins:{legend:{position:'bottom',labels:{font:{size:10}}}},scales:{y:{ticks:{callback:v=>formatCurrency(v)}}}}
  });
}

function renderChartExpenseCategory(tx,insts){
  const groups={};
  for(const t of tx.filter(t=>t.type==='expense'))groups[t.category]=(groups[t.category]||0)+t.amount;
  const now=new Date(),curYear=now.getFullYear(),curMonth=now.getMonth();
  for(const i of insts){
    if(i.paidInstallments>=i.installmentCount)continue;
    const first=new Date(i.firstInstallmentDate+'T12:00:00');
    for(let p=i.paidInstallments;p<i.installmentCount;p++){
      const due=new Date(first.getFullYear(),first.getMonth()+p,first.getDate());
      if(due.getFullYear()===curYear&&due.getMonth()===curMonth){
        groups[i.category]=(groups[i.category]||0)+i.installmentValue;
        break;
      }
    }
  }
  const labels=Object.keys(groups),data=Object.values(groups),colors=labels.map(l=>getDefaultColor(l));
  if(!labels.length){makeChart('chartExpenseCategory',{type:'doughnut',data:{labels:['Sem dados'],datasets:[{data:[1],backgroundColor:['rgba(255,255,255,0.04)'],borderWidth:0}]},options:{responsive:true,plugins:{legend:{display:false}}}});return;}
  makeChart('chartExpenseCategory',{type:'doughnut',data:{labels,datasets:[{data,backgroundColor:colors,borderWidth:2,borderColor:'#12141a'}]},options:{responsive:true,plugins:{legend:{position:'bottom',labels:{padding:10,font:{size:10}}}}}});
}

function renderChartIncomeCategory(tx){
  const groups={};tx.filter(t=>t.type==='income').forEach(t=>{groups[t.category]=(groups[t.category]||0)+t.amount;});
  const labels=Object.keys(groups),data=Object.values(groups),colors=labels.map(l=>getDefaultColor(l));
  if(!labels.length){makeChart('chartIncomeCategory',{type:'doughnut',data:{labels:['Sem dados'],datasets:[{data:[1],backgroundColor:['rgba(255,255,255,0.04)'],borderWidth:0}]},options:{responsive:true,plugins:{legend:{display:false}}}});return;}
  makeChart('chartIncomeCategory',{type:'doughnut',data:{labels,datasets:[{data,backgroundColor:colors,borderWidth:2,borderColor:'#12141a'}]},options:{responsive:true,plugins:{legend:{position:'bottom',labels:{padding:10,font:{size:10}}}}}});
}

function renderChartMonthlyExpense(tx,insts){
  const monthly={};
  for(const t of tx.filter(t=>t.type==='expense')){const m=t.date.substring(0,7);monthly[m]=(monthly[m]||0)+t.amount;}
  for(const i of insts){
    if(i.paidInstallments>=i.installmentCount)continue;
    const first=new Date(i.firstInstallmentDate+'T12:00:00');
    for(let p=i.paidInstallments;p<i.installmentCount;p++){
      const d=new Date(first.getFullYear(),first.getMonth()+p,1);
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      monthly[key]=(monthly[key]||0)+i.installmentValue;
    }
  }
  const months=Object.keys(monthly).sort().slice(-12),values=months.map(m=>monthly[m]);
  if(!months.length){makeChart('chartMonthlyExpense',{type:'bar',data:{labels:['Sem dados'],datasets:[{data:[0],backgroundColor:'rgba(255,255,255,0.04)'}]},options:{responsive:true,plugins:{legend:{display:false}}}});return;}
  makeChart('chartMonthlyExpense',{type:'bar',data:{labels:months,datasets:[{label:'Despesas',data:values,borderRadius:6,backgroundColor:ctx=>barGradient(ctx.chart.ctx,ctx.chart.chartArea,'#ef4444','rgba(239,68,68,0.2)')}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{ticks:{callback:v=>formatCurrency(v)}}}}});
}

function renderChartIncomePeriod(tx){
  const periods={};tx.filter(t=>t.type==='income').forEach(t=>{const p=t.date.substring(0,7);periods[p]=(periods[p]||0)+t.amount;});
  const labels=Object.keys(periods).sort().slice(-12),values=labels.map(l=>periods[l]);
  if(!labels.length){makeChart('chartIncomePeriod',{type:'bar',data:{labels:['Sem dados'],datasets:[{data:[0],backgroundColor:'rgba(255,255,255,0.04)'}]},options:{responsive:true,plugins:{legend:{display:false}}}});return;}
  makeChart('chartIncomePeriod',{type:'bar',data:{labels,datasets:[{label:'Entradas',data:values,borderRadius:6,backgroundColor:ctx=>barGradient(ctx.chart.ctx,ctx.chart.chartArea,'#22c55e','rgba(34,197,94,0.15)')}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{ticks:{callback:v=>formatCurrency(v)}}}}});
}

function renderChartExpensePeriod(tx){
  const periods={};tx.filter(t=>t.type==='expense').forEach(t=>{const p=t.date.substring(0,7);periods[p]=(periods[p]||0)+t.amount;});
  const labels=Object.keys(periods).sort().slice(-12),values=labels.map(l=>periods[l]);
  if(!labels.length){makeChart('chartExpensePeriod',{type:'bar',data:{labels:['Sem dados'],datasets:[{data:[0],backgroundColor:'rgba(255,255,255,0.04)'}]},options:{responsive:true,plugins:{legend:{display:false}}}});return;}
  makeChart('chartExpensePeriod',{type:'bar',data:{labels,datasets:[{label:'Saídas',data:values,borderRadius:6,backgroundColor:ctx=>barGradient(ctx.chart.ctx,ctx.chart.chartArea,'#ef4444','rgba(239,68,68,0.15)')}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{ticks:{callback:v=>formatCurrency(v)}}}}});
}

async function renderChartFutureCommitments(insts,debts){
  const now=new Date(),map={};
  for(let i=0;i<12;i++){const d=new Date(now.getFullYear(),now.getMonth()+i+1,1);map[`${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`]={installments:0,recurrings:0,fixed:0};}
  const months=Object.keys(map);
  for(const inst of insts){
    if(inst.paidInstallments>=inst.installmentCount)continue;
    const first=new Date(inst.firstInstallmentDate+'T12:00:00');
    for(let p=inst.paidInstallments;p<inst.installmentCount;p++){
      const d=new Date(first.getFullYear(),first.getMonth()+p,first.getDate());
      const key=`${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
      if(map[key])map[key].installments+=inst.installmentValue;
    }
  }
  const reccs=await db.recurrings.toArray();
  for(const rec of reccs){
    if(!rec.active||!rec.startDate)continue;
    const recStart=rec.startDate.substring(0,7);
    for(const label of months){
      const [m,y]=label.split('/');
      const key=`${y}-${m}`;
      if(key>=recStart&&map[label])map[label].recurrings+=rec.amount;
    }
  }
  const fixedAll=await db.fixedexpenses.toArray();
  for(const f of fixedAll){
    if(!f.active)continue;
    for(const label of months){
      if(map[label])map[label].fixed+=f.amount;
    }
  }
  const installVals=months.map(m=>map[m].installments),recVals=months.map(m=>map[m].recurrings),fixedVals=months.map(m=>map[m].fixed);
  makeChart('chartFutureCommitments',{
    type:'bar',data:{labels:months,datasets:[
      {label:'Parcelas',data:installVals,backgroundColor:'#8b5cf6',borderRadius:4},
      {label:'Recorrentes',data:recVals,backgroundColor:'#f59e0b',borderRadius:4},
      {label:'Contas Fixas',data:fixedVals,backgroundColor:'#22c55e',borderRadius:4}
    ]},options:{responsive:true,plugins:{legend:{position:'bottom',labels:{font:{size:10}}}},scales:{y:{ticks:{callback:v=>formatCurrency(v)}}}}
  });
}

function renderChartInvestmentLine(tx){
  const inv=tx.filter(t=>t.category==='Investimentos'),sorted=[...inv].sort((a,b)=>a.date.localeCompare(b.date));
  const daily={};let running=0;
  sorted.forEach(t=>{running+=t.type==='income'?t.amount:-t.amount;daily[t.date]=running;});
  const dates=Object.keys(daily).sort(),vals=dates.map(d=>daily[d]);
  if(!dates.length){makeChart('chartInvestmentLine',{type:'line',data:{labels:['Sem dados'],datasets:[{data:[0],borderColor:'rgba(255,255,255,0.08)'}]},options:{responsive:true,plugins:{legend:{display:false}}}});return;}
  makeChart('chartInvestmentLine',{type:'line',data:{labels:dates.map(d=>formatDateShort(d)),datasets:[{label:'Investimentos',data:vals,borderColor:'#8b5cf6',backgroundColor:'rgba(139,92,246,0.08)',fill:true,tension:0.4,pointRadius:3}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{ticks:{callback:v=>formatCurrency(v)}}}}});
}

function renderChartComparison(tx){
  const monthly={};
  tx.forEach(t=>{const m=t.date.substring(0,7);if(!monthly[m])monthly[m]={income:0,expense:0};monthly[m][t.type]+=t.amount;});
  const months=Object.keys(monthly).sort().slice(-12),incomes=months.map(m=>monthly[m].income),expenses=months.map(m=>monthly[m].expense);
  if(!months.length){makeChart('chartComparison',{type:'bar',data:{labels:['Sem dados'],datasets:[{label:'Receitas',data:[0],backgroundColor:'rgba(255,255,255,0.04)'},{label:'Despesas',data:[0],backgroundColor:'rgba(255,255,255,0.04)'}]},options:{responsive:true,plugins:{legend:{display:false}}}});return;}
  makeChart('chartComparison',{type:'bar',data:{labels:months,datasets:[{label:'Receitas',data:incomes,borderRadius:4,backgroundColor:ctx=>barGradient(ctx.chart.ctx,ctx.chart.chartArea,'#22c55e','rgba(34,197,94,0.15)')},{label:'Despesas',data:expenses,borderRadius:4,backgroundColor:ctx=>barGradient(ctx.chart.ctx,ctx.chart.chartArea,'#ef4444','rgba(239,68,68,0.15)')}]},options:{responsive:true,plugins:{legend:{position:'bottom',labels:{font:{size:10}}}},scales:{y:{ticks:{callback:v=>formatCurrency(v)}}}}});
}

function renderChartTopExpense(tx, monthFilter){
  const filtered=monthFilter==='current'?tx.filter(t=>t.type==='expense'&&t.date.startsWith(todayLocal().substring(0,7))):monthFilter==='all'?tx.filter(t=>t.type==='expense'):tx.filter(t=>t.type==='expense'&&t.date.startsWith(monthFilter));
  const groups={};filtered.forEach(t=>{groups[t.category]=(groups[t.category]||0)+t.amount;});
  const sorted=Object.entries(groups).sort((a,b)=>b[1]-a[1]);
  const labels=sorted.slice(0,8).map(e=>e[0]),values=sorted.slice(0,8).map(e=>e[1]),colors=labels.map(l=>getDefaultColor(l));
  if(!labels.length){makeChart('chartTopExpense',{type:'bar',data:{labels:['Sem dados'],datasets:[{data:[0],backgroundColor:'rgba(255,255,255,0.04)'}]},options:{responsive:true,indexAxis:'y',plugins:{legend:{display:false}}}});return;}
  makeChart('chartTopExpense',{type:'bar',data:{labels,datasets:[{data:values,borderRadius:4,backgroundColor:colors}]},options:{responsive:true,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{callback:v=>formatCurrency(v)}}}}});
}

function renderChartTopIncome(tx, monthFilter){
  const filtered=monthFilter==='current'?tx.filter(t=>t.type==='income'&&t.date.startsWith(todayLocal().substring(0,7))):monthFilter==='all'?tx.filter(t=>t.type==='income'):tx.filter(t=>t.type==='income'&&t.date.startsWith(monthFilter));
  const groups={};filtered.forEach(t=>{groups[t.category]=(groups[t.category]||0)+t.amount;});
  const sorted=Object.entries(groups).sort((a,b)=>b[1]-a[1]);
  const labels=sorted.slice(0,8).map(e=>e[0]),values=sorted.slice(0,8).map(e=>e[1]),colors=labels.map(l=>getDefaultColor(l));
  if(!labels.length){makeChart('chartTopIncome',{type:'bar',data:{labels:['Sem dados'],datasets:[{data:[0],backgroundColor:'rgba(255,255,255,0.04)'}]},options:{responsive:true,indexAxis:'y',plugins:{legend:{display:false}}}});return;}
  makeChart('chartTopIncome',{type:'bar',data:{labels,datasets:[{data:values,borderRadius:4,backgroundColor:colors}]},options:{responsive:true,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{callback:v=>formatCurrency(v)}}}}});
}

async function populateMonthFilters(tx){
  if(!tx)tx=await db.transactions.toArray();
  const months=new Set();
  tx.forEach(t=>months.add(t.date.substring(0,7)));
  const sorted=[...months].sort();
  const meses=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  ['filterTopExpense','filterTopIncome'].forEach(id=>{
    const sel=$(('#'+id));
    const cur=sel.value;
    sel.innerHTML='<option value="current">📅 Mês Atual</option><option value="all">📊 Todos</option>';
    sorted.forEach(m=>{
      const [y,mo]=m.split('-');
      const opt=document.createElement('option');
      opt.value=m;opt.textContent=meses[parseInt(mo)-1]+'/'+y;
      sel.appendChild(opt);
    });
    if(cur&&[...sel.options].some(o=>o.value===cur))sel.value=cur;
  });
}

function setupTopChartFilters(){
  ['filterTopExpense','filterTopIncome'].forEach(id=>{
    $('#'+id).addEventListener('change',async function(){
      const tx=await db.transactions.toArray();
      const filter=this.value;
      if(id==='filterTopExpense')renderChartTopExpense(tx,filter);
      else renderChartTopIncome(tx,filter);
    });
  });
}

function renderChartIndebtedness(insts,debts,cards){
  const totalInstDebt=insts.filter(i=>i.paidInstallments<i.installmentCount).reduce((s,i)=>s+(i.installmentCount-i.paidInstallments)*i.installmentValue,0);
  const totalDebt=debts.reduce((s,d)=>s+d.currentAmount,0);
  const creditUsed=cards.reduce((s,c)=>{
    const cardInsts=insts.filter(i=>i.cardId===c.id&&i.paidInstallments<i.installmentCount);
    return s+cardInsts.reduce((sum,i)=>sum+(i.installmentCount-i.paidInstallments)*i.installmentValue,0);
  },0);
  const labels=[],data=[],colors=[];
  if(totalDebt>0){labels.push('Dívidas');data.push(totalDebt);colors.push('#ef4444');}
  if(totalInstDebt>0){labels.push('Parcelas a Pagar');data.push(totalInstDebt);colors.push('#3b82f6');}
  if(creditUsed>0){labels.push('Crédito Utilizado');data.push(creditUsed);colors.push('#ec4899');}
  if(!data.length){makeChart('chartIndebtedness',{type:'doughnut',data:{labels:['Sem dívidas'],datasets:[{data:[1],backgroundColor:['rgba(255,255,255,0.04)'],borderWidth:0}]},options:{responsive:true,plugins:{legend:{display:false}}}});return;}
  makeChart('chartIndebtedness',{type:'doughnut',data:{labels,datasets:[{data,backgroundColor:colors,borderWidth:2,borderColor:'#12141a'}]},options:{responsive:true,plugins:{legend:{position:'bottom',labels:{padding:10,font:{size:10}}}}}});
}

async function renderChartCashFlow(tx,insts,debts){
  const now=new Date();
  const monthly={};
  for(let i=-3;i<12;i++){
    const d=new Date(now.getFullYear(),now.getMonth()+i,1);
    monthly[`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`]=0;
  }
  for(const t of tx){
    const m=t.date.substring(0,7);
    if(monthly[m]!==undefined)monthly[m]+=t.type==='income'?t.amount:-t.amount;
  }
  const future=await getFutureMonthly(insts);
  const months=Object.keys(monthly).sort();
  const pastMonths=months.filter(m=>m<=todayLocal().substring(0,7));
  const startBalance=pastMonths.reduce((s,m)=>s+monthly[m],0);
  let proj=startBalance;
  const projValues=[];
  for(let i=0;i<months.length;i++){
    if(months[i]>todayLocal().substring(0,7)){
      proj+=monthly[months[i]]-(future[i-(months.length-12)]||0);
    }
    projValues.push(monthly[months[i]]);
  }
  const cumulative=[];let cum=0;
  for(let i=0;i<months.length;i++){cum+=projValues[i];cumulative.push(cum);}
  const labels=months.map(m=>{const [y,mo]=m.split('-');return `${mo}/${y}`;});
  makeChart('chartCashFlow',{
    type:'bar',data:{labels,datasets:[
      {label:'Fluxo do Mês',data:projValues,borderRadius:4,backgroundColor:ctx=>{
        const v=ctx.raw||0;return v>=0?barGradient(ctx.chart.ctx,ctx.chart.chartArea,'#22c55e','rgba(34,197,94,0.15)'):barGradient(ctx.chart.ctx,ctx.chart.chartArea,'#ef4444','rgba(239,68,68,0.15)');
      }},
      {label:'Saldo Acumulado',data:cumulative,borderColor:'#3b82f6',backgroundColor:'rgba(59,130,246,0.05)',fill:true,tension:0.4,pointRadius:2,type:'line',yAxisID:'y1'}
    ]},options:{
      responsive:true,plugins:{legend:{position:'bottom',labels:{font:{size:10}}}},
      scales:{y:{ticks:{callback:v=>formatCurrency(v)}},y1:{position:'right',ticks:{callback:v=>formatCurrency(v)},grid:{display:false}}}
    }
  });
}

function setupChartGlow(){
  document.querySelectorAll('.chart-container').forEach(el=>{
    el.style.setProperty('--glow-x','50%');el.style.setProperty('--glow-y','50%');
    el.addEventListener('mousemove',e=>{
      const r=el.getBoundingClientRect();
      el.style.setProperty('--glow-x',((e.clientX-r.left)/r.width)*100+'%');
      el.style.setProperty('--glow-y',((e.clientY-r.top)/r.height)*100+'%');
    });
  });
}

// ===== COMMANDS =====
async function loadCommandsTable(){
  const cmds=await db.commands.toArray();
  const tb=$('#commandsBody'),em=$('#emptyCommands');
  if(!cmds.length){tb.innerHTML='';em.style.display='block';return;}
  em.style.display='none';
  tb.innerHTML=cmds.map(c=>`<tr><td><code>/${c.keyword}</code></td><td>${escapeHtml(c.category)}</td><td><span class="badge-${c.type}">${c.type==='income'?'Receita':'Despesa'}</span></td><td><button class="btn-sm danger" onclick="deleteCommand('${c.keyword}')">Excluir</button></td></tr>`).join('');
}
async function loadCategoriesTable(){
  const cats=await db.categories.toArray();
  const tb=$('#categoriesBody'),em=$('#emptyCategories');
  if(!cats.length){tb.innerHTML='';em.style.display='block';return;}
  em.style.display='none';
  tb.innerHTML=cats.map(c=>`<tr><td><span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:${c.color||getDefaultColor(c.name)};border:2px solid rgba(255,255,255,0.08)"></span></td><td>${escapeHtml(c.name)}</td><td><span class="badge-${c.type}">${c.type==='income'?'Receita':'Despesa'}</span></td><td><button class="btn-sm" onclick="editCategory('${escapeHtml(c.name)}')">Editar</button><button class="btn-sm danger" onclick="deleteCategory('${escapeHtml(c.name)}')">Excluir</button></td></tr>`).join('');
}
async function loadCategoriesSelect(){
  const cats=await db.categories.toArray();
  const opts=cats.map(c=>`<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
  $$('#cmdCategory, #instCategory, #recCategory, #fixedCategory').forEach(sel=>{
    sel.innerHTML=opts;
  });
  const expenseOpts=cats.filter(c=>c.type==='expense').map(c=>`<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
  const bs=$('#budgetCategory');
  if(bs)bs.innerHTML=expenseOpts;
}

function setupCommandForm(){
  $('#commandForm').addEventListener('submit',async(e)=>{
    e.preventDefault();
    const keyword=$('#cmdKeyword').value.trim().toLowerCase().replace(/^\//,'');
    const category=$('#cmdCategory').value,cat=await db.categories.get(category);
    if(!cat)return showNotification('Categoria inválida.');
    if(!keyword)return showNotification('Digite um comando.');
    if(await db.commands.get(keyword))return showNotification(`/${keyword} já existe.`);
    await db.commands.add({keyword,category,type:cat.type});
    $('#cmdKeyword').value='';await loadCommandsTable();showNotification(`/${keyword} criado!`);scheduleBackup();
  });
}
async function deleteCommand(k){if(!confirm(`Excluir /${k}?`))return;await db.commands.delete(k);await loadCommandsTable();showNotification('Excluído.');scheduleBackup();}

function setupCategoryForm(){
  const ct=$('#catType'),cc=$('#catColor');
  ct.addEventListener('change',()=>{cc.value=ct.value==='income'?'#22c55e':'#ef4444';});
  $('#categoryForm').addEventListener('submit',async(e)=>{
    e.preventDefault();
    const name=$('#catName').value.trim(),type=ct.value,color=cc.value;
    if(!name){if(editingCategory){editingCategory=null;document.querySelector('#categoryForm .btn-primary').textContent='Criar';}return showNotification('Digite um nome.');}
    if(editingCategory){
      const old=editingCategory,oldCat=await db.categories.get(old);
      if(!oldCat)return showNotification('Não encontrada.');
      if(name!==old&&await db.categories.get(name))return showNotification(`"${name}" já existe.`);
      await db.categories.put({name,type,color});
      if(name!==old){
        await db.categories.delete(old);
        for(const cmd of await db.commands.where('category').equals(old).toArray()){await db.commands.put({...cmd,category:name});}
        for(const tx of await db.transactions.where('category').equals(old).toArray()){await db.transactions.put({...tx,category:name});}
      }
      editingCategory=null;document.querySelector('#categoryForm .btn-primary').textContent='Criar';showNotification('Categoria atualizada!');scheduleBackup();
    }else{
      if(await db.categories.get(name))return showNotification(`"${name}" já existe.`);
      await db.categories.add({name,type,color});
      const kw=name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      await db.commands.add({keyword:kw,category:name,type});
      showNotification(`Categoria "${name}" criada!`);scheduleBackup();
    }
    $('#catName').value='';cc.value=type==='income'?'#22c55e':'#ef4444';ct.value='income';
    await loadCategoriesTable();await loadCommandsTable();await loadCategoriesSelect();await refreshDashboard();
  });
}
async function editCategory(name){
  const c=await db.categories.get(name);if(!c)return;
  editingCategory=name;$('#catName').value=c.name;$('#catType').value=c.type;$('#catColor').value=c.color||getDefaultColor(c.name);
  $('#catName').focus();document.querySelector('#categoryForm .btn-primary').textContent='Salvar';
}
async function deleteCategory(name){
  if(!confirm(`Excluir "${name}"?`))return;
  await db.categories.delete(name);
  for(const cmd of await db.commands.where('category').equals(name).toArray())await db.commands.delete(cmd.keyword);
  await loadCategoriesTable();await loadCommandsTable();await loadCategoriesSelect();showNotification('Excluída.');scheduleBackup();
}

// ===== CARDS =====
let editingCard=null;
function setupCardForm(){
  $('#cardForm').addEventListener('submit',async(e)=>{
    e.preventDefault();
    const name=$('#cardName').value.trim(),bank=$('#cardBank').value.trim();
    const limit=parseFloat($('#cardLimit').value)||0,closeDay=parseInt($('#cardCloseDay').value)||1,dueDay=parseInt($('#cardDueDay').value)||1;
    const color=$('#cardColor').value;
    if(!name)return showNotification('Digite o nome.');
    if(editingCard){
      const old=await db.cards.get(editingCard);
      await db.cards.put({id:editingCard,name,bank,limit,availableLimit:old?.availableLimit??limit,closingDay:closeDay,dueDay,color});
      editingCard=null;document.querySelector('#cardForm .btn-primary').textContent='Criar';showNotification('Cartão atualizado!');scheduleBackup();
    }else{
      await db.cards.add({name,bank,limit,availableLimit:limit,closingDay:closeDay,dueDay,color});
      showNotification(`Cartão "${name}" criado!`);scheduleBackup();
    }
    $('#cardName').value='';$('#cardBank').value='';$('#cardLimit').value='';$('#cardCloseDay').value='';$('#cardDueDay').value='';
    await loadCardsTable();await loadCardSelect();
  });
}
async function loadCardsTable(){
  const cards=await db.cards.toArray(),tb=$('#cardsBody'),em=$('#emptyCards');
  const insts=await db.installments.toArray();
  const recs=await db.recurrings.toArray();
  if(!cards.length){tb.innerHTML='';em.style.display='block';return;}
  em.style.display='none';
  const rows=[];
  for(const c of cards){
    const dueCount=(await getCardPendingMonths(c.id)).length;
    const badge=dueCount?`<span class="badge-expense">${dueCount} mês${dueCount>1?'es':''}</span>`:'<span class="badge-income">Em dia</span>';
    const cardInsts=insts.filter(i=>i.cardId===c.id&&i.paidInstallments<i.installmentCount);
    const instUsed=cardInsts.reduce((s,i)=>s+(i.installmentCount-i.paidInstallments)*i.installmentValue,0);
    const cardRecs=recs.filter(r=>r.cardId===c.id&&r.active);
    const recUsed=cardRecs.reduce((s,r)=>s+r.amount,0);
    const used=instUsed+recUsed;
    const avail=(c.limit||0)-used;
    rows.push(`<tr><td><span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:${c.color||'#3b82f6'};border:2px solid rgba(255,255,255,0.08)"></span></td><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.bank||'-')}</td><td>${formatCurrency(c.limit||0)}</td><td>${formatCurrency(Math.max(0,avail))}</td><td>${c.closingDay||'-'}</td><td>${c.dueDay||'-'}</td><td>${badge}</td><td><button class="btn-sm" onclick="openInvoiceModal(${c.id})">Ver Fatura</button><button class="btn-sm" onclick="editCard(${c.id})">Editar</button><button class="btn-sm danger" onclick="deleteCard(${c.id})">Excluir</button></td></tr>`);
  }
  tb.innerHTML=rows.join('');
}
async function loadCardSelect(){
  const cards=await db.cards.toArray();
  const opts='<option value="">Selecione</option>'+cards.map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  $('#instCard').innerHTML=opts;
  const rc=$('#recCard');if(rc)rc.innerHTML=opts;
}
async function editCard(id){
  const c=await db.cards.get(id);if(!c)return;
  editingCard=id;$('#cardName').value=c.name;$('#cardBank').value=c.bank||'';$('#cardLimit').value=c.limit||'';
  $('#cardCloseDay').value=c.closingDay||'';$('#cardDueDay').value=c.dueDay||'';$('#cardColor').value=c.color||'#3b82f6';
  $('#cardName').focus();document.querySelector('#cardForm .btn-primary').textContent='Salvar';
}
async function deleteCard(id){
  if(!confirm('Excluir cartão?'))return;
  const insts=await db.installments.where('cardId').equals(id).toArray();
  for(const i of insts)await db.installments.delete(i.id);
  const recs=await db.recurrings.where('cardId').equals(id).toArray();
  for(const r of recs)await db.recurrings.delete(r.id);
  await db.cards.delete(id);await loadCardsTable();await loadCardSelect();await loadRecurringsTable();showNotification('Cartão excluído.');scheduleBackup();
}

// ===== INVOICE MODAL =====
async function getCardPendingMonths(cardId){
  const months=await getCardInvoiceMonths(cardId);
  return months.filter(m=>!m.allPaid).map(m=>m.monthKey).sort();
}
function toMonthKey(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function generateMonthKeys(fromKey,toKey){
  const keys=[];
  const [sy,sm]=fromKey.split('-').map(Number);
  const [ey,em]=toKey.split('-').map(Number);
  let d=new Date(sy,sm-1,1);
  const end=new Date(ey,em-1,1);
  while(d<=end){keys.push(toMonthKey(d));d.setMonth(d.getMonth()+1);}
  return keys;
}
async function getCardInvoiceMonths(cardId){
  const insts=await db.installments.where('cardId').equals(cardId).toArray();
  const allRecs=await db.recurrings.where('cardId').equals(cardId).toArray();
  const recs=allRecs.filter(r=>r.active);
  const payments=await db.invoicepayments.where('cardId').equals(cardId).toArray();
  const paidMonths=new Set(payments.map(p=>p.monthKey));
  const months={};
  let minKey=null,maxKey=null;
  const now=new Date();
  const futureEnd=new Date(now.getFullYear(),now.getMonth()+12,1);
  const hasRecs=recs.length>0;
  for(const inst of insts){
    if(inst.paidInstallments>=inst.installmentCount&&inst.installmentCount>0)continue;
    const first=new Date(inst.firstInstallmentDate+'T12:00:00');
    for(let p=0;p<inst.installmentCount;p++){
      const due=new Date(first.getFullYear(),first.getMonth()+p,first.getDate());
      const key=toMonthKey(due);
      if(!months[key])months[key]={monthKey:key,total:0,items:[],allPaid:true};
      months[key].items.push({
        type:'installment',
        installmentId:inst.id,
        description:inst.description,
        detail:`${p+1}/${inst.installmentCount}`,
        value:inst.installmentValue,
        paid:paidMonths.has(key)
      });
      months[key].total+=inst.installmentValue;
      if(!paidMonths.has(key))months[key].allPaid=false;
      if(!minKey||key<minKey)minKey=key;
      if(!maxKey||key>maxKey)maxKey=key;
    }
  }
  if(hasRecs){
    if(!minKey)minKey=toMonthKey(now);
    const futureKey=toMonthKey(futureEnd);
    if(!maxKey||futureKey>maxKey)maxKey=futureKey;
    const range=generateMonthKeys(minKey,maxKey);
    for(const key of range){
      if(!months[key])months[key]={monthKey:key,total:0,items:[],allPaid:true};
      for(const rec of recs){
        if(rec.startDate&&key<rec.startDate.substring(0,7))continue;
        months[key].items.push({
          type:'recurring',
          recurringId:rec.id,
          description:rec.name,
          detail:'🔄 mensal',
          value:rec.amount,
          paid:paidMonths.has(key)
        });
        months[key].total+=rec.amount;
        if(!paidMonths.has(key))months[key].allPaid=false;
      }
    }
  }
  return Object.values(months).sort((a,b)=>a.monthKey.localeCompare(b.monthKey));
}
async function openInvoiceModal(cardId){
  const card=await db.cards.get(cardId);
  if(!card)return showNotification('Cartão não encontrado.');
  $('#invoiceCardName').textContent=card.name;
  let info=`<span>${card.bank?escapeHtml(card.bank)+' · ':''}Limite: ${formatCurrency(card.limit||0)} · Disponível: ${formatCurrency(card.availableLimit||0)}</span>`;
  $('#invoiceCardInfo').innerHTML=info;
  await renderInvoiceModal(cardId);
  $('#invoiceModal').classList.add('show');
}
function closeInvoiceModal(){
  $('#invoiceModal').classList.remove('show');
}
async function renderInvoiceModal(cardId){
  const months=await getCardInvoiceMonths(cardId);
  const body=$('#invoiceModalBody');
  if(!months.length){body.innerHTML='<p class="empty-state">Nenhuma fatura encontrada para este cartão.</p>';return;}
  const now=new Date();
  let html='';
  for(const m of months){
    const [year,monthNum]=m.monthKey.split('-');
    const monthDate=new Date(parseInt(year),parseInt(monthNum)-1,1);
    const monthLabel=`${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][monthDate.getMonth()]}/${year}`;
    const monthEnd=new Date(parseInt(year),parseInt(monthNum),0);
    const isPast=monthEnd<now;
    let statusClass,statusLabel;
    if(m.allPaid){statusClass='paid';statusLabel='✅ Pago';}
    else if(isPast){statusClass='overdue';statusLabel='🔴 Atrasado';}
    else{statusClass='pending';statusLabel='⏳ Pendente';}
    html+=`<div class="invoice-month ${m.allPaid?'paid':''}">
      <div class="invoice-month-header">
        <span class="invoice-month-label">📆 ${monthLabel}</span>
        <span class="invoice-month-total">${formatCurrency(m.total)}</span>
      </div>
      <div class="invoice-month-items">`;
    for(const item of m.items){
      html+=`<div class="invoice-item ${item.paid?'paid':''}">
        <span>${item.paid?'✅':'●'} ${escapeHtml(item.description)}</span>
        <span>${item.detail||''}</span>
        <span>${formatCurrency(item.value)}</span>
      </div>`;
    }
    html+=`</div>
      <div class="invoice-month-footer">
        <span class="invoice-status ${statusClass}">${statusLabel}</span>
        <button class="btn-${m.allPaid?'secondary':'primary'}" onclick="toggleInvoiceMonth(${cardId},'${m.monthKey}')">${m.allPaid?'Desmarcar Pagamento':'Pagar Fatura'}</button>
      </div>
    </div>`;
  }
  body.innerHTML=html;
}
async function toggleInvoiceMonth(cardId,monthKey){
  const card=await db.cards.get(cardId);
  if(!card)return;
  const existing=await db.invoicepayments.where({cardId,monthKey}).first();
  if(existing){
    if(!confirm(`Desmarcar pagamento de "${card.name}" para ${monthKey.replace('-','/')}?\n\nAs transações serão removidas do chat e o saldo será restituído.`))return;
    const months=await getCardInvoiceMonths(cardId);
    const month=months.find(m=>m.monthKey===monthKey);
    if(month){
      for(const item of month.items){
        if(!item.paid)continue;
        if(item.type==='installment'){
          const inst=await db.installments.get(item.installmentId);
          if(inst&&inst.paidInstallments>0){
            inst.paidInstallments--;
            await db.installments.put(inst);
          }
        }
      }
    }
    await db.transactions.where('invoicePaymentId').equals(existing.id).delete();
    await db.invoicepayments.delete(existing.id);
    await loadInstallmentsTable();
    await renderInvoiceModal(cardId);
    await loadCardsTable();
    await refreshDashboard();
    await renderChatHistory();
    scrollChatToTop();
    showNotification(`Pagamento de ${monthKey.replace('-','/')} desmarcado.`);scheduleBackup();
    return;
  }
  const months=await getCardInvoiceMonths(cardId);
  const month=months.find(m=>m.monthKey===monthKey);
  if(!month)return;
  const totalUnpaid=month.items.filter(i=>!i.paid).reduce((s,i)=>s+i.value,0);
  if(!confirm(`Pagar fatura de "${card.name}" para ${monthKey.replace('-','/')}? Total: ${formatCurrency(totalUnpaid)}`))return;
  const ipId=await db.invoicepayments.add({cardId,monthKey,createdAt:new Date().toISOString()});
  let paidCount=0;
  for(const item of month.items){
    if(item.paid)continue;
    if(item.type==='installment'){
      const inst=await db.installments.get(item.installmentId);
      if(!inst||inst.paidInstallments>=inst.installmentCount)continue;
      inst.paidInstallments=(inst.paidInstallments||0)+1;
      await db.installments.put(inst);
      const tx={type:'expense',category:inst.category||'Contas Fixas',description:`Fatura ${card.name} - ${inst.description} (${inst.paidInstallments}/${inst.installmentCount})`,amount:item.value,date:todayLocal(),command:'fatura',invoicePaymentId:ipId,createdAt:new Date().toISOString()};
      await db.transactions.add(tx);
      paidCount++;
    }else if(item.type==='recurring'){
      const rec=await db.recurrings.get(item.recurringId);
      if(!rec)continue;
      const tx={type:'expense',category:rec.category||'Contas Fixas',description:`Fatura ${card.name} - ${rec.name}`,amount:item.value,date:todayLocal(),command:'fatura',invoicePaymentId:ipId,createdAt:new Date().toISOString()};
      await db.transactions.add(tx);
      paidCount++;
    }
  }
  await loadInstallmentsTable();
  await renderInvoiceModal(cardId);
  await loadCardsTable();
  await refreshDashboard();
  await renderChatHistory();
  scrollChatToTop();
  showNotification(`✅ Fatura de ${card.name} (${monthKey.replace('-','/')}) paga: ${formatCurrency(totalUnpaid)} (${paidCount} item${paidCount>1?'s':''})`);scheduleBackup();
}

// ===== INSTALLMENTS =====
let editingInstallment=null;
function setupInstallmentForm(){
  $('#instTotal').addEventListener('input',calcInstallmentValue);
  $('#instCount').addEventListener('input',calcInstallmentValue);
  function calcInstallmentValue(){
    const total=parseFloat($('#instTotal').value)||0,count=parseInt($('#instCount').value)||1;
    $('#instValue').value=count>0?(total/count).toFixed(2):'';
  }
  $('#installmentForm').addEventListener('submit',async(e)=>{
    e.preventDefault();
    const description=$('#instDesc').value.trim(),totalAmount=parseFloat($('#instTotal').value)||0;
    const installmentCount=parseInt($('#instCount').value)||1,installmentValue=parseFloat($('#instValue').value)||0;
    const purchaseDate=$('#instDate').value,firstInstallmentDate=$('#instFirstDate').value;
    const cardId=parseInt($('#instCard').value)||null,category=$('#instCategory').value,notes=$('#instNotes').value.trim();
    if(!description||!totalAmount||!installmentCount||!purchaseDate||!firstInstallmentDate)return showNotification('Preencha os campos obrigatórios.');
    if(editingInstallment){
      const existing=await db.installments.get(editingInstallment);
      if(existing){
        const paid=existing.paidInstallments||0;
        await db.installments.put({id:editingInstallment,description,totalAmount,installmentCount,installmentValue,purchaseDate,firstInstallmentDate,cardId,category,notes,paidInstallments:paid});
      }
      editingInstallment=null;
      $('#instSubmitBtn').textContent='Adicionar Compra';
      $('#instCancelBtn').style.display='none';
      showNotification('Compra atualizada!');scheduleBackup();
    }else{
      await db.installments.add({description,totalAmount,installmentCount,installmentValue,purchaseDate,firstInstallmentDate,cardId,category,notes,paidInstallments:0});
      showNotification('Compra parcelada adicionada!');scheduleBackup();
    }
    $('#installmentForm').reset();
    $('#instDate').value='';$('#instFirstDate').value='';$('#instValue').value='';
    await loadInstallmentsTable();await refreshDashboard();
  });
}
async function loadInstallmentsTable(){
  const insts=await db.installments.toArray(),cards=await db.cards.toArray();
  const tb=$('#installmentsBody'),em=$('#emptyInstallments');
  if(!insts.length){tb.innerHTML='';em.style.display='block';return;}
  em.style.display='none';
  tb.innerHTML=insts.map(i=>{
    const card=cards.find(c=>c.id===i.cardId);
    const remaining=i.installmentCount-(i.paidInstallments||0);
    const restante=remaining*i.installmentValue;
    return `<tr><td>${escapeHtml(i.description)}</td><td>${formatCurrency(i.totalAmount)}</td><td>${i.installmentCount}x</td><td>${formatCurrency(i.installmentValue)}</td><td>${i.paidInstallments||0}/${i.installmentCount}</td><td>${card?escapeHtml(card.name):'-'}</td><td>${escapeHtml(i.category||'-')}</td><td>${remaining}</td><td>${formatCurrency(restante)}</td><td><button class="btn-sm" onclick="markInstallmentPaid(${i.id},1)">Pagar</button><button class="btn-sm" onclick="editInstallment(${i.id})">Editar</button><button class="btn-sm danger" onclick="deleteInstallment(${i.id})">Excluir</button></td></tr>`;
  }).join('');
}
async function editInstallment(id){
  const i=await db.installments.get(id);if(!i)return;
  editingInstallment=id;
  $('#instDesc').value=i.description;
  $('#instTotal').value=i.totalAmount;
  $('#instCount').value=i.installmentCount;
  $('#instValue').value=i.installmentValue;
  $('#instDate').value=i.purchaseDate;
  $('#instFirstDate').value=i.firstInstallmentDate;
  $('#instCard').value=i.cardId||'';
  $('#instCategory').value=i.category||'';
  $('#instNotes').value=i.notes||'';
  $('#instSubmitBtn').textContent='Salvar';
  $('#instCancelBtn').style.display='inline-block';
  $('#instDesc').focus();
  window.scrollTo({top:document.querySelector('.panel h2').offsetTop-80,behavior:'smooth'});
}
function cancelEditInstallment(){
  editingInstallment=null;
  $('#installmentForm').reset();
  $('#instDate').value='';$('#instFirstDate').value='';$('#instValue').value='';
  $('#instSubmitBtn').textContent='Adicionar Compra';
  $('#instCancelBtn').style.display='none';
}
async function deleteInstallment(id){
  if(!confirm('Excluir esta compra?'))return;await db.installments.delete(id);
  await loadInstallmentsTable();await refreshDashboard();showNotification('Excluída.');scheduleBackup();
}

// ===== DEBTS =====
let editingDebt=null;
function setupDebtForm(){
  $('#debtForm').addEventListener('submit',async(e)=>{
    e.preventDefault();
    const name=$('#debtName').value.trim(),creditor=$('#debtCreditor').value.trim();
    const originalAmount=parseFloat($('#debtOriginal').value)||0,currentAmount=parseFloat($('#debtCurrent').value)||0;
    const notes=$('#debtNotes').value.trim();
    if(!name||!originalAmount||!currentAmount)return showNotification('Preencha campos obrigatórios.');
    if(editingDebt){
      await db.debts.put({id:editingDebt,name,creditor,originalAmount,currentAmount,notes});
      editingDebt=null;document.querySelector('#debtForm .btn-primary').textContent='Adicionar Dívida';showNotification('Dívida atualizada!');scheduleBackup();
    }else{
      await db.debts.add({name,creditor,originalAmount,currentAmount,notes});
      showNotification('Dívida adicionada!');scheduleBackup();
    }
    $('#debtForm').reset();
    await loadDebtsTable();await refreshDashboard();
  });
}
async function loadDebtsTable(){
  const debts=await db.debts.toArray(),tb=$('#debtsBody'),em=$('#emptyDebts');
  if(!debts.length){tb.innerHTML='';em.style.display='block';return;}
  em.style.display='none';
  tb.innerHTML=debts.map(d=>`<tr><td>${escapeHtml(d.name)}</td><td>${escapeHtml(d.creditor||'-')}</td><td>${formatCurrency(d.originalAmount)}</td><td>${formatCurrency(d.currentAmount)}</td><td><button class="btn-sm" onclick="payDebt(${d.id})">Pagar</button><button class="btn-sm" onclick="editDebt(${d.id})">Editar</button><button class="btn-sm danger" onclick="deleteDebt(${d.id})">Excluir</button></td></tr>`).join('');
}
async function editDebt(id){
  const d=await db.debts.get(id);if(!d)return;
  editingDebt=id;$('#debtName').value=d.name;$('#debtCreditor').value=d.creditor||'';
  $('#debtOriginal').value=d.originalAmount;$('#debtCurrent').value=d.currentAmount;
  $('#debtNotes').value=d.notes||'';
  $('#debtName').focus();document.querySelector('#debtForm .btn-primary').textContent='Salvar';
}
async function deleteDebt(id){
  if(!confirm('Excluir dívida?'))return;
  await db.debts.delete(id);await loadDebtsTable();await refreshDashboard();showNotification('Excluída.');scheduleBackup();
}

async function payDebt(id){
  const debt=await db.debts.get(id);if(!debt)return;
  const maxStr=debt.currentAmount.toFixed(2);
  const amountStr=prompt(`Valor a pagar para "${debt.name}" (máx: R$ ${maxStr}):`,maxStr);
  if(!amountStr)return;
  const amount=parseFloat(amountStr.replace(',','.'));
  if(isNaN(amount)||amount<=0)return showNotification('Valor inválido.');
  if(amount>debt.currentAmount)return showNotification('Valor maior que o devido.');
  await db.debtpayments.add({debtId:id,amount,date:todayLocal(),createdAt:new Date().toISOString()});
  debt.currentAmount-=amount;
  const quitou=debt.currentAmount<=0;
  if(quitou){debt.currentAmount=0;}
  await db.debts.put(debt);
  const tx={type:'expense',category:'Dívidas',description:`Pagamento dívida: ${debt.name}${quitou?' (quitada)':''}`,amount,date:todayLocal(),command:'divida',createdAt:new Date().toISOString()};
  await db.transactions.add(tx);
  await loadDebtsTable();await loadDebtPaymentsTable();await refreshDashboard();await renderChatHistory();scrollChatToTop();scheduleBackup();
  showNotification(`Pagamento de ${formatCurrency(amount)} registrado!`);
}
async function loadDebtPaymentsTable(){
  const payments=await db.debtpayments.toArray(),debts=await db.debts.toArray();
  payments.sort((a,b)=>b.date.localeCompare(a.date)||(b.id-a.id));
  const tb=$('#debtPaymentsBody'),em=$('#emptyDebtPayments');
  if(!payments.length){tb.innerHTML='';em.style.display='block';return;}
  em.style.display='none';
  tb.innerHTML=payments.map(p=>{
    const debt=debts.find(d=>d.id===p.debtId);
    return `<tr><td>${debt?escapeHtml(debt.name):'?'}</td><td>${formatDate(p.date)}</td><td>${formatCurrency(p.amount)}</td></tr>`;
  }).join('');
}

// ===== RECURRINGS =====
function setupRecurringForm(){
  $('#recStartDate').value=todayLocal();
  $('#recurringForm').addEventListener('submit',async(e)=>{
    e.preventDefault();
    const name=$('#recName').value.trim(),amount=parseFloat($('#recAmount').value)||0;
    const cardId=parseInt($('#recCard').value)||null,category=$('#recCategory').value;
    const startDate=$('#recStartDate').value,active=$('#recActive').checked;
    if(!name||!amount||!startDate)return showNotification('Preencha nome, valor e data.');
    await db.recurrings.add({name,amount,cardId,category,startDate,active,createdAt:new Date().toISOString()});
    $('#recurringForm').reset();$('#recStartDate').value=todayLocal();$('#recActive').checked=true;
    await loadRecurringsTable();showNotification(`"${name}" adicionado!`);scheduleBackup();
  });
}
async function loadRecurringsTable(){
  const recs=await db.recurrings.toArray(),cards=await db.cards.toArray();
  const tb=$('#recBody'),em=$('#emptyRec');
  if(!recs.length){tb.innerHTML='';em.style.display='block';return;}
  em.style.display='none';
  tb.innerHTML=recs.map(r=>{
    const card=cards.find(c=>c.id===r.cardId);
    const statusLabel=r.active?'Ativo':'Pausado';
    const statusBadge=r.active?'badge-income':'badge-warning';
    return `<tr><td>${escapeHtml(r.name)}</td><td>${formatCurrency(r.amount)}</td><td>${card?escapeHtml(card.name):'-'}</td><td>${escapeHtml(r.category)}</td><td><span class="${statusBadge}">${statusLabel}</span></td><td><button class="btn-sm" onclick="toggleRecurring(${r.id})">${r.active?'Pausar':'Ativar'}</button><button class="btn-sm danger" onclick="deleteRecurring(${r.id})">Excluir</button></td></tr>`;
  }).join('');
}
async function toggleRecurring(id){
  const r=await db.recurrings.get(id);if(!r)return;
  r.active=!r.active;await db.recurrings.put(r);
  await loadRecurringsTable();showNotification(r.active?'Ativado.':'Pausado.');scheduleBackup();
}
async function deleteRecurring(id){
  if(!confirm('Excluir compra recorrente?'))return;
  await db.recurrings.delete(id);await loadRecurringsTable();showNotification('Excluída.');scheduleBackup();
}

// ===== FIXED EXPENSES =====
function setupFixedForm(){
  $('#fixedForm').addEventListener('submit',async(e)=>{
    e.preventDefault();
    const name=$('#fixedName').value.trim(),amount=parseFloat($('#fixedAmount').value)||0;
    const dueDay=parseInt($('#fixedDueDay').value)||null,category=$('#fixedCategory').value;
    const active=$('#fixedActive').checked;
    if(!name||!amount)return showNotification('Preencha nome e valor.');
    await db.fixedexpenses.add({name,amount,dueDay,category,active,createdAt:new Date().toISOString()});
    $('#fixedForm').reset();$('#fixedActive').checked=true;
    await loadFixedTable();showNotification(`"${name}" adicionado!`);scheduleBackup();
  });
}
async function loadFixedTable(){
  const exps=await db.fixedexpenses.toArray(),tb=$('#fixedBody'),em=$('#emptyFixed');
  if(!exps.length){tb.innerHTML='';em.style.display='block';return;}
  em.style.display='none';
  tb.innerHTML=exps.map(e=>`<tr><td>${escapeHtml(e.name)}</td><td>${formatCurrency(e.amount)}</td><td>${e.dueDay?'Dia '+e.dueDay:'-'}</td><td>${escapeHtml(e.category)}</td><td><span class="${e.active?'badge-income':'badge-warning'}">${e.active?'Ativo':'Pausado'}</span></td><td><button class="btn-sm" onclick="toggleFixed(${e.id})">${e.active?'Pausar':'Ativar'}</button><button class="btn-sm danger" onclick="deleteFixed(${e.id})">Excluir</button></td></tr>`).join('');
}
async function toggleFixed(id){
  const e=await db.fixedexpenses.get(id);if(!e)return;
  e.active=!e.active;await db.fixedexpenses.put(e);
  await loadFixedTable();showNotification(e.active?'Ativado.':'Pausado.');scheduleBackup();
}
async function deleteFixed(id){
  if(!confirm('Excluir conta fixa?'))return;
  await db.fixedexpenses.delete(id);await loadFixedTable();showNotification('Excluída.');scheduleBackup();
}

// ===== MODAL FIXED =====
async function openFixedModal(monthKey){
  const now=new Date();
  if(!monthKey)monthKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const [y,m]=monthKey.split('-').map(Number);
  const currentDate=new Date(y,m-1,1);
  const meses=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const monthLabel=`${meses[currentDate.getMonth()]}/${y}`;
  $('#fixedModalMonth').textContent=monthLabel;

  const exps=await db.fixedexpenses.toArray();
  const active=exps.filter(e=>e.active);
  if(!active.length){
    renderFixedNav(monthKey);
    $('#fixedModalInfo').innerHTML='<span style="color:var(--text-muted);font-size:0.82rem">Nenhuma conta fixa ativa.</span>';
    $('#fixedModalBody').innerHTML='<p class="empty-state">Ative contas no painel Contas Fixas.</p>';
    $('#fixedModal').classList.add('show');return;
  }

  const payments=await db.fixedpayments.where('monthKey').equals(monthKey).toArray();
  const paidIds=new Set(payments.map(p=>p.expenseId));
  const total=active.reduce((s,e)=>s+e.amount,0);
  const paidTotal=active.filter(e=>paidIds.has(e.id)).reduce((s,e)=>s+e.amount,0);
  const allPaid=active.every(e=>paidIds.has(e.id));

  renderFixedNav(monthKey);
  $('#fixedModalInfo').innerHTML=`<span style="font-size:0.82rem;color:var(--text-secondary)">Pago: ${formatCurrency(paidTotal)} de ${formatCurrency(total)} · ${paidIds.size}/${active.length} conta${active.length>1?'s':''}</span>`;

  let html='';
  for(const e of active){
    const paid=paidIds.has(e.id);
    html+=`<div class="invoice-month ${paid?'paid':''}">
      <div class="invoice-month-header">
        <span class="invoice-month-label">${escapeHtml(e.name)}</span>
        <span class="invoice-month-total">${formatCurrency(e.amount)}</span>
      </div>
      <div class="invoice-month-footer">
        <span style="font-size:0.82rem;color:var(--text-secondary)">${e.dueDay?'Vencimento dia '+e.dueDay:'Sem vencimento'} · ${escapeHtml(e.category)}</span>
        <button class="btn-sm ${paid?'danger':'primary'}" onclick="toggleFixedExpense(${e.id},'${monthKey}')">${paid?'✕ Desmarcar':'✅ Pagar'}</button>
      </div>
    </div>`;
  }
  html+=`<div style="margin-top:1rem;text-align:center">
    <button class="btn-${allPaid?'secondary':'primary'}" onclick="toggleAllFixed('${monthKey}')" style="width:100%">${allPaid?'Desmarcar Todas do Mês':'Pagar Todas do Mês'}</button>
  </div>`;
  $('#fixedModalBody').innerHTML=html;
  $('#fixedModal').classList.add('show');
}
function renderFixedNav(monthKey){
  const [y,m]=monthKey.split('-').map(Number);
  const prev=new Date(y,m-2,1);
  const next=new Date(y,m,1);
  const prevKey=`${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}`;
  const nextKey=`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}`;
  $('#fixedModalMonth').innerHTML=`<button class="btn-sm" onclick="openFixedModal('${prevKey}')">◀</button> ${$('#fixedModalMonth').textContent} <button class="btn-sm" onclick="openFixedModal('${nextKey}')">▶</button>`;
}
async function toggleFixedExpense(expenseId,monthKey){
  const exp=await db.fixedexpenses.get(expenseId);
  if(!exp)return;
  const existing=await db.fixedpayments.where({expenseId,monthKey}).first();
  if(existing){
    await db.fixedpayments.delete(existing.id);
    const txs=await db.transactions.filter(t=>t.fixedExpenseId===expenseId&&t.fixedMonthKey===monthKey).toArray();
    for(const t of txs)await db.transactions.delete(t.id);
    await openFixedModal(monthKey);
    await refreshDashboard();await renderChatHistory();scrollChatToTop();scheduleBackup();
    showNotification(`"${exp.name}" desmarcado.`);
  }else{
    if(!confirm(`Pagar "${exp.name}" (${formatCurrency(exp.amount)}) referente a ${monthKey.replace('-','/')}?`))return;
    await db.fixedpayments.add({expenseId,monthKey,createdAt:new Date().toISOString()});
    const tx={type:'expense',category:exp.category||'Contas Fixas',description:`${exp.name} (${monthKey.replace('-','/')})`,amount:exp.amount,date:todayLocal(),command:'contafixa',fixedExpenseId:expenseId,fixedMonthKey:monthKey,createdAt:new Date().toISOString()};
    await db.transactions.add(tx);
    await openFixedModal(monthKey);
    await refreshDashboard();await renderChatHistory();scrollChatToTop();scheduleBackup();
    showNotification(`✅ "${exp.name}" pago!`);
  }
}
async function toggleAllFixed(monthKey){
  const exps=await db.fixedexpenses.toArray();
  const active=exps.filter(e=>e.active);
  const payments=await db.fixedpayments.where('monthKey').equals(monthKey).toArray();
  const paidIds=new Set(payments.map(p=>p.expenseId));
  const allPaid=active.every(e=>paidIds.has(e.id));
  if(allPaid){
    if(!confirm(`Desmarcar TODAS as contas de ${monthKey.replace('-','/')}?\n\nAs transações serão removidas e o saldo será restituído.`))return;
    for(const p of payments)await db.fixedpayments.delete(p.id);
    for(const e of active){
      const txs=await db.transactions.filter(t=>t.fixedExpenseId===e.id&&t.fixedMonthKey===monthKey).toArray();
      for(const t of txs)await db.transactions.delete(t.id);
    }
    await openFixedModal(monthKey);
    await refreshDashboard();await renderChatHistory();scrollChatToTop();scheduleBackup();
    showNotification(`Todas desmarcadas para ${monthKey.replace('-','/')}.`);
  }else{
    const unpaid=active.filter(e=>!paidIds.has(e.id));
    const total=unpaid.reduce((s,e)=>s+e.amount,0);
    if(!confirm(`Pagar ${unpaid.length} conta${unpaid.length>1?'s':''} de ${monthKey.replace('-','/')}? Total: ${formatCurrency(total)}`))return;
    for(const e of unpaid){
      await db.fixedpayments.add({expenseId:e.id,monthKey,createdAt:new Date().toISOString()});
      const tx={type:'expense',category:e.category||'Contas Fixas',description:`${e.name} (${monthKey.replace('-','/')})`,amount:e.amount,date:todayLocal(),command:'contafixa',fixedExpenseId:e.id,fixedMonthKey:monthKey,createdAt:new Date().toISOString()};
      await db.transactions.add(tx);
    }
    await openFixedModal(monthKey);
    await refreshDashboard();await renderChatHistory();scrollChatToTop();scheduleBackup();
    showNotification(`✅ ${unpaid.length} conta${unpaid.length>1?'s':''} paga${unpaid.length>1?'s':''}!`);
  }
}

// ===== MODAL PROJECTED =====
function closeModal(id){$('#'+id).classList.remove('show');}
async function openProjectedModal(){
  const tx=await db.transactions.toArray(),insts=await db.installments.toArray(),debts=await db.debts.toArray();
  const income=tx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const expense=tx.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const balance=income-expense;
  const avgIncome=getAvgMonthly(tx,'income',3),avgExpense=getAvgMonthly(tx,'expense',3);
  const monthly=await getFutureMonthly(insts);
  const now=new Date();
  let html='<table class="projected-table"><thead><tr><th>Mês</th><th>Saldo Inicial</th><th>Receita Média</th><th>Despesa Média</th><th>Compromissos</th><th>Saldo Final</th></tr></thead><tbody>';
  let saldo=balance;
  const meses=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  for(let i=1;i<=12;i++){
    const d=new Date(now.getFullYear(),now.getMonth()+i,1);
    const label=`${meses[d.getMonth()]}/${d.getFullYear()}`;
    const comp=monthly[i-1]||0;
    const final=saldo+avgIncome-avgExpense-comp;
    const cls=final>=0?'projected-positive':'projected-negative';
    html+=`<tr><td>${label}</td><td>${formatCurrency(saldo)}</td><td>${formatCurrency(avgIncome)}</td><td>${formatCurrency(avgExpense)}</td><td>${formatCurrency(comp)}</td><td class="${cls}">${formatCurrency(final)}</td></tr>`;
    saldo=final;
  }
  html+='</tbody></table>';
  const info=`Saldo Atual: ${formatCurrency(balance)} | Média Receitas (3m): ${formatCurrency(avgIncome)} | Média Despesas (3m): ${formatCurrency(avgExpense)}`;
  $('#projectedInfo').textContent=info;
  $('#projectedBody').innerHTML=html;
  $('#projectedModal').classList.add('show');
}

// ===== MODAL MONTH EXPENSE =====
async function openMonthExpenseModal(){
  const tx=await db.transactions.toArray();
  const now=new Date(),thisMonth=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const expenses=tx.filter(t=>t.type==='expense'&&t.date.startsWith(thisMonth)).sort((a,b)=>b.date.localeCompare(a.date));
  const total=expenses.reduce((s,t)=>s+t.amount,0);
  $('#monthExpenseInfo').textContent=`Total: ${formatCurrency(total)} | ${expenses.length} despesa${expenses.length!==1?'s':''} em ${thisMonth}`;
  if(!expenses.length){$('#monthExpenseBody').innerHTML='<p class="empty-state">Nenhuma despesa neste mês.</p>';$('#monthExpenseModal').classList.add('show');return;}
  let html='<table class="detail-table"><thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>';
  for(const t of expenses){
    html+=`<tr><td>${formatDate(t.date)}</td><td>${escapeHtml(t.category)}</td><td>${escapeHtml(t.description)}</td><td style="color:var(--expense)">${formatCurrency(t.amount)}</td></tr>`;
  }
  html+='</tbody></table>';
  $('#monthExpenseBody').innerHTML=html;
  $('#monthExpenseModal').classList.add('show');
}

// ===== MODAL FUTURE COMMITMENTS =====
async function openFutureInstallmentsModal(filter){
  filter=filter||'all';
  const allInsts=await db.installments.toArray(),allRecs=await db.recurrings.toArray(),cards=await db.cards.toArray();
  const cardsMap={};for(const c of cards)cardsMap[c.id]=c;
  const now=new Date();
  const currentKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const meses=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  const monthData={};
  let maxKey=currentKey;

  // Collect installments
  for(const inst of allInsts){
    if(inst.paidInstallments>=inst.installmentCount)continue;
    const first=new Date(inst.firstInstallmentDate+'T12:00:00');
    for(let p=inst.paidInstallments||0;p<inst.installmentCount;p++){
      const d=new Date(first.getFullYear(),first.getMonth()+p,first.getDate());
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if(!monthData[key])monthData[key]={total:0,items:[]};
      monthData[key].items.push({type:'installment',cardName:cardsMap[inst.cardId]?.name||'-',description:inst.description,detail:`${p+1}/${inst.installmentCount}`,value:inst.installmentValue});
      monthData[key].total+=inst.installmentValue;
      if(key>maxKey)maxKey=key;
    }
  }

  const hasRecs=allRecs.some(r=>r.active);
  const fixedAll=await db.fixedexpenses.toArray();
  const hasFixed=fixedAll.some(f=>f.active);
  const maxHorizon=hasRecs||hasFixed;
  if(maxHorizon){
    const maxNow=new Date(now.getFullYear(),now.getMonth()+12,1);
    const maxInst=Object.keys(monthData).length?new Date(parseInt(maxKey.split('-')[0]),parseInt(maxKey.split('-')[1])-1,1):now;
    const end=maxNow>maxInst?maxNow:maxInst;
    maxKey=`${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}`;
  }

  // No data at all
  if(!Object.keys(monthData).length&&!maxHorizon){
    const infoEl=$('#futureInstallmentsInfo');
    infoEl.innerHTML=`<div class="filter-bar"><span style="font-size:0.82rem;color:var(--text-muted)">Nenhum compromisso futuro cadastrado.</span></div>`;
    $('#futureInstallmentsBody').innerHTML='<p class="empty-state">Cadastre compras parceladas, recorrentes ou contas fixas para ver o resumo aqui.</p>';
    $('#futureInstallmentsModal').classList.add('show');return;
  }

  // Fill all months from current to maxKey
  const allMonths=[];
  let cursor=new Date(parseInt(currentKey.split('-')[0]),parseInt(currentKey.split('-')[1])-1,1);
  const endDate=new Date(parseInt(maxKey.split('-')[0]),parseInt(maxKey.split('-')[1])-1,1);
  while(cursor<=endDate){
    const key=`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}`;
    if(!monthData[key])monthData[key]={total:0,items:[]};
    allMonths.push(key);
    cursor.setMonth(cursor.getMonth()+1);
  }

  // Add recurring to all months
  if(hasRecs){
    for(const rec of allRecs){
      if(!rec.active||!rec.startDate)continue;
      const recStart=rec.startDate.substring(0,7);
      for(const key of allMonths){
        if(key>=recStart){
          monthData[key].items.push({type:'recurring',cardName:cardsMap[rec.cardId]?.name||'-',description:rec.name,detail:'🔄 mensal',value:rec.amount});
          monthData[key].total+=rec.amount;
        }
      }
    }
  }

  // Add fixed expenses to all months
  for(const f of fixedAll){
    if(!f.active)continue;
    for(const key of allMonths){
      monthData[key].items.push({type:'fixed',cardName:'',description:f.name,detail:'📄 fixa',value:f.amount});
      monthData[key].total+=f.amount;
    }
  }

  // Info bar
  let grandTotal=0,itemCount=0;
  for(const key of allMonths){grandTotal+=monthData[key].total;itemCount+=monthData[key].items.length;}
  const infoEl=$('#futureInstallmentsInfo');
  infoEl.innerHTML=`<div class="filter-bar">
    <button class="filter-btn ${filter==='all'?'active':''}" onclick="openFutureInstallmentsModal('all')">Todos</button>
    <button class="filter-btn ${filter==='installment'?'active':''}" onclick="openFutureInstallmentsModal('installment')">Parcelas</button>
    <button class="filter-btn ${filter==='recurring'?'active':''}" onclick="openFutureInstallmentsModal('recurring')">Recorrentes</button>
    <span style="margin-left:auto;font-size:0.82rem;color:var(--text-secondary)">Total: ${formatCurrency(grandTotal)} · ${allMonths.length} mês${allMonths.length!==1?'es':''} · ${itemCount} item${itemCount!==1?'ns':''}</span>
  </div>`;

  // Render
  if(!allMonths.some(k=>monthData[k].items.some(i=>filter==='all'||i.type===filter))){
    $('#futureInstallmentsBody').innerHTML=`<p class="empty-state">Nenhum item para o filtro "${filter==='installment'?'Parcelas':'Recorrentes'}".</p>`;
    $('#futureInstallmentsModal').classList.add('show');return;
  }

  let html='';
  for(const key of allMonths){
    const [y,m]=key.split('-');
    const monthLabel=`${meses[parseInt(m)-1]}/${y}`;
    let filtered=monthData[key].items;
    if(filter!=='all')filtered=filtered.filter(i=>i.type===filter);
    if(!filtered.length)continue;
    const monthTotal=filtered.reduce((s,i)=>s+i.value,0);
    html+=`<div class="invoice-month">
      <div class="invoice-month-header">
        <span class="invoice-month-label">📆 ${monthLabel}</span>
        <span class="invoice-month-total">${formatCurrency(monthTotal)}</span>
      </div>
      <table class="detail-table" style="margin-top:0.3rem">
        <thead><tr><th>Cartão</th><th>Descrição</th><th>Detalhe</th><th>Valor</th></tr></thead>
        <tbody>${filtered.map(i=>`<tr><td class="card-name">${i.cardName}</td><td>${i.description}</td><td>${i.detail}</td><td style="color:var(--expense)">${formatCurrency(i.value)}</td></tr>`).join('')}</tbody>
      </table>
    </div>`;
  }
  $('#futureInstallmentsBody').innerHTML=html;
  $('#futureInstallmentsModal').classList.add('show');
}

// ===== BUDGETS =====
function setupBudgetForm(){
  $('#budgetForm').addEventListener('submit',async(e)=>{
    e.preventDefault();
    const category=$('#budgetCategory').value;
    const limit=parseFloat($('#budgetLimit').value)||0;
    if(!category||!limit)return showNotification('Preencha categoria e limite.');
    const existing=await db.budgets.get(category);
    if(existing){
      existing.limit=limit;
      await db.budgets.put(existing);
      showNotification('Orçamento atualizado!');
    }else{
      await db.budgets.add({category,limit});
      showNotification('Orçamento criado!');
    }
    $('#budgetLimit').value='';
    await loadBudgetsTable();await refreshDashboard();scheduleBackup();
  });
}

async function loadBudgetsTable(){
  const budgets=await db.budgets.toArray();
  const tb=$('#budgetsBody'),em=$('#emptyBudgets');
  if(!budgets.length){tb.innerHTML='';em.style.display='block';return;}
  em.style.display='none';
  const now=new Date(),thisMonth=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const tx=await db.transactions.toArray();
  const monthTx=tx.filter(t=>t.date.startsWith(thisMonth)&&t.type==='expense');
  const spentMap={};
  monthTx.forEach(t=>{spentMap[t.category]=(spentMap[t.category]||0)+t.amount;});
  const insts=await db.installments.toArray();
  for(const i of insts){
    if(i.paidInstallments>=i.installmentCount)continue;
    const first=new Date(i.firstInstallmentDate+'T12:00:00');
    for(let p=i.paidInstallments;p<i.installmentCount;p++){
      const d=new Date(first.getFullYear(),first.getMonth()+p,first.getDate());
      if(d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()){
        spentMap[i.category]=(spentMap[i.category]||0)+i.installmentValue;
        break;
      }
    }
  }
  tb.innerHTML=budgets.map(b=>{
    const spent=spentMap[b.category]||0;
    const pct=Math.min(100,Math.round(spent/b.limit*100));
    const cls=pct>=100?'progress-danger':pct>=80?'progress-warn':'progress-ok';
    return `<tr><td>${escapeHtml(b.category)}</td><td>${formatCurrency(b.limit)}</td><td style="color:${pct>=100?'var(--expense)':pct>=80?'#f59e0b':'var(--text-secondary)'}">${formatCurrency(spent)}</td><td><div class="progress-bar"><div class="progress-bar-fill ${cls}" style="width:${pct}%"></div></div><span style="font-size:0.72rem;color:var(--text-muted)">${pct}%</span></td><td><button class="btn-sm" onclick="editBudget('${escapeHtml(b.category)}')">Editar</button><button class="btn-sm danger" onclick="deleteBudget('${escapeHtml(b.category)}')">Excluir</button></td></tr>`;
  }).join('');
}

async function editBudget(category){
  const b=await db.budgets.get(category);
  if(!b)return;
  $('#budgetCategory').value=b.category;
  $('#budgetLimit').value=b.limit;
  $('#budgetCategory').focus();
}

async function deleteBudget(category){
  if(!confirm(`Excluir orçamento de "${category}"?`))return;
  await db.budgets.delete(category);
  await loadBudgetsTable();await refreshDashboard();showNotification('Orçamento excluído.');scheduleBackup();
}

async function loadBudgetSelect(){
  const cats=await db.categories.toArray();
  const expenseCats=cats.filter(c=>c.type==='expense');
  const sel=$('#budgetCategory');
  sel.innerHTML=expenseCats.map(c=>`<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
}

// ===== EXPORT/IMPORT =====
async function clearAllData(){
  if(!confirm('🗑️ Limpar TODOS os dados?\n\nEsta ação não pode ser desfeita.'))return;
  if(!confirm('Tem certeza?'))return;
  await db.transactions.clear();await db.commands.clear();await db.categories.clear();
  await db.cards.clear();await db.installments.clear();await db.debts.clear();await db.debtpayments.clear();await db.invoicepayments.clear();await db.recurrings.clear();await db.fixedexpenses.clear();await db.fixedpayments.clear();await db.budgets.clear();
  await seedData();
  await loadCategoriesSelect();await loadCommandsTable();await loadCategoriesTable();
  await loadCardsTable();await loadInstallmentsTable();await loadDebtsTable();await loadRecurringsTable();await loadFixedTable();
  await refreshDashboard();renderChatHistory();scrollChatToTop();showNotification('Dados limpos.');scheduleBackup();
}

async function exportData(){
  const transactions=await db.transactions.toArray(),commands=await db.commands.toArray(),categories=await db.categories.toArray();
  const cards=await db.cards.toArray(),installments=await db.installments.toArray(),debts=await db.debts.toArray(),debtPayments=await db.debtpayments.toArray(),invoicePayments=await db.invoicepayments.toArray(),recurrings=await db.recurrings.toArray(),fixedExpenses=await db.fixedexpenses.toArray(),fixedPayments=await db.fixedpayments.toArray();
  const budgets=await db.budgets.toArray();
  const data={version:7,exportedAt:new Date().toISOString(),data:{transactions,commands,categories,cards,installments,debts,debtPayments,invoicePayments,recurrings,fixedExpenses,fixedPayments,budgets}};
  downloadFile(JSON.stringify(data,null,2),`financeapp_backup_${formatDateTime(new Date())}.json`,'application/json');
  showNotification('Exportado!');
}

async function importData(event){
  const file=event.target.files[0];if(!file)return;
  try{
    const text=await file.text(),parsed=JSON.parse(text);
    if(!parsed.data||!parsed.version)return showNotification('Arquivo inválido.');
    if(!confirm(`Importar dados? Os dados atuais serão substituídos.`))return;
    const{transactions,commands,categories,cards,installments,debts,debtPayments,invoicePayments,recurrings,fixedExpenses,fixedPayments,budgets}=parsed.data;
    await db.transactions.clear();await db.commands.clear();await db.categories.clear();
    await db.cards.clear();await db.installments.clear();await db.debts.clear();await db.debtpayments.clear();await db.invoicepayments.clear();await db.recurrings.clear();await db.fixedexpenses.clear();await db.fixedpayments.clear();await db.budgets.clear();
    if(categories?.length)await db.categories.bulkAdd(categories);
    if(commands?.length)await db.commands.bulkAdd(commands);
    if(cards?.length)await db.cards.bulkAdd(cards);
    if(installments?.length){for(const i of installments){delete i.id;await db.installments.add(i);}}
    if(debts?.length){for(const d of debts){delete d.id;await db.debts.add(d);}}
    if(invoicePayments?.length){for(const p of invoicePayments){delete p.id;await db.invoicepayments.add(p);}}
    if(recurrings?.length){for(const r of recurrings){delete r.id;await db.recurrings.add(r);}}
    if(fixedExpenses?.length){for(const e of fixedExpenses){delete e.id;await db.fixedexpenses.add(e);}}
    if(fixedPayments?.length){for(const p of fixedPayments){delete p.id;await db.fixedpayments.add(p);}}
    if(budgets?.length){for(const b of budgets){await db.budgets.put(b);}}
    if(transactions?.length){for(const t of transactions){delete t.id;await db.transactions.add(t);}}
    $('#importInput').value='';
    await loadCategoriesSelect();await loadCommandsTable();await loadCategoriesTable();
    await loadCardsTable();await loadInstallmentsTable();await loadDebtsTable();await loadRecurringsTable();await loadFixedTable();await loadCardSelect();await loadBudgetsTable();
    await refreshDashboard();renderChatHistory();showNotification('Importado!');scheduleBackup();
  }catch(err){showNotification('Erro: '+err.message);$('#importInput').value='';}
}

// ===== REPORTS =====
async function generateAndSaveReport(){
  const all=await db.transactions.toArray(),insts=await db.installments.toArray(),debts=await db.debts.toArray();
  if(!all.length&&!insts.length&&!debts.length)return showNotification('Nada para relatar.');
  let md='# Relatório Financeiro\n\n**Gerado em:** '+new Date().toLocaleString('pt-BR')+'\n\n';
  md+='## Resumo Financeiro\n\n';
  const income=all.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const expense=all.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  md+=`| Indicador | Valor |\n|-----------|-------|\n| Saldo | R$ ${(income-expense).toFixed(2)} |\n| Total Receitas | R$ ${income.toFixed(2)} |\n| Total Despesas | R$ ${expense.toFixed(2)} |\n| Transações | ${all.length} |\n`;
  const totalDebt=debts.reduce((s,d)=>s+d.currentAmount,0);
  const totalInst=insts.filter(i=>i.paidInstallments<i.installmentCount).reduce((s,i)=>s+(i.installmentCount-i.paidInstallments)*i.installmentValue,0);
  md+=`| Dívidas | R$ ${totalDebt.toFixed(2)} |\n| Parcelas Futuras | R$ ${totalInst.toFixed(2)} |\n\n`;
  if(all.length){
    md+='---\n\n## Transações\n\n| # | Data | Tipo | Categoria | Descrição | Valor |\n|---|------|------|-----------|-----------|-------|\n';
    [...all].sort((a,b)=>b.date.localeCompare(a.date)).forEach((t,i)=>{
      md+=`| ${i+1} | ${t.date} | ${t.type==='income'?'📈 Receita':'📉 Despesa'} | ${t.category} | ${t.description} | R$ ${t.amount.toFixed(2)} |\n`;
    });
  }
  downloadFile(md,`relatorio_${formatDateTime(new Date())}.md`,'text/markdown;charset=utf-8');
  showNotification('Relatório gerado!');
}

function downloadFile(content,f,mime){const b=new Blob([content],{type:mime}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=f;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);}

// ===== UTILITIES =====
function getDefaultColor(name){
  const s=SEED_CATEGORIES.find(c=>c.name===name);if(s)return s.color;
  const p=['#3b82f6','#ef4444','#22c55e','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#f97316','#6366f1','#84cc16','#06b6d4','#d946ef','#eab308','#64748b'];
  let h=0;for(let i=0;i<name.length;i++)h=((h<<5)-h)+name.charCodeAt(i);
  return p[Math.abs(h)%p.length];
}
function formatCurrency(v){return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function formatDate(d){if(!d)return'';const[y,m,day]=d.split('-');return`${day}/${m}/${y}`;}
function formatDateShort(d){if(!d)return'';const[y,m,day]=d.split('-');return`${day}/${m}`;}
function formatDateTime(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0'),h=String(d.getHours()).padStart(2,'0'),mi=String(d.getMinutes()).padStart(2,'0'),s=String(d.getSeconds()).padStart(2,'0');return`${y}${m}${dd}_${h}${mi}${s}`;}
function escapeHtml(t){const d=document.createElement('div');d.textContent=t;return d.innerHTML;}
function showNotification(m){let n=document.querySelector('.notification');if(!n){n=document.createElement('div');n.className='notification';document.body.appendChild(n);}n.textContent=m;n.classList.add('show');clearTimeout(n._timeout);n._timeout=setTimeout(()=>n.classList.remove('show'),3000);}
window.debugAlimentacao=async function(){
  const tx=await db.transactions.where('category').equals('Alimentação').toArray();
  console.group('🔎 Transações com categoria "Alimentação"');
  console.table(tx.map(t=>({id:t.id,date:t.date,amount:t.amount,description:t.description,command:t.command})));
  console.groupEnd();
  const insts=await db.installments.where('category').equals('Alimentação').toArray();
  console.group('🔎 Parcelas com categoria "Alimentação"');
  for(const i of insts){
    const remaining=i.installmentCount-(i.paidInstallments||0);
    console.log(`${i.description}: R$ ${(remaining*i.installmentValue).toFixed(2)} restante (${i.paidInstallments||0}/${i.installmentCount} pagas, R$ ${i.installmentValue}/parcela)`);
  }
  if(!insts.length)console.log('Nenhuma parcela encontrada.');
  console.groupEnd();
};
