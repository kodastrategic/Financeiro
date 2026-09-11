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

async function seedData(){
  const cc=await db.categories.count();
  if(cc===0){
    await db.categories.bulkAdd(SEED_CATEGORIES);
  } else {
    const all=await db.categories.toArray();
    for(const c of all){
      if(!c.color){const s=SEED_CATEGORIES.find(x=>x.name===c.name);c.color=s?.color||pickColor(c.type);await db.categories.put(c);}
    }
  }
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