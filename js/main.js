// ===== APP INIT & NAV =====
function setupTabNavigation(){
  $$('.tab-btn').forEach(b=>{
    b.addEventListener('click',()=>{
      $$('.tab-btn').forEach(x=>x.classList.remove('active'));
      $$('.tab-content').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');$(`#${b.dataset.tab}`).classList.add('active');
      if(b.dataset.tab==='dashboard')Object.values(charts).forEach(c=>c?.resize());
      if(b.dataset.tab==='chat'){$('#chatInput').focus();scrollChatToTop();}
      if(b.dataset.tab==='cards'){loadCardsTable();loadCardSelect();}
      if(b.dataset.tab==='bills'){loadFixedTable();loadRecurringsTable();}
      if(b.dataset.tab==='debts'){loadInstallmentsTable();loadDebtsTable();loadDebtPaymentsTable();loadCardSelect();}
      if(b.dataset.tab==='commands'){loadBudgetsTable();}
    });
  });
}

document.addEventListener('DOMContentLoaded',async()=>{
  try{
    await seedData(); await loadCategoriesSelect(); await loadCommandsTable(); await loadCategoriesTable();
    setupTabNavigation(); setupChat(); setupCommandForm(); setupCategoryForm(); setupCreateCmdForm();
    setupCardForm(); setupInstallmentForm(); setupDebtForm(); setupRecurringForm(); setupFixedForm();
    setupEditTxForm(); setupBudgetForm(); setupExtract();
    await loadCardSelect(); await loadFixedTable(); await loadBudgetsTable();
    await setupGlobalMonthFilter(); await refreshDashboard(); setupChartGlow(); renderChatHistory(); scrollChatToTop(); $('#chatInput').focus();
    $('#loadingScreen').classList.add('hidden');
  }catch(e){console.error(e);showNotification('Erro: '+e.message);}
});