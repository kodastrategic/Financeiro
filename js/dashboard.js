// ===== DASHBOARD =====
if(window.Chart){
  const fontFamily=typeof getComputedStyle==='function'?(getComputedStyle(document.body).fontFamily||"'Segoe UI',Roboto,sans-serif"):"'Segoe UI',Roboto,sans-serif";
  Chart.defaults.font.family=fontFamily;
  Chart.defaults.font.size=11;
  Chart.defaults.color='#6e6e73';
  Chart.defaults.borderColor='rgba(0,0,0,0.06)';
  Chart.defaults.plugins.tooltip.backgroundColor='rgba(28,28,30,0.94)';
  Chart.defaults.plugins.tooltip.titleColor='#ffffff';
  Chart.defaults.plugins.tooltip.bodyColor='#d1d1d6';
  Chart.defaults.plugins.tooltip.borderColor='rgba(0,0,0,0.12)';
  Chart.defaults.plugins.tooltip.borderWidth=1;
  Chart.defaults.plugins.tooltip.padding=10;
  Chart.defaults.plugins.tooltip.cornerRadius=10;
  Chart.defaults.plugins.tooltip.boxPadding=4;
  Chart.defaults.animation.duration=600;
  Chart.defaults.animation.easing='easeOutQuart';
  if(Chart.defaults.scales){const _sc=Chart.defaults.scales.linear;if(_sc&&_sc.grid)_sc.grid.color='rgba(0,0,0,0.06)';if(_sc&&_sc.ticks)_sc.ticks.color='#98989d';if(_sc&&_sc.border)_sc.border.display=false;}
  const _legendLabels=Chart.defaults.plugins.legend.labels||(Chart.defaults.plugins.legend.labels={});
  _legendLabels.usePointStyle=true;
  _legendLabels.boxWidth=8;
  _legendLabels.boxHeight=8;
}
async function refreshDashboard(){
  const tx=await db.transactions.toArray(),debts=await db.debts.toArray();
  await renderSummaryCards(tx,debts);destroyAllCharts();
  await renderChartBalanceLine(tx);renderChartExpenseCategory(tx);renderChartIncomeCategory(tx);
  renderChartMonthlyExpense(tx);renderChartIncomePeriod(tx);renderChartExpensePeriod(tx);
  renderChartInvestmentLine(tx);
  renderChartComparison(tx);
  renderChartTopExpense(tx);renderChartTopIncome(tx);
  await renderChartCashFlow(tx,debts);
  dashTx=tx;
  setupDashPeriodBadge();
  const catModal=$('#categoryModal');
  if(catModal&&catModal.classList.contains('show'))await renderCategoryModal();
  const typeModal=$('#typeModal');
  if(typeModal&&typeModal.classList.contains('show'))renderTypeModal();
}
function destroyAllCharts(){Object.values(charts).forEach(c=>c?.destroy());charts={};}
function makeChart(id,cfg){if(charts[id]){charts[id].destroy();delete charts[id];}const c=document.getElementById(id);if(!c)return null;charts[id]=new Chart(c,cfg);return charts[id];}
function barGradient(ctx,ca,t,b){if(!ca)return t;const g=ctx.createLinearGradient(0,ca.top,0,ca.bottom);g.addColorStop(0,t);g.addColorStop(1,b);return g;}
function barGradientHorizontal(ctx,ca,l,r){if(!ca)return l;const g=ctx.createLinearGradient(ca.left,0,ca.right,0);g.addColorStop(0,l);g.addColorStop(1,r);return g;}
function doughnutOptions(){
  return {responsive:true,plugins:{
    legend:{display:false},
    tooltip:{callbacks:{label:ctx=>{
      const total=ctx.dataset.data.reduce((s,v)=>s+v,0);
      const pct=total>0?Math.round((ctx.parsed||0)/total*100):0;
      return ` ${ctx.label}: ${formatCurrency(ctx.parsed||0)} (${pct}%)`;
    }}}
  }};
}
function attachPieLegend(chartId,labels,values,colors){
  const el=document.getElementById(chartId);
  const container=el?el.closest('.chart-container'):null;
  if(!container)return;
  let legend=container.querySelector('.pie-legend');
  if(!legend){legend=document.createElement('div');legend.className='pie-legend';container.appendChild(legend);}
  if(!labels||!labels.length){legend.innerHTML='';return;}
  const total=values.reduce((s,v)=>s+v,0);
  legend.innerHTML=labels.map((l,i)=>{
    const pct=total>0?Math.round(values[i]/total*100):0;
    return `<span class="legend-chip"><span class="legend-dot" style="background:${colors[i]}">${pct}%</span>${escapeHtml(l)}</span>`;
  }).join('');
}

