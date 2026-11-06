// ===== CHAT =====
function setupChat(){
  const input=$('#chatInput'), send=$('#chatSend'), box=$('#autocompleteBox');
  let autoTimer;
  input.addEventListener('focus',()=>showAutocomplete(input,box));
  input.addEventListener('blur',()=>setTimeout(()=>hideAutocomplete(box),200));
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
  let filtered,prefix,isRecent=false;
  let counts={},lastUsed={};
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
    // Foco/vazio — 5 comandos usados mais recentemente
    isRecent=true;
    prefix='';
    const all=await db.transactions.toArray();
    for(const t of all){
      if(!t.command)continue;
      counts[t.command]=(counts[t.command]||0)+1;
      const ref=t.date||t.createdAt||'';
      if(!lastUsed[t.command]||ref>lastUsed[t.command])lastUsed[t.command]=ref;
    }
    const used=allEntries.filter(c=>counts[c.keyword]);
    used.sort((a,b)=>(lastUsed[b.keyword]||'').localeCompare(lastUsed[a.keyword]||'')||(counts[b.keyword]||0)-(counts[a.keyword]||0));
    filtered=used.slice(0,5);
  }
  filtered=filtered.slice(0,8);
  if(!filtered.length||text.includes(' ')){box.style.display='none';return;}
  box.innerHTML=(isRecent?'<div class="auto-label">Mais recentes</div>':'')+filtered.map(c=>`<div data-keyword="${c.keyword}" data-category="${c.category}" data-type="${c.type}" onclick="selectAutocompleteItem('${prefix}${c.keyword} ')">${prefix}${c.keyword} <span style="color:${c.type==='income'?'#34d399':'#f87171'};font-size:0.75rem">${c.category}${isRecent?` · ${formatDateShort(lastUsed[c.keyword]||'')}`:''}</span></div>`).join('');
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
  addChatMessage(transactionCardHTML(tx,balance),'msg-tx '+tx.type);
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
  const all=await db.transactions.toArray();
  const balance=calculateTransactionBalances(all).byId.get(String(tx.id))??0;
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
  const all=await db.transactions.toArray();
  const c=$('#chatMessages');c.innerHTML=`<div class="msg-system"><span>💡 Digite <strong>/entrada 500</strong> ou <strong>/saida 120</strong></span></div>`;
  const {sorted,byId}=calculateTransactionBalances(all);
  for(const t of sorted){
    addChatMessage(transactionCardHTML(t,byId.get(String(t.id))??0),'msg-tx '+t.type);
  }
  await renderChatBanner();
  scrollChatToTop();
}
function addChatMessage(html,cls){const d=document.createElement('div');d.className=cls;d.innerHTML=html;$('#chatMessages').prepend(d);}
function calculateTransactionBalances(transactions){
  const sorted=[...transactions].sort((a,b)=>String(a.date||'').localeCompare(String(b.date||''))||Number(a.id)-Number(b.id));
  const byId=new Map();
  let balance=0;
  for(const tx of sorted){
    balance+=tx.type==='income'?Number(tx.amount):-Number(tx.amount);
    byId.set(String(tx.id),balance);
  }
  return {sorted,byId};
}
function transactionCardHTML(tx,balance,txId=tx.id){
  const isIncome=tx.type==='income',id=Number(txId);
  const description=tx.description||tx.command||'';
  return `<div class="msg-tx-content">
    <div class="msg-tx-info">
      <div class="msg-tx-heading"><span class="msg-tx-type">${isIncome?'Receita':'Despesa'}</span><span class="msg-tx-category">${escapeHtml(tx.category||'Sem categoria')}</span></div>
      <div class="msg-tx-description">${escapeHtml(description)}</div>
      <div class="msg-tx-date">${formatDate(tx.date)}</div>
    </div>
    <div class="msg-tx-result">
      <div class="msg-tx-amount ${tx.type}">${isIncome?'+':'−'} ${formatCurrency(tx.amount)}</div>
      <div class="msg-tx-balance">Saldo após lançamento <strong>${formatCurrency(balance)}</strong></div>
    </div>
    <div class="msg-tx-actions">
      <button class="btn-sm msg-tx-edit" onclick="editTransaction(${id})" title="Editar" aria-label="Editar lançamento"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button>
      <button class="btn-sm danger msg-tx-delete" onclick="deleteTransaction(${id})" title="Excluir" aria-label="Excluir lançamento"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg></button>
    </div>
  </div>`;
}
function scrollChatToTop(){const c=$('#chatMessages');c.scrollTop=0;}
async function renderChatBanner(){
  const el=$('#chatAlertBanner');if(!el)return;
  try{
    const all=await db.transactions.toArray();
    const fixedAll=await db.fixedexpenses.toArray();
    const fixedPays=await db.fixedpayments.toArray();
    const balance=all.reduce((s,t)=>s+(t.type==='income'?t.amount:-t.amount),0);
    const now=new Date();
    const cur=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const paidSet=new Set(fixedPays.map(p=>p.expenseId+':'+p.monthKey));
    const overdueItems=await getOverdueFixedItems(fixedAll,paidSet,cur);
    const overdueTotal=overdueItems.reduce((sum,item)=>sum+item.exp.amount,0);
    let total=0;
    for(const f of fixedAll){
      if(!f.active)continue;
      const st=f.startMonth||(f.createdAt?f.createdAt.substring(0,7):cur);
      if(cur<st)continue;
      if(f.endMonth&&cur>f.endMonth)continue;
      if(!paidSet.has(f.id+':'+cur)){total+=f.amount;}
    }
    if(total<=0&&!overdueItems.length){el.style.display='none';return;}
    const monthName=MESES_EXT[now.getMonth()];
    const commitment=total>0?`<button type="button" class="banner-commitment" onclick="openFutureInstallmentsModal('current')" aria-label="Ver saldo comprometido em ${monthName} e abrir compromissos futuros">
        <span class="banner-commitment-icon" aria-hidden="true">📅</span>
        <span class="banner-commitment-copy">
          <span class="banner-commitment-title">Saldo comprometido</span>
          <span class="banner-commitment-hint">${monthName} · ver contas e pagar</span>
        </span>
        <span class="banner-commitment-side">
          <strong class="banner-commitment-value">${formatCurrency(total)}</strong>
          <svg class="banner-commitment-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
        </span>
      </button>`:'';
    const overdueCard=overdueItems.length?`<button type="button" class="banner-overdue" onclick="openOverdueFixedModal()" aria-label="Ver ${overdueItems.length} ${overdueItems.length===1?'conta atrasada':'contas atrasadas'}, total ${formatCurrency(overdueTotal)}">
        <span class="banner-overdue-icon" aria-hidden="true">!</span>
        <span class="banner-overdue-copy">
          <strong>${overdueItems.length} conta${overdueItems.length===1?'':'s'} em atraso</strong>
          <span>Total em atraso: ${formatCurrency(overdueTotal)}</span>
        </span>
        <svg class="banner-overdue-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
      </button>`:'';
    el.style.display='block';
    el.innerHTML=`<div class="banner-balance"><span class="banner-label">Saldo atual</span><strong class="banner-value ${balance>=0?'banner-income':'banner-expense'}">${formatCurrency(balance)}</strong></div>
      ${overdueCard}${commitment}`;
  }catch(e){console.error(e);}
}
