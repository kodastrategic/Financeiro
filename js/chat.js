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
async function sendMessage(){
  const input=$('#chatInput'),text=input.value.trim();
  if(!text)return;input.value='';hideAutocomplete($('#autocompleteBox'));
  try{await processCommand(text);}catch(e){addChatMessage(`<strong>Erro:</strong> ${e.message||e}`,'msg-error');console.error(e);}
}
async function showAutocomplete(input,box){
  const text=input.value;
  const cmds=await db.commands.toArray();
  if(!cmds.length){box.style.display='none';return;}
  let filtered, prefix;
  // Monta lista combinada: comandos + categorias (como fallback)
  const cats=await db.categories.toArray();
  const allEntries=[];
  const cmdKeywords=new Set(cmds.map(c=>c.keyword));
  for(const c of cmds)allEntries.push({keyword:c.keyword,category:c.category,type:c.type});
  for(const cat of cats){
    if(!cmdKeywords.has(cat.name))allEntries.push({keyword:cat.name,category:cat.name,type:cat.type});
  }
  if(text.startsWith('/')){
    prefix='/';
    const partial=normalizeKey(text.slice(1));
    filtered=allEntries.filter(c=>normalizeKey(c.keyword).includes(partial));
  }else if(text.length>0){
    prefix='';
    const partial=normalizeKey(text);
    filtered=allEntries.filter(c=>normalizeKey(c.keyword).includes(partial));
  }else{
    // Vazio — mostra os mais usados
    prefix='';
    const all=await db.transactions.toArray();
    const counts={};for(const t of all)if(t.command)counts[t.command]=(counts[t.command]||0)+1;
    allEntries.sort((a,b)=>(counts[b.keyword]||0)-(counts[a.keyword]||0));
    filtered=allEntries;
  }
  filtered=filtered.slice(0,8);
  if(!filtered.length||text.includes(' ')){box.style.display='none';return;}
  box.innerHTML=filtered.map(c=>`<div data-keyword="${c.keyword}" data-category="${c.category}" data-type="${c.type}" onclick="selectAutocompleteItem('${prefix}${c.keyword} ')">${prefix}${c.keyword} <span style="color:${c.type==='income'?'#22c55e':'#ef4444'};font-size:0.75rem">${c.category}</span></div>`).join('');
  box.style.display='block';
}
function selectAutocompleteItem(val){
  const input=$('#chatInput');input.value=val;input.focus();hideAutocomplete($('#autocompleteBox'));
}
function selectAutocomplete(input,box){
  const sel=box.querySelector('.auto-item-sel')||box.firstElementChild;
  if(sel&&sel.dataset.keyword)input.value=sel.dataset.keyword+' ';
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
    addChatMessage(`Formato inválido. Use: <code>comando valor</code> ou <code>comando valor DD/MM</code>`,'msg-error');
    addChatMessage(`<span>${escapeHtml(text)}</span>`,'msg-user');
    return;
  }
  const result=await executeCommand(parsed.keyword,parsed.amount,text,parsed.date);
  if(!result.success){
    if(result.error==='not_found'){
      try{await showCreateCommandModal(result.keyword,result.amount,result.date);}catch(e){console.error('modal error',e);}
    }else{
      addChatMessage(`<strong>${result.message}</strong>`,'msg-error');
    }
    addChatMessage(`<span>${escapeHtml(text)}</span>`,'msg-user');
    return;
  }
  const{tx,balance}=result;
  addChatMessage(`<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.75rem"><div><div class="msg-tx-header"><span>${tx.type==='income'?'📈':'📉'} <strong>${tx.type==='income'?'Receita':'Despesa'}</strong></span><span class="msg-tx-category">${tx.category}</span></div><div class="msg-tx-amount ${tx.type}">${tx.type==='income'?'+':'-'} ${formatCurrency(tx.amount)}</div><div class="msg-tx-balance">Saldo: ${formatCurrency(balance)}</div><div class="msg-tx-date">${formatDate(tx.date)}</div></div><div style="display:flex;gap:0.3rem;flex-shrink:0"><button class="btn-sm" onclick="editTransaction(${tx.id})" title="Editar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button><button class="btn-sm danger" onclick="deleteTransaction(${tx.id})" title="Excluir">✕</button></div>`,'msg-tx '+tx.type);
  addChatMessage(`<span>${escapeHtml(text)}</span>`,'msg-user');
  renderChatBanner();
}

function parseCommand(text){
  text=text.trim();
  // /comando soma DD/MM  ou  /comando soma (hoje). Soma ex: "40,90+22" ou "10 + 5 + 2"
  const m=text.match(/^\/?([\p{L}\p{N}_]+)\s+(.+)$/u);
  if(!m)return null;
  const keyword=m[1].toLowerCase();
  let rest=m[2].trim();
  let date=todayLocal();
  // Data opcional no final: "15/03" ou "1503"
  const dm=rest.match(/^(.*?)\s+(\d{1,2})\/?(\d{1,2})?$/);
  if(dm){
    let day,month;
    if(dm[3]){day=parseInt(dm[2]);month=parseInt(dm[3]);}
    else{const s=dm[2].padStart(4,'0');day=parseInt(s.slice(0,2));month=parseInt(s.slice(2,4));}
    if(day>=1&&day<=31&&month>=1&&month<=12){
      rest=dm[1].trim();
      const now=new Date();let year=now.getFullYear();
      const parsed=new Date(year,month-1,day);
      if(parsed>now)year--;
      date=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    }
  }
  // Soma os termos separados por "+"
  const parts=rest.split('+');
  let amount=0;
  for(const p of parts){
    const n=parseFloat(p.replace(',','.').trim());
    if(isNaN(n)||n<=0)return null;
    amount+=n;
  }
  if(!parts.length||amount<=0)return null;
  return{keyword,amount:Math.round(amount*100)/100,date};
}

