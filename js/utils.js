// ===== UTILITIES =====
const COLORS_INCOME = ['#3b82f6','#22c55e','#8b5cf6','#06b6d4','#6366f1','#14b8a6','#a855f7','#0ea5e9','#10b981','#818cf8','#2dd4bf','#60a5fa','#34d399','#c084fc'];
const COLORS_EXPENSE = ['#ef4444','#f97316','#eab308','#ec4899','#dc2626','#f59e0b','#d946ef','#fb923c','#facc15','#f43f5e','#fdba74','#e11d48','#f87171','#c026d3'];
function pickColor(type){
  const used=new Set();
  const existing=window._allCategories||[];
  for(const c of existing)if(c.color)used.add(c.color);
  const pool=type==='income'?COLORS_INCOME:COLORS_EXPENSE;
  for(const c of pool)if(!used.has(c))return c;
  return pool[Math.floor(Math.random()*pool.length)];
}
function catColor(name){
  const c=window._allCategories?.find(x=>x.name===name);
  return c?.color||pickColor(c?.type||'expense');
}
function getDefaultColor(name){
  const s=SEED_CATEGORIES.find(c=>c.name===name);if(s)return s.color;
  return pickColor('expense');
}
function formatCurrency(v){return v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function formatDate(d){if(!d)return'';const[y,m,day]=d.split('-');return`${day}/${m}/${y}`;}
function formatDateShort(d){if(!d)return'';const[y,m,day]=d.split('-');return`${day}/${m}`;}
function formatDateTime(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0'),h=String(d.getHours()).padStart(2,'0'),mi=String(d.getMinutes()).padStart(2,'0'),s=String(d.getSeconds()).padStart(2,'0');return`${y}${m}${dd}_${h}${mi}${s}`;}
function escapeHtml(t){const d=document.createElement('div');d.textContent=t;return d.innerHTML;}
function showNotification(m){let n=document.querySelector('.notification');if(!n){n=document.createElement('div');n.className='notification';document.body.appendChild(n);}n.textContent=m;n.classList.add('show');clearTimeout(n._timeout);n._timeout=setTimeout(()=>n.classList.remove('show'),3000);}
function downloadFile(content,f,mime){const b=new Blob([content],{type:mime}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=f;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);}
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