async function renderSummaryCards(tx,debts){
  const filter=dashboardFilter,isAll=filter==='all';
  const thisMonth=currentMonthKey(),targetMonth=isAll?thisMonth:filter;
  const periodTx=filterTxByMonth(tx,targetMonth),cutoffTx=filterTxUpToMonth(tx,filter);
  const income=cutoffTx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const expense=cutoffTx.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const balance=income-expense;
  const monthIncome=periodTx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const monthExpense=periodTx.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const futureFixed=await getFutureMonthly();
  const futureFixedTotal=futureFixed.reduce((s,v)=>s+v,0);
  const totalDebt=debts.filter(d=>d.currentAmount>0).reduce((s,d)=>s+d.currentAmount,0);
  const avgIncome=getAvgMonthly(tx,'income',3),avgExpense=getAvgMonthly(tx,'expense',3);
  const projected=balance+avgIncome-avgExpense-(futureFixed[0]||0);
  const allFixed=await db.fixedexpenses.toArray();
  const overdueDebt=await getOverdueFixedTotal(allFixed);
  $('#dBalance').textContent=formatCurrency(balance);
  $('#dProjected').textContent=formatCurrency(projected);
  $('#dMonthIncome').textContent=formatCurrency(monthIncome);
  $('#dMonthExpense').textContent=formatCurrency(monthExpense);
  $('#dFutureInstallments').textContent=formatCurrency(futureFixedTotal);
  $('#dTotalDebt').textContent=formatCurrency(totalDebt);
  $('#dOverdueDebt').textContent=formatCurrency(overdueDebt);
  const fixedTotal=allFixed.filter(e=>e.active).reduce((s,e)=>s+e.amount,0);
  $('#dFixedExpenses').textContent=formatCurrency(fixedTotal);

  const budgets=await db.budgets.toArray();
  const alertsEl=$('#budgetAlerts');
  if(budgets.length){
    const monthTx=periodTx.filter(t=>t.type==='expense');
    const spentMap={};
    monthTx.forEach(t=>{spentMap[t.category]=(spentMap[t.category]||0)+t.amount;});
    let alertHtml='';
    for(const b of budgets){
      const spent=spentMap[b.category]||0;
      const pct=Math.round(spent/b.limit*100);
      if(pct>=80){
        const isDanger=pct>=100;
        alertHtml+=`<div class="card card-subtle" style="border-color:${isDanger?'rgba(239,68,68,0.3)':'rgba(245,158,11,0.3)'}"><span class="card-label">${isDanger?'🚨':'⚠️'} ${escapeHtml(b.category)}</span><span class="card-value" style="font-size:1.1rem;color:${isDanger?'var(--expense)':'#f59e0b'}">${formatCurrency(spent)} / ${formatCurrency(b.limit)}</span><div class="progress-bar" style="margin-top:0.3rem"><div class="progress-bar-fill ${isDanger?'progress-danger':'progress-warn'}" style="width:${Math.min(100,pct)}%"></div></div></div>`;
      }
    }
    if(alertHtml){alertsEl.innerHTML=alertHtml;alertsEl.style.display='grid';}
    else alertsEl.style.display='none';
  }else{alertsEl.style.display='none';}
}

function getAvgMonthly(tx,type,months){
  const now=new Date(),monthly={};
  for(let i=0;i<months;i++){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    monthly[key]=0;
  }
  for(const t of tx){
    if(t.type!==type)continue;
    const m=t.date.substring(0,7);
    if(monthly[m]!==undefined)monthly[m]+=t.amount;
  }
  const vals=Object.values(monthly).filter(v=>v>0);
  return vals.length?vals.reduce((s,v)=>s+v,0)/vals.length:0;
}

async function getFutureMonthly(){
  const exps=await db.fixedexpenses.toArray();
  const now=new Date(),map={};
  for(let i=0;i<12;i++){
    const d=new Date(now.getFullYear(),now.getMonth()+i+1,1);
    map[`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`]=0;
  }
  for(const f of exps){
    if(!f.active)continue;
    const st=f.startMonth||(f.createdAt?f.createdAt.substring(0,7):'');
    for(const key of Object.keys(map)){
      if(st&&key<st)continue;
      if(f.endMonth&&key>f.endMonth)continue;
      map[key]+=f.amount;
    }
  }
  return Object.values(map);
}

async function renderChartBalanceLine(tx){
  const base=dashboardFilter==='all'?tx:tx.filter(t=>t.date.slice(0,7)<=dashboardFilter);
  const sorted=[...base].sort((a,b)=>a.date.localeCompare(b.date));
  const daily={};let running=0;
  for(const t of sorted){running+=t.type==='income'?t.amount:-t.amount;daily[t.date]=running;}
  const dates=Object.keys(daily).sort(),vals=dates.map(d=>daily[d]);
  if(!dates.length){makeChart('chartBalanceLine',{type:'line',data:{labels:['Sem dados'],datasets:[{data:[0],borderColor:'rgba(0,0,0,0.1)'}]},options:{responsive:true,plugins:{legend:{display:false}}}});return;}
  const lastDate=new Date(dates[dates.length-1]+'T12:00:00'),lastVal=vals[vals.length-1];
  const avgIncome=getAvgMonthly(tx,'income',3),avgExpense=getAvgMonthly(tx,'expense',3);
  const months=await getFutureMonthly();
  const projDates=[],projVals=[];
  let projBalance=lastVal;
  for(let i=1;i<=12;i++){
    const d=new Date(lastDate.getFullYear(),lastDate.getMonth()+i,1);
    projDates.push(`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`);
    projBalance+=avgIncome-avgExpense-(months[i-1]||0);
    projVals.push(projBalance);
  }
  makeChart('chartBalanceLine',{
    type:'line',
    data:{
      labels:[...dates.map(d=>formatDateShort(d)),...projDates],
      datasets:[
        {label:'Real',data:vals,borderColor:'#818cf8',backgroundColor:'rgba(129,140,248,0.1)',fill:true,tension:0.4,pointRadius:2,borderWidth:2},
        {label:'Projetado',data:[...Array(vals.length-1).fill(null),lastVal,...projVals],borderColor:'#8b5cf6',backgroundColor:'rgba(139,92,246,0.05)',fill:true,tension:0.4,pointRadius:2,borderWidth:2,borderDash:[5,5]}
      ]
    },
    options:{responsive:true,plugins:{legend:{position:'bottom',labels:{font:{size:10}}}},scales:{y:{ticks:{callback:v=>formatCurrency(v)}}}}
  });
}

function renderChartExpenseCategory(tx){
  const groups={};
  for(const t of filterTxByMonth(tx,dashboardFilter).filter(t=>t.type==='expense'))groups[t.category]=(groups[t.category]||0)+t.amount;
  let labels=Object.keys(groups),data=Object.values(groups);
  const sorted=labels.map((l,i)=>({l,v:data[i]})).sort((a,b)=>b.v-a.v);
  labels=sorted.map(x=>x.l);data=sorted.map(x=>x.v);
  const colors=labels.map(l=>catColor(l));
  if(!labels.length){makeChart('chartExpenseCategory',{type:'doughnut',data:{labels:['Sem dados'],datasets:[{data:[1],backgroundColor:['rgba(0,0,0,0.06)'],borderWidth:0}]},options:doughnutOptions()});attachPieLegend('chartExpenseCategory',[]);return;}
  makeChart('chartExpenseCategory',{type:'doughnut',data:{labels,datasets:[{data,backgroundColor:colors,borderWidth:2,borderColor:'#ffffff'}]},options:doughnutOptions()});
  attachPieLegend('chartExpenseCategory',labels,data,colors);
}

