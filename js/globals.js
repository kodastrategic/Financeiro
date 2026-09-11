// ===== GLOBALS & CORE HELPERS =====
// db é fornecido pelo supabase-config.js + js/db.js

const SEED_CATEGORIES = [
  // Income — cool tones (blues, greens, purples, teals, indigos)
  {name:'Salário',type:'income',color:'#818cf8'},{name:'Freelance',type:'income',color:'#8b5cf6'},
  {name:'Investimentos',type:'income',color:'#34d399'},{name:'Vendas',type:'income',color:'#06b6d4'},
  {name:'Prêmio',type:'income',color:'#6366f1'},{name:'Outras Receitas',type:'income',color:'#14b8a6'},
  // Expense — warm tones (reds, oranges, yellows, pinks, ambers)
  {name:'Alimentação',type:'expense',color:'#f87171'},{name:'Contas Fixas',type:'expense',color:'#fb923c'},
  {name:'Mercado',type:'expense',color:'#fbbf24'},{name:'Transporte',type:'expense',color:'#f472b6'},
  {name:'Lazer',type:'expense',color:'#fb7185'},{name:'Saúde',type:'expense',color:'#f59e0b'},
  {name:'Educação',type:'expense',color:'#c084fc'},{name:'Moradia',type:'expense',color:'#fb923c'},
  {name:'Assinaturas',type:'expense',color:'#facc15'},{name:'Impostos',type:'expense',color:'#f43f5e'},
  {name:'Emergência',type:'expense',color:'#fdba74'},{name:'Outras Despesas',type:'expense',color:'#f87171'}
];

let charts={}, editingCategory=null, backupTimer=null, dashboardFilter='all', futureModalFilter='all';
let dashTx=[], categoryModalCtx=null;
let editingDebt=null;

const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const normalizeKey=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const todayLocal=()=>new Date().toLocaleDateString('en-CA');
const currentMonthKey=()=>{const n=new Date();return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;};
const formatMonthLabel=m=>{const[y,mo]=m.split('-');return `${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][parseInt(mo)-1]}/${y}`;};
const MESES_EXT=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function filterTxByMonth(tx,m){return m==='all'?tx:tx.filter(t=>t.date.startsWith(m));}
function filterTxUpToMonth(tx,m){return m==='all'?tx:tx.filter(t=>t.date.slice(0,7)<=m);}

function closeModal(id){$('#'+id).classList.remove('show');}