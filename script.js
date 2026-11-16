const $=s=>document.querySelector(s),KEY='printflow_pro_v1',DAY=864e5;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* ---------- FIFO Queue (array-backed; stores job IDs) ---------- */
class Queue{constructor(a=[]){this.items=a}
 enqueue(x){this.items.push(x)}                      // O(1) add at rear
 dequeue(){return this.isEmpty()?null:this.items.shift()} // remove from front
 peek(){return this.isEmpty()?null:this.items[0]}
 display(){return[...this.items]}                    // O(n)
 isEmpty(){return this.items.length===0}
 size(){return this.items.length}}
/* ---------- State + LocalStorage ---------- */
function demo(){const t=Date.now();return{jobs:[['P001','Student A','Assignment.pdf',10],['P002','Student B','Project.docx',25],['P003','Student C','Notes.pdf',15]].map(([id,name,doc,pages],i)=>({id,name,doc,pages,copies:1,type:'Black and White',size:'A4',priority:'Normal',status:'Pending',submitted:t-(3-i)*6e4})),queue:['P001','P002','P003'],active:null,printer:'Online',counter:3,processed:0}}
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));return s&&s.jobs?s:demo()}catch{return demo()}}
let S=load(),Q=new Queue(S.queue),charts={},page='dashboard',hist={q:'',st:'All',date:'',sort:'desc'},oplog='',flash=null,done='All';
const save=()=>{S.queue=Q.items;try{localStorage.setItem(KEY,JSON.stringify(S))}catch{}};
const J=id=>S.jobs.find(j=>j.id===id),fmt=t=>t?new Date(t).toLocaleString([],{dateStyle:'medium',timeStyle:'short'}):'-';
const dur=j=>Math.max(5000,j.pages*j.copies*700),pstat=()=>S.active&&S.printer==='Online'?'Printing':S.printer;
function toast(m,t='ok'){const e=document.createElement('div');e.className='toast '+t;e.textContent=m;$('#toasts').append(e);setTimeout(()=>e.remove(),3200)}
/* ---------- Queue operations ---------- */
function enqueue(j){S.jobs.push(j);Q.enqueue(j.id);flash=j.id;save()}
function startNext(){
 if(S.printer!=='Online')return toast('Printer is '+S.printer+'. Set it Online first.','err');
 if(S.active)return toast('Finish or cancel the active job first.','warn');
 if(Q.isEmpty())return toast('Queue is empty. Nothing to print.','warn');
 const id=Q.dequeue(),j=J(id);j.status='Printing';j.startedAt=Date.now();S.active=id;save();toast(id+' moved to active printing');go('active')}
function peek(){const id=Q.peek();if(!id){oplog='PEEK → queue is empty';toast('Queue is empty','warn')}else{oplog=`PEEK → front is ${id} (${J(id).doc})`;toast('Next job: '+id)}render()}
function showQ(){oplog=Q.isEmpty()?'DISPLAY → [ ] (isEmpty = true)':`DISPLAY → front [ ${Q.display().join(' → ')} ] rear  | size = ${Q.size()}`;render()}
function finish(ok){const j=J(S.active);if(!j)return;j.status=ok?'Completed':'Cancelled';j.completed=Date.now();if(ok)S.processed++;S.active=null;save();toast(j.id+(ok?' completed':' cancelled'),ok?'ok':'warn');go(ok?'completed':'history')}
async function clearQ(){if(Q.isEmpty())return toast('Queue is already empty','warn');if(!confirm('Cancel all '+Q.size()+' pending jobs?'))return;while(!Q.isEmpty()){const j=J(Q.dequeue());j.status='Cancelled';j.completed=Date.now()}save();toast('Queue cleared');render()}
/* ---------- Helpers ---------- */
const badge=s=>`<span class="badge ${s}">${s}</span>`;
const empty=(m,ic='inbox')=>`<div class="empty"><i data-lucide="${ic}"></i><p>${m}</p></div>`;
function table(list,cols,act){if(!list.length)return empty('No jobs to show here yet.','file-x');
 return`<div class="scroll"><table><tr>${cols.map(c=>`<th>${c[0]}</th>`).join('')}${act?'<th></th>':''}</tr>${list.map(j=>`<tr>${cols.map(c=>`<td>${c[1](j)}</td>`).join('')}${act?`<td><button class="btn" onclick="detail('${j.id}')">Details</button></td>`:''}</tr>`).join('')}</table></div>`}