function renderChartIncomeCategory(tx){
  const groups={};filterTxByMonth(tx,dashboardFilter).filter(t=>t.type==='income').forEach(t=>{groups[t.category]=(groups[t.category]||0)+t.amount;});
  let labels=Object.keys(groups),data=Object.values(groups);
  const sorted=labels.map((l,i)=>({l,v:data[i]})).sort((a,b)=>b.v-a.v);
  labels=sorted.map(x=>x.l);data=sorted.map(x=>x.v);
  const colors=labels.map(l=>catColor(l));
  if(!labels.length){makeChart('chartIncomeCategory',{type:'doughnut',data:{labels:['Sem dados'],datasets:[{data:[1],backgroundColor:['rgba(0,0,0,0.06)'],borderWidth:0}]},options:doughnutOptions()});attachPieLegend('chartIncomeCategory',[]);return;}
  makeChart('chartIncomeCategory',{type:'doughnut',data:{labels,datasets:[{data,backgroundColor:colors,borderWidth:2,borderColor:'#ffffff'}]},options:doughnutOptions()});
  attachPieLegend('chartIncomeCategory',labels,data,colors);
}

function renderChartMonthlyExpense(tx){
  if(dashboardFilter!=='all'){
    const target=dashboardFilter;
    const total=filterTxByMonth(tx,target).filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    if(total===0){makeChart('chartMonthlyExpense',{type:'bar',data:{labels:['Sem dados'],datasets:[{data:[0],backgroundColor:'rgba(0,0,0,0.06)'}]},options:{responsive:true,plugins:{legend:{display:false}}}});return;}
    makeChart('chartMonthlyExpense',{type:'bar',data:{labels:[formatMonthLabel(target)],datasets:[{label:'Despesas',data:[total],borderRadius:6,backgroundColor:ctx=>barGradient(ctx.chart.ctx,ctx.chart.chartArea,'#f87171','rgba(248,113,113,0.16)')}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{ticks:{callback:v=>formatCurrency(v)}}}}});
    return;
  }
  const monthly={};
  for(const t of tx.filter(t=>t.type==='expense')){const m=t.date.substring(0,7);monthly[m]=(monthly[m]||0)+t.amount;}
  const months=Object.keys(monthly).sort().slice(-12),values=months.map(m=>monthly[m]);
  if(!months.length){makeChart('chartMonthlyExpense',{type:'bar',data:{labels:['Sem dados'],datasets:[{data:[0],backgroundColor:'rgba(0,0,0,0.06)'}]},options:{responsive:true,plugins:{legend:{display:false}}}});return;}
  makeChart('chartMonthlyExpense',{type:'bar',data:{labels:months,datasets:[{label:'Despesas',data:values,borderRadius:6,backgroundColor:ctx=>barGradient(ctx.chart.ctx,ctx.chart.chartArea,'#f87171','rgba(248,113,113,0.16)')}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{ticks:{callback:v=>formatCurrency(v)}}}}});
}

function renderChartIncomePeriod(tx){
  if(dashboardFilter!=='all'){
    const target=dashboardFilter;
    const total=filterTxByMonth(tx,target).filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    if(total===0){makeChart('chartIncomePeriod',{type:'bar',data:{labels:['Sem dados'],datasets:[{data:[0],backgroundColor:'rgba(0,0,0,0.06)'}]},options:{responsive:true,plugins:{legend:{display:false}}}});return;}
    makeChart('chartIncomePeriod',{type:'bar',data:{labels:[formatMonthLabel(target)],datasets:[{label:'Entradas',data:[total],borderRadius:6,backgroundColor:ctx=>barGradient(ctx.chart.ctx,ctx.chart.chartArea,'#34d399','rgba(52,211,153,0.14)')}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{ticks:{callback:v=>formatCurrency(v)}}}}});
    return;
  }
  const periods={};tx.filter(t=>t.type==='income').forEach(t=>{const p=t.date.substring(0,7);periods[p]=(periods[p]||0)+t.amount;});
  const labels=Object.keys(periods).sort().slice(-12),values=labels.map(l=>periods[l]);
  if(!labels.length){makeChart('chartIncomePeriod',{type:'bar',data:{labels:['Sem dados'],datasets:[{data:[0],backgroundColor:'rgba(0,0,0,0.06)'}]},options:{responsive:true,plugins:{legend:{display:false}}}});return;}
  makeChart('chartIncomePeriod',{type:'bar',data:{labels,datasets:[{label:'Entradas',data:values,borderRadius:6,backgroundColor:ctx=>barGradient(ctx.chart.ctx,ctx.chart.chartArea,'#34d399','rgba(52,211,153,0.14)')}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{ticks:{callback:v=>formatCurrency(v)}}}}});
}