async function executeCommand(keyword,amount,rawText,cmdDate){
  let cmd;
  try{
    const all=await db.commands.toArray();
    cmd=all.find(c=>normalizeKey(c.keyword)===normalizeKey(keyword));
    if(!cmd){
      // Fallback: procura uma categoria com o mesmo nome
      const cats=await db.categories.toArray();
      const cat=cats.find(c=>normalizeKey(c.name)===normalizeKey(keyword));
      if(cat){
        cmd={keyword:cat.name,category:cat.name,type:cat.type};
      }else{
        return{success:false,error:'not_found',keyword,amount,date:cmdDate||todayLocal(),message:`"${keyword}" não encontrado.`};
      }
    }
  }catch(e){console.error('find command error',e);return{success:false,message:`Erro ao buscar "${keyword}": ${e.message}`};}
  if(!cmd)return{success:false,message:`Comando "${keyword}" não encontrado. Crie na aba Comandos.`};
  const tx={type:cmd.type,category:cmd.category,description:rawText,amount,date:cmdDate||todayLocal(),command:keyword,createdAt:new Date().toISOString()};
  try{tx.id=await db.transactions.add(tx);}catch(e){console.error('add tx error',e);return{success:false,message:`Erro ao salvar: ${e.message}`};}
  await refreshDashboard();scheduleBackup();
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
    addChatMessage(`<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.75rem"><div><div class="msg-tx-header"><span>${t.type==='income'?'📈':'📉'} <strong>${t.type==='income'?'Receita':'Despesa'}</strong></span><span class="msg-tx-category">${t.category}</span></div><div class="msg-tx-amount ${t.type}">${t.type==='income'?'+':'-'} ${formatCurrency(t.amount)}</div><div class="msg-tx-balance">Saldo: ${formatCurrency(balMap[t.date])}</div><div class="msg-tx-date">${formatDate(t.date)}</div></div><div style="display:flex;gap:0.3rem;flex-shrink:0"><button class="btn-sm" onclick="editTransaction(${t.id})" title="Editar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button><button class="btn-sm danger" onclick="deleteTransaction(${t.id})" title="Excluir">✕</button></div>`,'msg-tx '+t.type);
  }
  await renderChatBanner();
  scrollChatToTop();
}
function addChatMessage(html,cls){const d=document.createElement('div');d.className=cls;d.innerHTML=html;$('#chatMessages').prepend(d);}
function scrollChatToTop(){const c=$('#chatMessages');c.scrollTop=0;}
async function renderChatBanner(){
  const el=$('#chatAlertBanner');if(!el)return;
  try{
    const all=await db.transactions.toArray();
    const insts=await db.installments.toArray();
    const recs=await db.recurrings.toArray();
    const fixedAll=await db.fixedexpenses.toArray();
    const fixedPays=await db.fixedpayments.toArray();
    const balance=all.reduce((s,t)=>s+(t.type==='income'?t.amount:-t.amount),0);
    const now=new Date();
    const cur=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const paidSet=new Set(fixedPays.map(p=>p.expenseId+':'+p.monthKey));
    let total=0;
    // Parcelas com vencimento no mês atual
    for(const i of insts){
      if(i.paidInstallments>=i.installmentCount)continue;
      const first=new Date(i.firstInstallmentDate+'T12:00:00');
      for(let p=i.paidInstallments||0;p<i.installmentCount;p++){
        const d=new Date(first.getFullYear(),first.getMonth()+p,first.getDate());
        if(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`===cur){total+=i.installmentValue;break;}
      }
    }
    // Recorrentes ativas já iniciadas
    for(const r of recs){
      if(r.active&&r.startDate&&r.startDate.substring(0,7)<=cur){total+=r.amount;}
    }
    // Contas fixas ativas (exceto as já pagas no mês)
    for(const f of fixedAll){
      if(f.active&&!paidSet.has(f.id+':'+cur)){total+=f.amount;}
    }
    if(total<=0){el.style.display='none';return;}
    const monthName=MESES_EXT[now.getMonth()];
    el.style.display='block';
    el.innerHTML=`<div class="banner-line"><span class="banner-label">Saldo Atual</span><strong class="banner-value ${balance>=0?'banner-income':'banner-expense'}">${formatCurrency(balance)}</strong></div><div class="banner-line"><span class="banner-label">Saldo comprometido em ${monthName}</span><button class="btn-sm banner-btn" onclick="openFutureInstallmentsModal('all')">${formatCurrency(total)} →</button></div>`;
  }catch(e){console.error(e);}
}