const C={id:['Job ID',j=>`<b>${j.id}</b>`],name:['Student',j=>esc(j.name)],doc:['Document',j=>esc(j.doc)],pg:['Pages',j=>j.pages],cp:['Copies',j=>j.copies],ty:['Print Type',j=>j.type],st:['Status',j=>badge(j.status)],sub:['Submitted',j=>fmt(j.submitted)],cmp:['Completed',j=>fmt(j.completed)],pr:['Priority',j=>j.priority==='Urgent'?badge('Urgent'):'Normal']};
function qCards(max){const ids=Q.display().slice(0,max||99);if(!ids.length)return empty('The queue is empty. Submit a print request to get started.','printer');
 return`<div class="q">${ids.map((id,i)=>{const j=J(id),n=Q.size();return`<div class="jc ${i===0?'next':''} ${id===flash?'new':''} ${oplog.includes('PEEK → front is '+id)?'hl':''}">${i===0?'<span class="tag">FRONT</span>':''}${i===n-1?'<span class="tag r">REAR</span>':''}<span class="ord">#${i+1}</span><b>${id}</b><small>${esc(j.name)}</small><small>${esc(j.doc)}</small><small>${j.pages} pg × ${j.copies}</small>${j.priority==='Urgent'?badge('Urgent'):''}</div>`}).join('')}</div>`}
function printer(){const s=pstat();return`<div class="row"><span class="badge ${s}">${s}</span><span style="color:var(--t2)">Main Printer</span></div>`}
const stats=()=>{const c=s=>S.jobs.filter(j=>j.status===s).length;return{total:S.jobs.length,pend:Q.size(),act:S.active?1:0,done:c('Completed'),canc:c('Cancelled')}};
function days(){const a=[];for(let i=6;i>=0;i--){const d=new Date(Date.now()-i*DAY);d.setHours(0,0,0,0);a.push(d.getTime())}return a}
const dayIdx=(t,ds)=>ds.findIndex(d=>t>=d&&t<d+DAY);
function chart(id,cfg){const e=document.getElementById(id);if(!e||!window.Chart)return;charts[id]&&charts[id].destroy();cfg.options={responsive:true,maintainAspectRatio:false,...cfg.options};charts[id]=new Chart(e,cfg)}
function activityData(){const ds=days(),sub=ds.map(()=>0),pg=ds.map(()=>0);S.jobs.forEach(j=>{let i=dayIdx(j.submitted,ds);if(i>=0)sub[i]++;i=dayIdx(j.completed||0,ds);if(i>=0&&j.status==='Completed')pg[i]+=j.pages*j.copies});return{labels:ds.map(d=>new Date(d).toLocaleDateString([],{weekday:'short'})),sub,pg}}
function drawCharts(){const a=activityData(),bar={type:'bar',data:{labels:a.labels,datasets:[{label:'Requests',data:a.sub,backgroundColor:'#2563EB',borderRadius:8}]},options:{plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0}}}}};
 chart('c1',bar);const s=stats();
 chart('c2',{type:'doughnut',data:{labels:['Completed','Pending','Printing','Cancelled'],datasets:[{data:[s.done,s.pend,s.act,s.canc],backgroundColor:['#16A34A','#F59E0B','#2563EB','#EF4444']}]},options:{cutout:'65%'}});
 chart('c3',{type:'line',data:{labels:a.labels,datasets:[{label:'Pages printed',data:a.pg,borderColor:'#2563EB',backgroundColor:'rgba(37,99,235,.12)',fill:true,tension:.35}]},options:{scales:{y:{beginAtZero:true}}}})}