function renderChartExpensePeriod(tx){
  if(dashboardFilter!=='all'){
    const target=dashboardFilter;
    const total=filterTxByMonth(tx,target).filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    if(total===0){makeChart('chartExpensePeriod',{type:'bar',data:{labels:['Sem dados'],datasets:[{data:[0],backgroundColor:'rgba(0,0,0,0.06)'}]},options:{responsive:true,plugins:{legend:{display:false}}}});return;}
    makeChart('chartExpensePeriod',{type:'bar',data:{labels:[formatMonthLabel(target)],datasets:[{label:'Saídas',data:[total],borderRadius:6,backgroundColor:ctx=>barGradient(ctx.chart.ctx,ctx.chart.chartArea,'#f87171','rgba(248,113,113,0.12)')}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{ticks:{callback:v=>formatCurrency(v)}}}}});
    return;
  }
  const periods={};tx.filter(t=>t.type==='expense').forEach(t=>{const p=t.date.substring(0,7);periods[p]=(periods[p]||0)+t.amount;});
  const labels=Object.keys(periods).sort().slice(-12),values=labels.map(l=>periods[l]);
  if(!labels.length){makeChart('chartExpensePeriod',{type:'bar',data:{labels:['Sem dados'],datasets:[{data:[0],backgroundColor:'rgba(0,0,0,0.06)'}]},options:{responsive:true,plugins:{legend:{display:false}}}});return;}
  makeChart('chartExpensePeriod',{type:'bar',data:{labels,datasets:[{label:'Saídas',data:values,borderRadius:6,backgroundColor:ctx=>barGradient(ctx.chart.ctx,ctx.chart.chartArea,'#f87171','rgba(248,113,113,0.12)')}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{ticks:{callback:v=>formatCurrency(v)}}}}});
}

function renderChartInvestmentLine(tx){
  const base=dashboardFilter==='all'?tx:tx.filter(t=>t.date.slice(0,7)<=dashboardFilter);
  const inv=base.filter(t=>t.category==='Investimentos'),sorted=[...inv].sort((a,b)=>a.date.localeCompare(b.date));
  const daily={};let running=0;
  sorted.forEach(t=>{running+=t.type==='income'?t.amount:-t.amount;daily[t.date]=running;});
  const dates=Object.keys(daily).sort(),vals=dates.map(d=>daily[d]);
  if(!dates.length){makeChart('chartInvestmentLine',{type:'line',data:{labels:['Sem dados'],datasets:[{data:[0],borderColor:'rgba(0,0,0,0.1)'}]},options:{responsive:true,plugins:{legend:{display:false}}}});return;}
  makeChart('chartInvestmentLine',{type:'line',data:{labels:dates.map(d=>formatDateShort(d)),datasets:[{label:'Investimentos',data:vals,borderColor:'#8b5cf6',backgroundColor:'rgba(139,92,246,0.08)',fill:true,tension:0.4,pointRadius:3}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{ticks:{callback:v=>formatCurrency(v)}}}}});
}

function renderChartComparison(tx){
  if(dashboardFilter!=='all'){
    const target=dashboardFilter;
    const periodTx=filterTxByMonth(tx,target);
    const incomes=periodTx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const expenses=periodTx.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    if(!incomes&&!expenses){makeChart('chartComparison',{type:'bar',data:{labels:['Sem dados'],datasets:[{label:'Receitas',data:[0],backgroundColor:'rgba(0,0,0,0.06)'},{label:'Despesas',data:[0],backgroundColor:'rgba(0,0,0,0.06)'}]},options:{responsive:true,plugins:{legend:{display:false}}}});return;}
    makeChart('chartComparison',{type:'bar',data:{labels:[formatMonthLabel(target)],datasets:[{label:'Receitas',data:[incomes],borderRadius:4,backgroundColor:ctx=>barGradient(ctx.chart.ctx,ctx.chart.chartArea,'#34d399','rgba(52,211,153,0.14)')},{label:'Despesas',data:[expenses],borderRadius:4,backgroundColor:ctx=>barGradient(ctx.chart.ctx,ctx.chart.chartArea,'#f87171','rgba(248,113,113,0.12)')}]},options:{responsive:true,plugins:{legend:{position:'bottom',labels:{font:{size:10}}}},scales:{y:{ticks:{callback:v=>formatCurrency(v)}}}}});
    return;
  }
  const monthly={};
  tx.forEach(t=>{const m=t.date.substring(0,7);if(!monthly[m])monthly[m]={income:0,expense:0};monthly[m][t.type]+=t.amount;});
  const months=Object.keys(monthly).sort().slice(-12),incomes=months.map(m=>monthly[m].income),expenses=months.map(m=>monthly[m].expense);
  if(!months.length){makeChart('chartComparison',{type:'bar',data:{labels:['Sem dados'],datasets:[{label:'Receitas',data:[0],backgroundColor:'rgba(0,0,0,0.06)'},{label:'Despesas',data:[0],backgroundColor:'rgba(0,0,0,0.06)'}]},options:{responsive:true,plugins:{legend:{display:false}}}});return;}
  makeChart('chartComparison',{type:'bar',data:{labels:months,datasets:[{label:'Receitas',data:incomes,borderRadius:4,backgroundColor:ctx=>barGradient(ctx.chart.ctx,ctx.chart.chartArea,'#34d399','rgba(52,211,153,0.14)')},{label:'Despesas',data:expenses,borderRadius:4,backgroundColor:ctx=>barGradient(ctx.chart.ctx,ctx.chart.chartArea,'#f87171','rgba(248,113,113,0.12)')}]},options:{responsive:true,plugins:{legend:{position:'bottom',labels:{font:{size:10}}}},scales:{y:{ticks:{callback:v=>formatCurrency(v)}}}}});
}

function renderChartTopExpense(tx){
  const filtered=dashboardFilter==='all'?tx.filter(t=>t.type==='expense'):tx.filter(t=>t.type==='expense'&&t.date.startsWith(dashboardFilter));
  const groups={};filtered.forEach(t=>{groups[t.category]=(groups[t.category]||0)+t.amount;});
  const sorted=Object.entries(groups).sort((a,b)=>b[1]-a[1]);
  const labels=sorted.slice(0,8).map(e=>e[0]),values=sorted.slice(0,8).map(e=>e[1]),colors=labels.map(l=>catColor(l));
  if(!labels.length){makeChart('chartTopExpense',{type:'bar',data:{labels:['Sem dados'],datasets:[{data:[0],backgroundColor:'rgba(0,0,0,0.06)'}]},options:{responsive:true,indexAxis:'y',plugins:{legend:{display:false}}}});return;}
  makeChart('chartTopExpense',{type:'bar',data:{labels,datasets:[{data:values,borderRadius:4,backgroundColor:colors}]},options:{responsive:true,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{callback:v=>formatCurrency(v)}}}}});
}

