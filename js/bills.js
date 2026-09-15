// ===== FIXED EXPENSES =====
let editingFixedId=null;
function resetFixedForm(){
  $('#fixedForm').reset();
  $('#fixedActive').checked=true;
  $('#fixedStartMonth').value=todayLocal().substring(0,7);
  editingFixedId=null;
  const sb=$('#fixedSubmitBtn');if(sb)sb.textContent='Adicionar Conta';
  const cb=$('#fixedCancelBtn');if(cb)cb.style.display='none';
}
function fixedErrorFriendly(err){
  const msg=(err&&err.message)||String(err);
  if(/PGRST204|startmonth|endmonth|could not find/i.test(msg)&&/fixedexpenses/i.test(msg)){
    return 'Colunas Início/Término não existem ainda no banco. Rode no SQL Editor do Supabase: ALTER TABLE fixedexpenses ADD COLUMN IF NOT EXISTS startmonth TEXT; ALTER TABLE fixedexpenses ADD COLUMN IF NOT EXISTS endmonth TEXT;';
  }
  return 'Erro: '+msg;
}
function setupFixedForm(){
  $('#fixedStartMonth').value=todayLocal().substring(0,7);
  $('#fixedForm').addEventListener('submit',async(e)=>{
    e.preventDefault();
    const name=$('#fixedName').value.trim(),amount=parseFloat($('#fixedAmount').value)||0;
    const dueDay=parseInt($('#fixedDueDay').value)||null,category=$('#fixedCategory').value;
    const startMonth=$('#fixedStartMonth').value||'';
    const endMonth=$('#fixedEndMonth').value||'';
    const active=$('#fixedActive').checked;
    if(!name||!amount)return showNotification('Preencha nome e valor.');
    if(!startMonth)return showNotification('Informe a data de início.');
    if(endMonth&&endMonth<startMonth)return showNotification('Término deve ser depois do início.');
    const rec={name,amount,dueDay,category,active,startMonth,createdAt:new Date().toISOString()};
    if(endMonth)rec.endMonth=endMonth;
    try{
      if(editingFixedId){
        await db.fixedexpenses.put({id:editingFixedId,...rec});
        showNotification('Conta fixa atualizada!');
      }else{
        await db.fixedexpenses.add(rec);
        showNotification(`"${name}" adicionado!`);
      }
      resetFixedForm();
      await loadFixedTable();
      scheduleBackup();
    }catch(err){
      showNotification(fixedErrorFriendly(err));
    }
  });
  const cb=$('#fixedCancelBtn');if(cb)cb.addEventListener('click',resetFixedForm);
}
function editFixed(id){
  const exp=window._fixedCache&&window._fixedCache.find(e=>e.id===id);
  const fill=async()=>{
    const e=exp||await db.fixedexpenses.get(id);
    if(!e)return showNotification('Conta não encontrada.');
    editingFixedId=e.id;
    $('#fixedName').value=e.name;
    $('#fixedAmount').value=e.amount;
    if(e.dueDay)$('#fixedDueDay').value=e.dueDay;
    $('#fixedCategory').value=e.category||'';
    $('#fixedStartMonth').value=e.startMonth||(e.createdAt?e.createdAt.substring(0,7):todayLocal().substring(0,7));
    $('#fixedEndMonth').value=e.endMonth||'';
    $('#fixedActive').checked=e.active!==false;
    $('#fixedSubmitBtn').textContent='Salvar';
    $('#fixedCancelBtn').style.display='inline-block';
    $('#fixedName').focus();
    window.scrollTo({top:document.querySelector('#fixedForm').offsetTop-80,behavior:'smooth'});
  };
  fill();
}
function cancelEditFixed(){resetFixedForm();}
function formatMonthRange(exp){
  const st=exp.startMonth||(exp.createdAt?exp.createdAt.substring(0,7):'');
  return `${st?formatMonthLabel(st):'-'}${exp.endMonth?` → ${formatMonthLabel(exp.endMonth)}`:' → contínua'}`;
}
function fixedAppliesMonth(exp,monthKey){
  if(!exp.active)return false;
  const st=exp.startMonth||(exp.createdAt?exp.createdAt.substring(0,7):'');
  if(st&&monthKey<st)return false;
  if(exp.endMonth&&monthKey>exp.endMonth)return false;
  return true;
}
async function loadFixedTable(){
  const exps=await db.fixedexpenses.toArray(),tb=$('#fixedBody'),em=$('#emptyFixed');
  window._fixedCache=exps;
  if(!tb)return;
  if(!exps.length){tb.innerHTML='';if(em)em.style.display='block';return;}
  if(em)em.style.display='none';
  tb.innerHTML=exps.map(e=>`<tr><td>${escapeHtml(e.name)}</td><td>${formatCurrency(e.amount)}</td><td>${formatMonthRange(e)}</td><td>${escapeHtml(e.category)}</td><td><span class="${e.active?'badge-income':'badge-warning'}">${e.active?'Ativo':'Pausado'}</span></td><td><button class="btn-sm" onclick="toggleFixed(${e.id})">${e.active?'Pausar':'Ativar'}</button><button class="btn-sm" onclick="editFixed(${e.id})">Editar</button><button class="btn-sm danger" onclick="deleteFixed(${e.id})">Excluir</button></td></tr>`).join('');
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
let fixedModalMonth=null;

// --- Modelo de atraso: competência x vencimento ---
// A conta pertence sempre ao mês de competência (não muda de mês).
// O mês atual mostra as contas do mês + seção "Em atraso" (competências
// anteriores não pagas) — puxadas por consulta, sem duplicar valor.
// Ao pagar, o usuário informa o valor REAL pago (juros/multa = excedente).
function monthKeyOf(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function addMonths(key,n){
  const [y,m]=key.split('-').map(Number);
  const d=new Date(y,m-1+n,1);
  return monthKeyOf(d);
}
function getFixDueDate(exp,monthKey){
  const [y,m]=monthKey.split('-').map(Number);
  const day=exp.dueDay||1;
  const lastDay=new Date(y,m,0).getDate();
  return `${monthKey}-${String(Math.min(day,lastDay)).padStart(2,'0')}`;
}
function getUnpaidCompetencias(exp,paysSet,curKey,fromKey){
  if(!exp.active)return [];
  const out=[];
  const today=todayLocal();
  const start=fromKey||exp.startMonth||(exp.createdAt?exp.createdAt.substring(0,7):addMonths(curKey,-60));
  const end=exp.endMonth||null;
  if(end&&start>end)return [];
  let key=start,k=0;
  while(key<=curKey&&k<360&&(!end||key<=end)){
    if(!paysSet.has(exp.id+':'+key)){
      const dueDate=getFixDueDate(exp,key);
      if(dueDate<today)out.push({monthKey:key,dueDate});
    }
    key=addMonths(key,1);
    k++;
  }
  return out;
}
async function getOverdueFixedTotal(exps){
  const list=exps||await db.fixedexpenses.toArray();
  const pays=await db.fixedpayments.toArray();
  const paysSet=new Set(pays.map(p=>p.expenseId+':'+p.monthKey));
  const curKey=currentMonthKey();
  let total=0;
  for(const exp of list){
    if(!exp.active)continue;
    const unpaid=getUnpaidCompetencias(exp,paysSet,curKey);
    for(const u of unpaid)total+=exp.amount;
  }
  return total;
}
function promptFixedAmount(exp,monthKey){
  const label=`"${exp.name}" (competência ${monthKey.replace('-','/')})`;
  const raw=prompt(`Valor REAL pago de ${label}.\n\nValor original: ${formatCurrency(exp.amount)}\nSe pagou com juros/multa, informe o valor total efetivamente pago.`,exp.amount.toFixed(2).replace('.',','));
  if(raw===null)return null;
  const amount=parseFloat(raw.replace(',','.'));
  if(isNaN(amount)||amount<=0){showNotification('Valor inválido.');return null;}
  return Math.round(amount*100)/100;
}
async function payOverdueFixed(expenseId,monthKey){
  const exp=await db.fixedexpenses.get(expenseId);
  if(!exp)return;
  const amount=promptFixedAmount(exp,monthKey);
  if(amount===null)return;
  await db.fixedpayments.add({expenseId,monthKey,createdAt:new Date().toISOString()});
  const tx={type:'expense',category:exp.category||'Contas Fixas',description:`[Atraso] ${exp.name} (${monthKey.replace('-','/')})`,amount,date:todayLocal(),command:'contafixa',fixedExpenseId:expenseId,fixedMonthKey:monthKey,createdAt:new Date().toISOString()};
  await db.transactions.add(tx);
  await openFixedModal(fixedModalMonth||currentMonthKey());
  await refreshDashboard();await renderChatHistory();scrollChatToTop();scheduleBackup();
  const extra=amount>exp.amount?` · juros/multa: ${formatCurrency(amount-exp.amount)}`:'';
  showNotification(`✅ "${exp.name}" pago: ${formatCurrency(amount)}${extra}`);
}

async function openFixedModal(monthKey){
  const now=new Date();
  if(!monthKey)monthKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  fixedModalMonth=monthKey;
  const [y,m]=monthKey.split('-').map(Number);
  const currentDate=new Date(y,m-1,1);
  const meses=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const monthLabel=`${meses[currentDate.getMonth()]}/${y}`;
  $('#fixedModalMonth').textContent=monthLabel;

  const exps=await db.fixedexpenses.toArray();
  const active=exps.filter(e=>fixedAppliesMonth(e,monthKey));
  if(!active.length){
    renderFixedNav(monthKey);
    $('#fixedModalInfo').innerHTML='<span style="color:var(--text-muted);font-size:0.82rem">Nenhuma conta fixa neste mês.</span>';
    $('#fixedModalBody').innerHTML='<p class="empty-state">Não há contas fixas ativas com competência neste mês.</p>';
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

  // Seção "Em atraso": competências ANTERIORES não pagas e já vencidas
  // (consulta sobre fixedpayments — não duplica nem altera o mês de competência)
  const allPays=await db.fixedpayments.toArray();
  const paysSet=new Set(allPays.map(p=>p.expenseId+':'+p.monthKey));
  const overdue=[];
  for(const e of exps.filter(e=>e.active)){
    const unpaid=getUnpaidCompetencias(e,paysSet,monthKey);
    for(const u of unpaid){
      if(u.monthKey===monthKey)continue;
      overdue.push({exp:e,...u});
    }
  }
  overdue.sort((a,b)=>b.monthKey.localeCompare(a.monthKey)||b.dueDate.localeCompare(a.dueDate));
  if(overdue.length){
    html+=`<div class="fixed-overdue-sec">
      <h4 class="fixed-overdue-title">⚠️ Em atraso (competências anteriores)</h4>
      ${overdue.map(o=>`<div class="invoice-month" style="border-color:rgba(245,158,11,0.3)">
        <div class="invoice-month-header">
          <span class="invoice-month-label">${escapeHtml(o.exp.name)} <span style="opacity:0.6;font-size:0.72rem">· competência ${formatMonthLabel(o.monthKey)}</span></span>
          <span class="invoice-month-total" style="color:var(--expense)">${formatCurrency(o.exp.amount)}</span>
        </div>
        <div class="invoice-month-footer">
          <span style="font-size:0.82rem;color:var(--text-secondary)">Venc. ${formatDate(o.dueDate)} · ${escapeHtml(o.exp.category)}</span>
          <button class="btn-sm" style="background:rgba(245,158,11,0.15);color:#fbbf24;border-color:rgba(245,158,11,0.35)" onclick="payOverdueFixed(${o.exp.id},'${o.monthKey}')">💸 Pagar (valor real)</button>
        </div>
      </div>`).join('')}
    </div>`;
  }

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
  const active=exps.filter(e=>fixedAppliesMonth(e,monthKey));
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