/* ---------- Pages ---------- */
const PAGES={
dashboard:{t:'Dashboard Overview',h(){const s=stats(),card=(ic,l,v)=>`<div class="card stat"><div class="ic"><i data-lucide="${ic}"></i></div><div><b>${v}</b><span>${l}</span></div></div>`;
 return`<p class="sub">Welcome back! Manage your printing operations efficiently.</p><div class="grid g4">${card('files','Total Print Jobs',s.total)}${card('clock','Pending Jobs',s.pend)}${card('printer','Currently Printing',s.act)}${card('check-circle-2','Completed Jobs',s.done)}</div>
 <div class="grid g2" style="margin-top:18px"><div class="card"><h3>Live Queue Preview<a href="#queue">View all</a></h3>${qCards(4)}</div><div class="card"><h3>Printer Availability</h3>${printer()}<p style="margin-top:12px;color:var(--t2)">Current job: ${S.active?S.active+' ('+esc(J(S.active).doc)+')':'None'}</p>
 <h3 style="margin-top:22px">Quick Actions</h3><div class="row"><button class="btn pri" onclick="go('new')">Create Print Request</button><button class="btn" onclick="go('queue')">View Print Queue</button><button class="btn" onclick="startNext()">Start Next Print</button><button class="btn" onclick="go('history')">View Print History</button></div></div></div>
 <div class="grid g2" style="margin-top:18px"><div class="card"><h3>Recent Print Requests</h3>${table([...S.jobs].reverse().slice(0,5),[C.id,C.name,C.doc,C.pg,C.st])}</div><div class="card"><h3>Printing Activity</h3><div class="chart"><canvas id="c1"></canvas></div></div></div>`},after:()=>drawCharts()},
new:{t:'Submit New Print Request',h:()=>`<form class="card" id="f" novalidate><div class="f">
 <label class="l">Student Name<input name="name" required></label><label class="l">Document Name<input name="doc" required></label>
 <label class="l full">Upload Document<input type="file" name="file" accept=".pdf,.doc,.docx,.txt"></label>
 <label class="l">Number of Pages<input type="number" name="pages" min="1" value="1" required></label><label class="l">Number of Copies<input type="number" name="copies" min="1" value="1" required></label>
 <label class="l">Print Type<select name="type"><option>Black and White</option><option>Color</option></select></label><label class="l">Paper Size<select name="size"><option>A4</option><option>A3</option><option>Letter</option></select></label>
 <label class="l">Priority<select name="priority"><option>Normal</option><option>Urgent</option></select></label></div><p id="err" style="color:var(--bad);margin:12px 0"></p><button class="btn pri" type="submit">Submit Print Request</button></form>`,
 after(){const f=$('#f');f.file.onchange=()=>{const n=f.file.files[0]?.name;if(n&&!f.doc.value)f.doc.value=n};f.onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(f)),p=+d.pages,c=+d.copies;
 if(!d.name.trim()||!d.doc.trim())return $('#err').textContent='Student name and document name are required.';
 if(!(p>=1)||!(c>=1)||!Number.isInteger(p)||!Number.isInteger(c))return $('#err').textContent='Pages and copies must be whole numbers of at least 1.';
 let id;do{id='P'+String(++S.counter).padStart(3,'0')}while(J(id));
 enqueue({id,name:d.name.trim(),doc:d.doc.trim(),pages:p,copies:c,type:d.type,size:d.size,priority:d.priority,status:'Pending',submitted:Date.now()});toast(id+' submitted and added to the rear of the queue');go('queue')}}},
queue:{t:'Print Queue',h:()=>`<div class="card"><h3>FIFO Print Queue<span class="badge">${Q.size()} waiting</span></h3><p class="sub" style="margin-bottom:0">First In, First Out: new jobs join at the rear, printing starts from the front.</p>${qCards()}
 <div class="row"><button class="btn pri" onclick="startNext()"><i data-lucide="play"></i>Start Next Print</button><button class="btn" onclick="peek()"><i data-lucide="eye"></i>Peek Next Job</button><button class="btn" onclick="showQ()"><i data-lucide="list"></i>Display Queue</button><button class="btn dng" onclick="clearQ()"><i data-lucide="trash-2"></i>Clear Queue</button></div>
 <div class="log">${esc(oplog||'Run an operation to see its result here.')}</div></div>
 <div class="card" style="margin-top:18px"><h3>Queue operations</h3><div class="scroll"><table><tr><th>Operation</th><th>Action</th><th>Complexity</th></tr><tr><td>ENQUEUE</td><td>Add request at the rear</td><td>O(1)</td></tr><tr><td>DEQUEUE</td><td>Remove front request to active printing</td><td>O(1) amortized</td></tr><tr><td>PEEK</td><td>View next waiting job</td><td>O(1)</td></tr><tr><td>DISPLAY</td><td>List all pending requests</td><td>O(n)</td></tr><tr><td>ISEMPTY</td><td>Check whether the queue is empty</td><td>O(1)</td></tr></table></div></div>`},
active:{t:'Active Printing',h(){const j=S.active&&J(S.active);if(!j)return`<div class="card">${empty('No job is printing. Start the next job from the queue.','printer')}<div class="row" style="justify-content:center"><button class="btn pri" onclick="startNext()">Start Next Print</button></div></div>`;
 return`<div class="card"><h3>${j.id} · ${esc(j.doc)}${badge('Printing')}</h3><p>Student: <b>${esc(j.name)}</b> &nbsp; Pages: <b>${j.pages}</b> × ${j.copies} copies &nbsp; ${j.type}, ${j.size}</p><div class="bar" style="margin:18px 0 8px"><i id="pb"></i></div><p id="pt" style="color:var(--t2);margin-bottom:18px"></p><div class="row"><button class="btn pri" onclick="finish(true)">Complete Print</button><button class="btn dng" onclick="if(confirm('Cancel this job?'))finish(false)">Cancel Job</button></div></div>`},after:()=>tick()},