function renderChartTopIncome(tx){
  const filtered=dashboardFilter==='all'?tx.filter(t=>t.type==='income'):tx.filter(t=>t.type==='income'&&t.date.startsWith(dashboardFilter));
  const groups={};filtered.forEach(t=>{groups[t.category]=(groups[t.category]||0)+t.amount;});
  const sorted=Object.entries(groups).sort((a,b)=>b[1]-a[1]);
  const labels=sorted.slice(0,8).map(e=>e[0]),values=sorted.slice(0,8).map(e=>e[1]),colors=labels.map(l=>catColor(l));
  if(!labels.length){makeChart('chartTopIncome',{type:'bar',data:{labels:['Sem dados'],datasets:[{data:[0],backgroundColor:'rgba(0,0,0,0.06)'}]},options:{responsive:true,indexAxis:'y',plugins:{legend:{display:false}}}});return;}
  makeChart('chartTopIncome',{type:'bar',data:{labels,datasets:[{data:values,borderRadius:4,backgroundColor:colors}]},options:{responsive:true,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{ticks:{callback:v=>formatCurrency(v)}}}}});
}

async function setupGlobalMonthFilter(){
  const sel=$('#globalMonthFilter');if(!sel)return;
  const tx=await db.transactions.toArray();
  const months=new Set(tx.map(t=>t.date.substring(0,7)));
  const cur=currentMonthKey();
  const sorted=[...months].filter(m=>m!==cur).sort().reverse();
  let html='<option value="all">📊 Todos os meses</option>';
  html+=`<option value="${cur}">📅 Mês Atual</option>`;
  for(const m of sorted)html+=`<option value="${m}">${formatMonthLabel(m)}</option>`;
  sel.innerHTML=html;
  dashboardFilter=cur;
  sel.value=dashboardFilter;
  sel.addEventListener('change',()=>{dashboardFilter=sel.value;refreshDashboard();});
}

async function renderChartCashFlow(tx,debts){
  const filter=dashboardFilter;
  const now=filter==='all'?new Date():new Date(parseInt(filter.split('-')[0]),parseInt(filter.split('-')[1])-1,1);
  const anchorKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const monthly={};
  for(let i=-3;i<12;i++){
    const d=new Date(now.getFullYear(),now.getMonth()+i,1);
    monthly[`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`]=0;
  }
  for(const t of tx){
    const m=t.date.substring(0,7);
    if(monthly[m]!==undefined)monthly[m]+=t.type==='income'?t.amount:-t.amount;
  }
  const future=await getFutureMonthly();
  const months=Object.keys(monthly).sort();
  const pastMonths=months.filter(m=>m<=anchorKey);
  const startBalance=pastMonths.reduce((s,m)=>s+monthly[m],0);
  let proj=startBalance;
  const projValues=[];
  for(let i=0;i<months.length;i++){
    if(months[i]>todayLocal().substring(0,7)){
      proj+=monthly[months[i]]-(future[i-(months.length-12)]||0);
    }
    projValues.push(monthly[months[i]]);
  }
  const cumulative=[];let cum=0;
  for(let i=0;i<months.length;i++){cum+=projValues[i];cumulative.push(cum);}
  const labels=months.map(m=>{const [y,mo]=m.split('-');return `${mo}/${y}`;});
  makeChart('chartCashFlow',{
    type:'bar',data:{labels,datasets:[
      {label:'Fluxo do Mês',data:projValues,borderRadius:4,backgroundColor:ctx=>{
        const v=ctx.raw||0;return v>=0?barGradient(ctx.chart.ctx,ctx.chart.chartArea,'#34d399','rgba(52,211,153,0.14)'):barGradient(ctx.chart.ctx,ctx.chart.chartArea,'#f87171','rgba(248,113,113,0.12)');
      }},
      {label:'Saldo Acumulado',data:cumulative,borderColor:'#818cf8',backgroundColor:'rgba(129,140,248,0.08)',fill:true,tension:0.4,pointRadius:2,type:'line',yAxisID:'y1'}
    ]},options:{
      responsive:true,plugins:{legend:{position:'bottom',labels:{font:{size:10}}}},
      scales:{y:{ticks:{callback:v=>formatCurrency(v)}},y1:{position:'right',ticks:{callback:v=>formatCurrency(v)},grid:{display:false}}}
    }
  });
}

function setupChartGlow(){
  document.querySelectorAll('.chart-container').forEach(el=>{
    el.style.setProperty('--glow-x','50%');el.style.setProperty('--glow-y','50%');
    el.addEventListener('mousemove',e=>{
      const r=el.getBoundingClientRect();
      el.style.setProperty('--glow-x',((e.clientX-r.left)/r.width)*100+'%');
      el.style.setProperty('--glow-y',((e.clientY-r.top)/r.height)*100+'%');
    });
  });
}

