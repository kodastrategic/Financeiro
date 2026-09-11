// ===== GLOBALS & CORE HELPERS =====
// db é fornecido pelo supabase-config.js + js/db.js

const SEED_CATEGORIES = [
  // Income — cool tones (blues, greens, purples, teals, indigos)
  {name:'Salário',type:'income',color:'#3b82f6'},{name:'Freelance',type:'income',color:'#8b5cf6'},
  {name:'Investimentos',type:'income',color:'#22c55e'},{name:'Vendas',type:'income',color:'#06b6d4'},
  {name:'Prêmio',type:'income',color:'#6366f1'},{name:'Outras Receitas',type:'income',color:'#14b8a6'},
  // Expense — warm tones (reds, oranges, yellows, pinks, ambers)
  {name:'Alimentação',type:'expense',color:'#ef4444'},{name:'Contas Fixas',type:'expense',color:'#f97316'},
  {name:'Mercado',type:'expense',color:'#eab308'},{name:'Transporte',type:'expense',color:'#ec4899'},
  {name:'Lazer',type:'expense',color:'#dc2626'},{name:'Saúde',type:'expense',color:'#f59e0b'},
  {name:'Educação',type:'expense',color:'#d946ef'},{name:'Moradia',type:'expense',color:'#fb923c'},
  {name:'Assinaturas',type:'expense',color:'#facc15'},{name:'Impostos',type:'expense',color:'#f43f5e'},
  {name:'Emergência',type:'expense',color:'#fdba74'},{name:'Outras Despesas',type:'expense',color:'#e11d48'}
];

let charts={}, editingCategory=null, backupTimer=null, dashboardFilter='all', futureModalFilter='all';
let dashTx=[], dashInsts=[], categoryModalCtx=null;
let editingCard=null, editingInstallment=null, editingDebt=null;

const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const normalizeKey=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const todayLocal=()=>new Date().toLocaleDateString('en-CA');
const currentMonthKey=()=>{const n=new Date();return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;};
const formatMonthLabel=m=>{const[y,mo]=m.split('-');return `${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][parseInt(mo)-1]}/${y}`;};
const MESES_EXT=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function filterTxByMonth(tx,m){return m==='all'?tx:tx.filter(t=>t.date.startsWith(m));}
function filterTxUpToMonth(tx,m){return m==='all'?tx:tx.filter(t=>t.date.slice(0,7)<=m);}
function installmentsByCategoryInMonth(insts,m){
  const map={};
  for(const i of insts){
    if(i.paidInstallments>=i.installmentCount)continue;
    const first=new Date(i.firstInstallmentDate+'T12:00:00');
    for(let p=i.paidInstallments;p<i.installmentCount;p++){
      const d=new Date(first.getFullYear(),first.getMonth()+p,first.getDate());
      if(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`===m){map[i.category]=(map[i.category]||0)+i.installmentValue;break;}
    }
  }
  return map;
}
function installmentsTotalInMonth(insts,m){let s=0;for(const v of Object.values(installmentsByCategoryInMonth(insts,m)))s+=v;return s;}

function closeModal(id){$('#'+id).classList.remove('show');}