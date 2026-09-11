// ===== APP INIT & NAV =====
function openTab(tab){
  const b=document.querySelector(`.tab-btn[data-tab="${tab}"]`);
  if(b)b.click();
}
function setupTabNavigation(){
  $$('.tab-btn').forEach(b=>{
    b.addEventListener('click',()=>{
      $$('.tab-btn').forEach(x=>x.classList.remove('active'));
      $$('.tab-content').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');$(`#${b.dataset.tab}`).classList.add('active');
      if(b.dataset.tab==='dashboard')Object.values(charts).forEach(c=>c?.resize());
      if(b.dataset.tab==='chat'){$('#chatInput').focus();scrollChatToTop();}
      if(b.dataset.tab==='bills'){loadFixedTable();}
      if(b.dataset.tab==='debts'){loadDebtsTable();loadDebtPaymentsTable();}
      if(b.dataset.tab==='commands'){loadBudgetsTable();}
    });
  });
}

document.addEventListener('DOMContentLoaded',async()=>{
  try{
    await seedData(); await loadCategoriesSelect(); await loadCommandsTable(); await loadCategoriesTable();
    setupTabNavigation(); setupChat(); setupCommandForm(); setupCategoryForm(); setupCreateCmdForm();
    setupDebtForm(); setupFixedForm();
    setupEditTxForm(); setupBudgetForm(); setupTypeModal();
    await loadFixedTable(); await loadBudgetsTable();
    await setupGlobalMonthFilter(); await refreshDashboard(); setupChartGlow(); renderChatHistory(); scrollChatToTop(); $('#chatInput').focus();
    $('#loadingScreen').classList.add('hidden');
  }catch(e){console.error(e);showNotification('Erro: '+e.message);}
});