// ===== MODAL PROJECTED =====
async function openProjectedModal(){
  const tx=await db.transactions.toArray();
  const base=dashboardFilter==='all'?tx:tx.filter(t=>t.date.slice(0,7)<=dashboardFilter);
  const income=base.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  const expense=base.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
  const balance=income-expense;
  const avgIncome=getAvgMonthly(tx,'income',3),avgExpense=getAvgMonthly(tx,'expense',3);
  const monthly=await getFutureMonthly();
  const now=new Date();
  let html='<table class="projected-table"><thead><tr><th>Mês</th><th>Saldo Inicial</th><th>Receita Média</th><th>Despesa Média</th><th>Compromissos</th><th>Saldo Final</th></tr></thead><tbody>';
  let saldo=balance;
  const meses=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  for(let i=1;i<=12;i++){
    const d=new Date(now.getFullYear(),now.getMonth()+i,1);
    const label=`${meses[d.getMonth()]}/${d.getFullYear()}`;
    const comp=monthly[i-1]||0;
    const final=saldo+avgIncome-avgExpense-comp;
    const cls=final>=0?'projected-positive':'projected-negative';
    html+=`<tr><td>${label}</td><td>${formatCurrency(saldo)}</td><td>${formatCurrency(avgIncome)}</td><td>${formatCurrency(avgExpense)}</td><td>${formatCurrency(comp)}</td><td class="${cls}">${formatCurrency(final)}</td></tr>`;
    saldo=final;
  }
  html+='</tbody></table>';
  const info=`Saldo Atual: ${formatCurrency(balance)} | Média Receitas (3m): ${formatCurrency(avgIncome)} | Média Despesas (3m): ${formatCurrency(avgExpense)}`;
  $('#projectedInfo').textContent=info;
  $('#projectedBody').innerHTML=html;
  $('#projectedModal').classList.add('show');
}

// ===== MODAL FUTURE COMMITMENTS =====
async function openFutureInstallmentsModal(filter){
  filter=filter||'all';futureModalFilter=filter;
  const fixedAll=(await db.fixedexpenses.toArray()).filter(e=>e.active);
  const allFixedPayments=await db.fixedpayments.toArray();
  const paidFixed=new Set(allFixedPayments.map(p=>p.expenseId+':'+p.monthKey));
  const now=new Date();
  const currentKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const meses=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  const monthData={};
  for(const f of fixedAll){
    const st=f.startMonth||(f.createdAt?f.createdAt.substring(0,7):currentKey);
    const cursor=new Date(parseInt(st.split('-')[0]),parseInt(st.split('-')[1])-1,1);
    const lastCursor=f.endMonth?new Date(parseInt(f.endMonth.split('-')[0]),parseInt(f.endMonth.split('-')[1])-1,1):new Date(now.getFullYear(),now.getMonth()+12,1);
    while(cursor<=lastCursor){
      const key=`${cursor.getFullYear()}-${String(cursor.getMonth()+1).padStart(2,'0')}`;
      if(!monthData[key])monthData[key]={total:0,items:[]};
      monthData[key].items.push({type:'fixed',id:f.id,monthKey:key,description:f.name,detail:'📄 fixa',value:f.amount});
      monthData[key].total+=f.amount;
      cursor.setMonth(cursor.getMonth()+1);
    }
  }

  const infoEl=$('#futureInstallmentsInfo');
  const allMonths=Object.keys(monthData).sort();
  if(!allMonths.length){
    infoEl.innerHTML=`<div class="filter-bar"><span style="font-size:0.82rem;color:var(--text-muted)">Nenhum compromisso futuro cadastrado.</span></div>`;
    $('#futureInstallmentsBody').innerHTML='<p class="empty-state">Cadastre uma Conta Fixa com período (Início → Término, ex.: compra em 3 meses) para acompanhar aqui.</p>';
    $('#futureInstallmentsModal').classList.add('show');return;
  }

  const isPaidFixed=i=>paidFixed.has(i.id+':'+i.monthKey);
  const curMonthItems=(monthData[currentKey]?.items||[]);
  const curTotal=curMonthItems.filter(i=>!isPaidFixed(i)).reduce((s,i)=>s+i.value,0);
  let grandTotal=0,itemCount=0;
  for(const key of allMonths){
    const items=monthData[key].items.filter(i=>!isPaidFixed(i));
    grandTotal+=items.reduce((s,i)=>s+i.value,0);
    itemCount+=items.length;
  }
  const currentLabel=`${meses[parseInt(currentKey.split('-')[1])-1]}/${currentKey.split('-')[0]}`;
  infoEl.innerHTML=`<div class="filter-bar"><span style="font-size:0.82rem;color:var(--text-secondary)">Mês atual (<strong>${currentLabel}</strong>): <strong style="color:var(--expense)">${formatCurrency(curTotal)}</strong> · Horizonte (${allMonths.length} mês${allMonths.length!==1?'es':''}): ${formatCurrency(grandTotal)} (${itemCount} item${itemCount!==1?'s':''})</span></div>`;

  let html='';
  for(const key of allMonths){
    const [y,m]=key.split('-');
    const monthLabel=`${meses[parseInt(m)-1]}/${y}`;
    const filtered=monthData[key].items;
    const monthTotal=filtered.filter(i=>!isPaidFixed(i)).reduce((s,i)=>s+i.value,0);
    html+=`<div class="invoice-month">
      <div class="invoice-month-header">
        <span class="invoice-month-label">📆 ${monthLabel}</span>
        <span class="invoice-month-total">${formatCurrency(monthTotal)}</span>
      </div>
      <table class="detail-table" style="margin-top:0.3rem">
        <thead><tr><th>Descrição</th><th>Detalhe</th><th>Valor</th><th>Ação</th></tr></thead>
        <tbody>${filtered.map(i=>{
          const paid=isPaidFixed(i);
          const action=paid
            ? `<button class="btn-sm" style="background:rgba(34,197,94,0.12);color:var(--income);border-color:rgba(34,197,94,0.3)" onclick="toggleFutureFixed(${i.id},'${i.monthKey}')">✅ Paga</button>`
            : `<button class="btn-sm" style="background:rgba(245,158,11,0.15);color:#fbbf24;border-color:rgba(245,158,11,0.35)" onclick="toggleFutureFixed(${i.id},'${i.monthKey}')">💰 Pagar</button>`;
          return `<tr ${paid?'style="opacity:0.55"':''}><td>${i.description}</td><td>${i.detail}</td><td style="color:var(--expense)">${formatCurrency(i.value)}</td><td>${action}</td></tr>`;
        }).join('')}</tbody>
      </table>
    </div>`;
  }
  $('#futureInstallmentsBody').innerHTML=html;
  $('#futureInstallmentsModal').classList.add('show');
}