completed:{t:'Completed Print Jobs',h(){const l=S.jobs.filter(j=>j.status==='Completed'&&(done==='All'||j.completed>Date.now()-(done==='Today'?DAY:7*DAY)));
 return`<div class="card"><h3>Completed Jobs<span class="row">${['All','Today','This Week'].map(f=>`<button class="btn ${done===f?'pri':''}" onclick="done='${f}';render()">${f}</button>`).join('')}</span></h3>${table(l,[C.id,C.name,C.doc,C.pg,C.cp,C.ty,C.cmp,C.st])}</div>`}},
history:{t:'Print History',h(){const k=hist,q=k.q.toLowerCase();let l=S.jobs.filter(j=>(!q||j.id.toLowerCase().includes(q)||j.name.toLowerCase().includes(q))&&(k.st==='All'||j.status===k.st)&&(!k.date||new Date(j.submitted).toLocaleDateString('en-CA')===k.date));
 l.sort((a,b)=>k.sort==='asc'?a.submitted-b.submitted:b.submitted-a.submitted);
 return`<div class="card"><div class="row" style="margin-bottom:14px"><input id="hq" placeholder="Job ID or student" value="${esc(k.q)}"><select id="hs">${['All','Pending','Printing','Completed','Cancelled'].map(s=>`<option ${k.st===s?'selected':''}>${s}</option>`).join('')}</select><input type="date" id="hd" value="${k.date}"><button class="btn" id="ho">Sort: ${k.sort==='asc'?'Oldest':'Newest'} first</button><button class="btn" onclick="csv()" style="margin-left:auto"><i data-lucide="download"></i>Export CSV</button></div>${table(l,[C.id,C.name,C.doc,C.pg,C.st,C.sub],1)}</div>`},
 after(){$('#hq').oninput=e=>{hist.q=e.target.value;render();const i=$('#hq');i.focus();i.setSelectionRange(99,99)};$('#hs').onchange=e=>{hist.st=e.target.value;render()};$('#hd').onchange=e=>{hist.date=e.target.value;render()};$('#ho').onclick=()=>{hist.sort=hist.sort==='asc'?'desc':'asc';render()}}},
reports:{t:'Reports and Analytics',h(){const s=stats(),pr=S.jobs.length?(S.jobs.reduce((a,j)=>a+j.pages,0)/S.jobs.length).toFixed(1):0,c=(l,v)=>`<div class="card stat"><div><b>${v}</b><span>${l}</span></div></div>`;
 return`<div class="grid g4">${c('Total requests',s.total)}${c('Completed',s.done)}${c('Pending',s.pend)}${c('Cancelled',s.canc)}</div><p class="sub" style="margin:14px 0">Average pages per request: <b>${pr}</b></p><div class="grid g3"><div class="card"><h3>Daily Print Activity</h3><div class="chart"><canvas id="c1"></canvas></div></div><div class="card"><h3>Job Status Distribution</h3><div class="chart"><canvas id="c2"></canvas></div></div><div class="card"><h3>Weekly Printing Trends</h3><div class="chart"><canvas id="c3"></canvas></div></div></div>`},after:()=>drawCharts()},
