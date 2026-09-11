// ===== INSTALLMENTS =====
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