async function toggleFutureFixed(expenseId,monthKey){
  const exp=await db.fixedexpenses.get(expenseId);
  if(!exp)return;
  const existing=await db.fixedpayments.where({expenseId,monthKey}).first();
  if(existing){
    if(!confirm(`Desmarcar "${exp.name}" de ${monthKey.replace('-','/')}?\n\nA transação será removida e o saldo restituído.`))return;
    await db.fixedpayments.delete(existing.id);
    const txs=await db.transactions.filter(t=>t.fixedExpenseId===expenseId&&t.fixedMonthKey===monthKey).toArray();
    for(const t of txs)await db.transactions.delete(t.id);
  }else{
    if(!confirm(`Pagar "${exp.name}" (${formatCurrency(exp.amount)}) referente a ${monthKey.replace('-','/')}?`))return;
    await db.fixedpayments.add({expenseId,monthKey,createdAt:new Date().toISOString()});
    const tx={type:'expense',category:exp.category||'Contas Fixas',description:`${exp.name} (${monthKey.replace('-','/')})`,amount:exp.amount,date:todayLocal(),command:'contafixa',fixedExpenseId:expenseId,fixedMonthKey:monthKey,createdAt:new Date().toISOString()};
    await db.transactions.add(tx);
  }
  await openFutureInstallmentsModal(futureModalFilter);
  await refreshDashboard();await renderChatHistory();scrollChatToTop();scheduleBackup();
  showNotification(existing?`"${exp.name}" desmarcado.`:`✅ "${exp.name}" pago!`);
}

// ===== DASHBOARD V2: MODAL POR TIPO (receitas/despesas) =====
let typeModalCtx=null;

function setupTypeModal() {
  const debounce=(fn,ms=250)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};};
  const period=$('#typeModalPeriod');
  if(period)period.addEventListener('change',()=>renderTypeModal());
  const cat=$('#typeModalCategory');
  if(cat)cat.addEventListener('change',()=>renderTypeModal());
  const search=$('#typeModalSearch');
  if(search)search.addEventListener('input',debounce(()=>renderTypeModal()));
  const grid=$('#typeModalGrid');
  if(grid)grid.addEventListener('click',e=>{
    const card=e.target.closest('.category-card');
    if(card&&card.dataset.category)openCategoryModal(card.dataset.category,card.dataset.type);
  });
}