printers:{t:'Printer Management',h:()=>`<div class="card"><h3>Main Printer ${printer()}</h3><p>Current job: <b>${S.active?S.active:'None'}</b> &nbsp; Total jobs processed: <b>${S.processed}</b> &nbsp; Available: <b>${pstat()==='Online'?'Yes':'No'}</b></p><div class="row" style="margin-top:16px">${['Online','Offline','Out of Paper','Maintenance'].map(s=>`<button class="btn ${s==='Online'?'pri':''}" onclick="setP('${s}')">${s==='Online'||s==='Offline'?'Set '+s:s}</button>`).join('')}</div></div>`},
settings:{t:'Settings',h:()=>`<div class="card"><h3>Data</h3><p class="sub">Everything is stored in this browser's LocalStorage.</p><div class="row"><button class="btn" onclick="csv()">Export history as CSV</button><button class="btn" onclick="if(confirm('Replace all data with the three demo jobs?')){S=demo();Q=new Queue(S.queue);save();toast('Demo data restored');go('dashboard')}">Reset demo data</button><button class="btn dng" onclick="if(confirm('Delete every job?')){S=demo();S.jobs=[];S.queue=[];S.counter=0;Q=new Queue();save();toast('All data cleared','warn');go('dashboard')}">Clear all data</button></div></div>`}};
const NAV=[['dashboard','Dashboard','layout-dashboard'],['new','New Print Request','file-plus'],['queue','Print Queue','list-ordered'],['active','Active Printing','printer'],['completed','Completed Jobs','check-circle-2'],['history','Print History','history'],['reports','Reports and Analytics','bar-chart-3'],['printers','Printer Management','settings-2'],['settings','Settings','settings']];
/* ---------- Actions ---------- */
function setP(s){if(s!=='Online'&&S.active)return toast('Complete or cancel the active job first.','err');S.printer=s;save();toast('Printer set to '+s);render()}
function detail(id){const j=J(id);$('#dlg').innerHTML=`<h3>${j.id} ${badge(j.status)}</h3>${[['Student',esc(j.name)],['Document',esc(j.doc)],['Pages × copies',j.pages+' × '+j.copies],['Type / size',j.type+' / '+j.size],['Priority',j.priority],['Submitted',fmt(j.submitted)],['Completed',fmt(j.completed)]].map(r=>`<p>${r[0]}: <b>${r[1]}</b></p>`).join('')}<div class="row" style="margin-top:14px"><button class="btn pri" onclick="$('#dlg').close()">Close</button></div>`;$('#dlg').showModal()}
function csv(){const h=['Job ID','Student','Document','Pages','Copies','Type','Size','Priority','Status','Submitted','Completed'],q=v=>`"${String(v).replace(/"/g,'""')}"`;
 const rows=S.jobs.map(j=>[j.id,j.name,j.doc,j.pages,j.copies,j.type,j.size,j.priority,j.status,j.submitted?new Date(j.submitted).toISOString():'',j.completed?new Date(j.completed).toISOString():''].map(q).join(','));
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([[h.join(','),...rows].join('\n')],{type:'text/csv'}));a.download='print-history.csv';a.click();toast('CSV exported')}
function tick(){const j=S.active&&J(S.active),b=$('#pb');if(!j||!b)return;const el=Date.now()-j.startedAt,p=Math.min(100,el/dur(j)*100);b.style.width=p+'%';$('#pt').textContent=Math.round(p)+'% · '+(p>=100?'Ready to complete':'about '+Math.ceil((dur(j)-el)/1000)+'s remaining')}
setInterval(tick,500);
/* ---------- Router ---------- */
function go(p){location.hash=p;if(page===p)render()}
function render(){const p=PAGES[page];if(!p)return;Object.values(charts).forEach(c=>c.destroy());charts={};
 $('#title').textContent=p.t;$('#crumb').textContent='PrintFlow Pro / '+p.t;$('#view').innerHTML=p.h();
 $('#nav').innerHTML=NAV.map(n=>`<a href="#${n[0]}" class="${n[0]===page?'on':''}"><i data-lucide="${n[2]}"></i>${n[1]}${n[0]==='queue'&&Q.size()?`<span class="n">${Q.size()}</span>`:''}</a>`).join('');
 $('#dot').style.display=Q.size()?'block':'none';p.after&&p.after();lucide.createIcons();flash=null}
function route(){const h=location.hash.slice(1);$('#side').classList.remove('open');
 if(h==='help')return $('#dlg').innerHTML='<h3>Help and Support</h3><p>1. Submit a request: it joins the rear of the queue.</p><p>2. Start Next Print: the front job moves to Active Printing.</p><p>3. Complete Print: the job moves to Completed Jobs and History.</p><p>Jobs are always printed in the order they arrived (FIFO).</p><div class="row" style="margin-top:14px"><button class="btn pri" onclick="$(\'#dlg\').close()">Got it</button></div>',$('#dlg').showModal(),history.back();
 if(h==='profile')return $('#dlg').innerHTML='<h3>Arihant A Jain</h3><p>Roll number: <b>20251RAI0013</b></p><p>Section: <b>3RAI01</b>, CSE (Robotics and AI)</p><p>Project: <b>PrintFlow Pro</b>, Smart Printing Scheduler Using DSA</p><div class="row" style="margin-top:14px"><button class="btn pri" onclick="$(\'#dlg\').close()">Close</button></div>',$('#dlg').showModal(),history.back();
 page=PAGES[h]?h:'dashboard';render()}
addEventListener('hashchange',route);
$('#menu').onclick=()=>$('#side').classList.toggle('open');
$('#bell').onclick=()=>toast(Q.size()?Q.size()+' job(s) waiting. Next up: '+Q.peek():'No pending jobs','warn');
$('#gsearch').onkeydown=e=>{if(e.key==='Enter'){hist.q=e.target.value;e.target.value='';go('history')}};
$('#date').textContent=new Date().toLocaleDateString([],{dateStyle:'full'});
route();
