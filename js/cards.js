// ===== CARDS =====
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