async function openTypeModal(type){
  typeModalCtx={type};
  $('#typeModalDot').style.background=pickColor(type);
  $('#typeModalTitle').textContent=type==='income'?'💰 Receitas':'💸 Despesas';
  const months=new Set(dashTx.map(t=>t.date.substring(0,7)));
  const sel=$('#typeModalPeriod');
  const defaultPeriod=(dashboardFilter!=='all'&&months.has(dashboardFilter))?dashboardFilter:'all';
  sel.innerHTML='<option value="all">📅 Todos os períodos</option>'+[...months].sort().reverse().map(m=>`<option value="${m}">${formatMonthLabel(m)}</option>`).join('');
  sel.value=defaultPeriod;
  const cats=window._allCategories||[];
  const catSel=$('#typeModalCategory');
  catSel.innerHTML='<option value="all">Todas as categorias</option>'+cats.filter(c=>c.type===type).map(c=>`<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('');
  catSel.value='all';
  $('#typeModalSearch').value='';
  renderTypeModal();
  $('#typeModal').classList.add('show');
}

function renderTypeModal(){
  if(!typeModalCtx)return;
  const{type}=typeModalCtx;
  const period=$('#typeModalPeriod').value,cat=$('#typeModalCategory').value;
  const q=($('#typeModalSearch').value||'').trim().toLowerCase();
  const tx=dashTx;
  const items=[],groups={};
  let grand=0;
  for(const t of tx){
    if(t.type!==type)continue;
    if(period!=='all'&&!t.date.startsWith(period))continue;
    if(cat!=='all'&&t.category!==cat)continue;
    if(q&&!`${t.description||''} ${t.category||''} ${t.command||''}`.toLowerCase().includes(q))continue;
    items.push({date:t.date,amount:t.amount,description:t.description||'',category:t.category,kind:'tx',id:t.id});
    groups[t.category]=(groups[t.category]||0)+t.amount;
    grand+=t.amount;
  }
  items.sort((a,b)=>b.date.localeCompare(a.date)||(b.id||0)-(a.id||0));
  renderTypeModalGrid(type,groups,grand);
  const infoEl=$('#typeModalInfo');
  if(infoEl){
    const periodLabel=period==='all'?'todos os períodos':formatMonthLabel(period);
    infoEl.textContent=`Total: ${formatCurrency(grand)} · ${items.length} lançamento${items.length!==1?'s':''} · ${periodLabel}`;
  }
  const body=$('#typeModalBody');
  if(!body)return;
  if(!items.length){body.innerHTML='<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:var(--text-muted)">Nenhum lançamento encontrado.</td></tr>';return;}
  const cats=window._allCategories||[];
  body.innerHTML=items.map(t=>{
    const c=cats.find(x=>x.name===t.category);
    const color=c?.color||pickColor(type);
    const actions=`<button class="btn-sm" onclick="editTransaction(${t.id})" title="Editar">✏️</button> <button class="btn-sm danger" onclick="deleteTransaction(${t.id})" title="Excluir">✕</button>`;
    return `<tr>
      <td>${formatDate(t.date)}</td>
      <td><span class="extract-cat"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span>${escapeHtml(t.category)}</span></td>
      <td class="extract-desc" title="${escapeHtml(t.description)}">${escapeHtml(t.description)}</td>
      <td style="text-align:right;color:${type==='income'?'var(--income)':'var(--expense)'}">${type==='income'?'+ ':'- '}${formatCurrency(t.amount)}</td>
      <td style="text-align:right">${actions}</td>
    </tr>`;
  }).join('');
}

function renderTypeModalGrid(type,groups,grand){
  const grid=$('#typeModalGrid');
  if(!grid)return;
  const cats=window._allCategories||[];
  const items=Object.entries(groups)
    .map(([name,total])=>{
      const c=cats.find(x=>x.name===name);
      return{name,total,color:c?.color||pickColor(type),pct:grand>0?Math.round(total/grand*100):0};
    })
    .sort((a,b)=>b.total-a.total);
  if(!items.length){
    grid.innerHTML=`<p style="grid-column:1/-1;text-align:center;color:var(--text-muted);font-size:0.82rem;padding:1rem">Nenhuma ${type==='income'?'receita':'despesa'} neste período.</p>`;
    return;
  }
  grid.innerHTML=items.map(item=>
    `<div class="category-card cat-${type}" style="--cat-color:${item.color};--cat-soft:${item.color}22" data-category="${escapeHtml(item.name)}" data-type="${type}">
      <div class="category-card-top">
        <span class="category-dot"></span>
        <span class="category-name">${escapeHtml(item.name)}</span>
        <span class="category-chev">›</span>
      </div>
      <div class="category-amount">${formatCurrency(item.total)}</div>
      <div class="category-extra">
        <span class="category-pct">${item.pct}%</span>
      </div>
      <div class="category-mini-bar"><div style="width:${Math.min(100,item.pct)}%"></div></div>
    </div>`).join('');
}

async function setupDashPeriodBadge(){
  const el=$('#dashPeriodBadge');if(!el)return;
  if(dashboardFilter==='all')el.textContent='📊 Todos os meses';
  else el.textContent=`📅 Período: ${formatMonthLabel(dashboardFilter)}`;
}

async function openCategoryModal(category,type){
  categoryModalCtx={category,type};
  const cat=await db.categories.get(category);
  const color=cat?.color||pickColor(type);
  $('#categoryModalDot').style.background=color;
  $('#categoryModalTitle').textContent=category;
  const months=new Set(dashTx.map(t=>t.date.substring(0,7)));
  const sel=$('#categoryModalPeriod');
  const defaultPeriod=(dashboardFilter!=='all'&&months.has(dashboardFilter))?dashboardFilter:'all';
  sel.innerHTML='<option value="all">📅 Todos os períodos</option>'+[...months].sort().reverse().map(m=>`<option value="${m}">${formatMonthLabel(m)}</option>`).join('');
  sel.value=defaultPeriod;
  await renderCategoryModal();
  $('#categoryModal').classList.add('show');
}

async function renderCategoryModal(){
  if(!categoryModalCtx)return;
  const{category,type}=categoryModalCtx;
  const period=$('#categoryModalPeriod').value;
  const tx=dashTx;
  const items=[],monthly={};
  for(const t of tx){
    if(t.type!==type||t.category!==category)continue;
    if(period!=='all'&&!t.date.startsWith(period))continue;
    items.push({date:t.date,amount:t.amount,description:t.description||'',kind:'tx',id:t.id});
    const m=t.date.substring(0,7);
    monthly[m]=(monthly[m]||0)+t.amount;
  }
  items.sort((a,b)=>b.date.localeCompare(a.date));
  const total=items.reduce((s,i)=>s+i.amount,0);
  const count=items.length;
  const periodLabel=period==='all'?'todos os períodos':formatMonthLabel(period);
  $('#categoryModalInfo').textContent=`Total: ${formatCurrency(total)} · ${count} lançamento${count!==1?'s':''} · ${periodLabel}`;
  const budgetEl=$('#categoryModalBudget');
  budgetEl.innerHTML='';
  if(type==='expense'){
    const budget=(await db.budgets.toArray()).find(b=>b.category===category);
    if(budget){
      const pct=Math.round(total/budget.limit*100);
      const cls=pct>=100?'progress-danger':pct>=80?'progress-warn':'progress-ok';
      budgetEl.innerHTML=`<div style="display:flex;justify-content:space-between;font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.2rem"><span>Orçamento: ${formatCurrency(budget.limit)}</span><span style="font-weight:700;color:${pct>=100?'var(--expense)':pct>=80?'#f59e0b':'var(--text-secondary)'}">${pct}%</span></div><div class="progress-bar"><div class="progress-bar-fill ${cls}" style="width:${Math.min(100,pct)}%"></div></div>`;
    }
  }
  const allMonths=Object.keys(monthly).sort();
  const chartMonths=allMonths.length>12?allMonths.slice(-12):allMonths;
  const chartData=chartMonths.map(m=>monthly[m]);
  const catColor=(await db.categories.get(category))?.color||pickColor(type);
  makeChart('categoryModalChart',{
    type:'bar',
    data:{labels:chartMonths.map(m=>formatMonthLabel(m)),datasets:[{data:chartData,backgroundColor:catColor+'cc',borderRadius:4,borderSkipped:false}]},
    options:{responsive:true,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>formatCurrency(ctx.parsed.y||0)}}},scales:{y:{display:false},x:{ticks:{font:{size:10},color:'#7e8590'},grid:{display:false}}}}
  });
  const itemsEl=$('#categoryModalItems');
  if(!items.length){itemsEl.innerHTML='<p class="empty-state">Nenhum lançamento encontrado.</p>';return;}
  itemsEl.innerHTML=items.map(i=>{
    const actions=`<button class="btn-sm" onclick="editTransaction(${i.id})" title="Editar">✏️</button><button class="btn-sm danger" onclick="deleteTransaction(${i.id})" title="Excluir">✕</button>`;
    return `<div class="cat-modal-item">
      <span class="cat-modal-item-date">${formatDate(i.date)}</span>
      <span class="cat-modal-item-desc">${escapeHtml(i.description)}</span>
      <span class="cat-modal-item-value" style="color:${type==='income'?'var(--income)':'var(--expense)'}">${type==='income'?'+ ':'- '}${formatCurrency(i.amount)}</span>
      ${actions}
    </div>`;
  }).join('');
}