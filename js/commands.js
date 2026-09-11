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
  window._allCategories=cats;
  const tb=$('#categoriesBody'),em=$('#emptyCategories');
  if(!cats.length){tb.innerHTML='';em.style.display='block';return;}
  em.style.display='none';
  tb.innerHTML=cats.map(c=>`<tr><td><span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:${c.color||pickColor(c.type)};border:2px solid rgba(255,255,255,0.08)"></span></td><td>${escapeHtml(c.name)}</td><td><span class="badge-${c.type}">${c.type==='income'?'Receita':'Despesa'}</span></td><td><button class="btn-sm" onclick="editCategory('${escapeHtml(c.name)}')">Editar</button><button class="btn-sm danger" onclick="deleteCategory('${escapeHtml(c.name)}')">Excluir</button></td></tr>`).join('');
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
    const all=await db.commands.toArray();
    if(all.find(c=>c.keyword===keyword))return showNotification(`/${keyword} já existe.`);
    try{
      await db.commands.add({keyword,category,type:cat.type});
      // Verifica se realmente salvou
      const check=await db.commands.toArray();
      if(!check.find(c=>c.keyword===keyword))return showNotification(`ERRO: /${keyword} não foi salvo. Abra o console (F12) e veja os logs.`);
      $('#cmdKeyword').value='';await loadCommandsTable();showNotification(`/${keyword} criado!`);scheduleBackup();
    }catch(e){showNotification('Erro: '+e.message);console.error(e);}
  });
}
async function deleteCommand(k){if(!confirm(`Excluir /${k}?`))return;await db.commands.delete(k);await loadCommandsTable();showNotification('Excluído.');scheduleBackup();}

function setupCategoryForm(){
  const ct=$('#catType'),cc=$('#catColor');
  ct.addEventListener('change',()=>{cc.value=pickColor(ct.value);});
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
      try{
        await db.categories.add({name,type,color});
        showNotification(`Categoria "${name}" criada!`);scheduleBackup();
      }catch(e){showNotification('Erro: '+e.message);console.error(e);return;}
    }
    $('#catName').value='';cc.value=pickColor('income');ct.value='income';
    await loadCategoriesTable();await loadCommandsTable();await loadCategoriesSelect();await refreshDashboard();
  });
}
async function editCategory(name){
  const c=await db.categories.get(name);if(!c)return;
  editingCategory=name;$('#catName').value=c.name;$('#catType').value=c.type;$('#catColor').value=c.color||pickColor(c.type);
  $('#catName').focus();document.querySelector('#categoryForm .btn-primary').textContent='Salvar';
}
async function deleteCategory(name){
  if(!confirm(`Excluir "${name}"?`))return;
  await db.categories.delete(name);
  for(const cmd of await db.commands.where('category').equals(name).toArray())await db.commands.delete(cmd.keyword);
  await loadCategoriesTable();await loadCommandsTable();await loadCategoriesSelect();showNotification('Excluída.');scheduleBackup();
}

// ===== CREATE COMMAND MODAL =====
async function showCreateCommandModal(keyword,amount,date){
  const cats=await db.categories.toArray();
  const sel=$('#createCmdCategory');
  $('#createCmdKeyword').value=keyword;
  $('#createCmdAmount').value=formatCurrency(amount);
  $('#createCmdName').textContent=keyword;
  $('#createCmdForm').dataset.keyword=keyword;
  $('#createCmdForm').dataset.amount=amount;
  $('#createCmdForm').dataset.date=date;
  $('#createCmdModal').classList.add('show');
}
function setupCreateCmdForm(){
  $('#createCmdForm').addEventListener('submit',async(e)=>{
    e.preventDefault();
    const keyword=$('#createCmdForm').dataset.keyword;
    const amount=parseFloat($('#createCmdForm').dataset.amount);
    const date=$('#createCmdForm').dataset.date;
    const type=$('#createCmdType').value;
    let category=$('#createCmdCategory').value;
    try{
      if(!category){
        // Cria categoria com o nome do comando
        if(!await db.categories.get(keyword)){
          await db.categories.add({name:keyword,type,color:pickColor(type)});
          await loadCategoriesTable();await loadCategoriesSelect();
        }
        category=keyword;
      }
      // Cria comando
      await db.commands.add({keyword,category,type});
      await loadCommandsTable();
      // Executa transação
      const tx={type,category,description:`/${keyword} ${amount}`,amount,date,command:keyword,createdAt:new Date().toISOString()};
      const txId=await db.transactions.add(tx);
      closeModal('createCmdModal');
      await refreshDashboard();scheduleBackup();
      const all=await db.transactions.toArray();
      const balance=all.reduce((s,t)=>s+(t.type==='income'?t.amount:-t.amount),0);
      addChatMessage(`<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.75rem"><div><div class="msg-tx-header"><span>${type==='income'?'📈':'📉'} <strong>${type==='income'?'Receita':'Despesa'}</strong></span><span class="msg-tx-category">${category}</span></div><div class="msg-tx-amount ${type}">${type==='income'?'+':'-'} ${formatCurrency(amount)}</div><div class="msg-tx-balance">Saldo: ${formatCurrency(balance)}</div><div class="msg-tx-date">${formatDate(date)}</div></div><div style="display:flex;gap:0.3rem;flex-shrink:0"><button class="btn-sm" onclick="editTransaction(${txId})" title="Editar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button><button class="btn-sm danger" onclick="deleteTransaction(${txId})" title="Excluir">✕</button></div>`,'msg-tx '+type);
      renderChatBanner();
      showNotification(`/${keyword} criado e executado!`);
    }catch(e){showNotification('Erro: '+e.message);console.error(e);}
  });
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