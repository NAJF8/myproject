import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, Archive, ArrowDownLeft, ArrowUpLeft, BarChart3, Bell, BriefcaseBusiness, CalendarDays, Check, ChevronLeft, CircleDollarSign, ClipboardList, Cloud, Copy, CreditCard, Database, FileText, FolderKanban, Gauge, Globe2, LayoutDashboard, Menu, MoreVertical, Plus, Receipt, Search, Settings, Sparkles, Tags, Users, WalletCards, X, Zap } from 'lucide-react';
import './styles.css';
import { auth, googleProvider, firebaseConfigured } from './firebase';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';

const seedProjects = [
  { id:'PRJ-2026-001', name:'متجر إلكتروني للأغذية', client:'محمد أحمد', type:'متجر إلكتروني', status:'قيد البرمجة', price:1600000, received:980000, expenses:210000, progress:68, due:'2026/10/06', color:'mint' },
  { id:'PRJ-2026-002', name:'نظام إدارة العيادة', client:'عيادة الندى', type:'نظام إدارة', status:'قيد الاختبار', price:2400000, received:1800000, expenses:355000, progress:86, due:'2026/09/30', color:'blue' },
  { id:'PRJ-2026-003', name:'تطبيق الجوال', client:'شركة خطوة', type:'تطبيق', status:'بانتظار العميل', price:1200000, received:600000, expenses:185000, progress:52, due:'2026/11/12', color:'orange' },
  { id:'PRJ-2026-004', name:'نظام الولاء', client:'مقهى خاص', type:'نظام ولاء', status:'مكتمل', price:800000, received:800000, expenses:125000, progress:100, due:'2026/08/18', color:'slate' },
];
const activities = [
  ['دفعة جديدة من متجر إلكتروني للأغذية','قبل ساعتين','payment'],['تم إضافة مصروف: استضافة','قبل 4 ساعات','expense'],['تحديث حالة مشروع تطبيق الجوال','قبل 6 ساعات','project'],['تم تجديد اشتراك نطاق example.iq','منذ يوم','domain'],['تم إضافة عميل جديد','منذ يوم','client']
];
const seedPayments = [
  { id:'PAY-001', projectId:'PRJ-2026-001', date:'2026-09-01', amount:300000, method:'نقدي', type:'دفعة أولى', note:'' },
  { id:'PAY-002', projectId:'PRJ-2026-001', date:'2026-09-15', amount:250000, method:'تحويل', type:'دفعة وسطية', note:'' },
  { id:'PAY-003', projectId:'PRJ-2026-002', date:'2026-09-10', amount:500000, method:'Zain Cash', type:'دفعة أولى', note:'' },
];
const nav = [
  ['dashboard','لوحة التحكم',LayoutDashboard],['projects','المشاريع',FolderKanban],['clients','العملاء',Users],['payments','الدفعات',CreditCard],['expenses','المصاريف',Receipt],['domains','الدومينات والاشتراكات',Globe2],['reports','التقارير',BarChart3],['settings','الإعدادات',Settings]
];
const money = n => `${new Intl.NumberFormat('ar-IQ').format(Math.round(Number(n)||0))} د.ع`;
const usdMoney = n => `${new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(Number(n)||0)}`;
const dualMoney = (iqd,rate) => `${money(iqd)} · ${usdMoney((Number(iqd)||0)/(Number(rate)||1310))}`;
const statusClass = s => s === 'مكتمل' ? 'success' : s === 'بانتظار العميل' ? 'warning' : s === 'متوقف' ? 'danger' : 'info';


function AuthGate({children}){
  const [user,setUser]=useState(undefined);
  const allowedEmail=(import.meta.env.VITE_ALLOWED_EMAIL||'').trim().toLowerCase();

  useEffect(()=>{
    if(!firebaseConfigured){ setUser(null); return; }
    return onAuthStateChanged(auth,u=>setUser(u||null));
  },[]);

  if(!firebaseConfigured) return children;
  if(user===undefined) return <div className="auth-screen"><div className="auth-card"><div className="brand-mark"><Sparkles size={22}/></div><h1>جاري التحقق...</h1><p>يتم التحقق من جلسة الدخول.</p></div></div>;

  const login=async()=>{
    try{
      const result=await signInWithPopup(auth,googleProvider);
      const email=(result.user?.email||'').toLowerCase();
      if(allowedEmail && email!==allowedEmail){
        await signOut(auth);
        alert('هذا الحساب غير مصرح له بالدخول.');
      }
    }catch(err){
      console.error(err);
      alert('تعذر تسجيل الدخول بحساب Google.');
    }
  };

  if(!user || (allowedEmail && (user.email||'').toLowerCase()!==allowedEmail)){
    return <div className="auth-screen"><div className="auth-card"><div className="brand-mark"><Sparkles size={22}/></div><h1>تسجيل الدخول</h1><p>هذا النظام شخصي. سجّل الدخول بحساب Google المصرح به للمتابعة.</p><button className="btn primary google-login" onClick={login}>الدخول باستخدام Google</button></div></div>;
  }

  return <>{children}</>;
}

function App(){
  const [page,setPage] = useState('dashboard'); const [drawer,setDrawer]=useState(false); const [search,setSearch]=useState('');
  const [projects,setProjects] = useState(()=>JSON.parse(localStorage.getItem('pp-projects')||'null')||seedProjects);
  const [exchangeRate,setExchangeRate] = useState(()=>Number(localStorage.getItem('pp-exchange-rate')||1310));
  const [payments,setPayments] = useState(()=>JSON.parse(localStorage.getItem('pp-payments')||'null')||seedPayments);
  const [modal,setModal]=useState(null); const [editingProject,setEditingProject]=useState(null); const [toast,setToast]=useState('');
  useEffect(()=>{
    if(modal){
      document.body.classList.add('modal-open');
      return ()=>document.body.classList.remove('modal-open');
    }
    document.body.classList.remove('modal-open');
  },[modal]);
  const totals = useMemo(()=>projects.reduce((a,p)=>({price:a.price+p.price, received:a.received+p.received, expenses:a.expenses+p.expenses}),{price:0,received:0,expenses:0}),[projects]);
  const filtered = projects.filter(p=>`${p.name} ${p.client} ${p.id}`.includes(search));
  const notify = msg => { setToast(msg); setTimeout(()=>setToast(''),2600); };
  const persistProjects = next => { setProjects(next); localStorage.setItem('pp-projects',JSON.stringify(next)); };
  const addProject = e => { e.preventDefault(); const f=new FormData(e.currentTarget); const raw=Number(f.get('price')||0); const cur=f.get('priceCurrency')||'IQD'; const price=cur==='USD'?Math.round(raw*exchangeRate):raw; const p={id:`PRJ-2026-${String(projects.length+1).padStart(3,'0')}`,name:f.get('name'),client:f.get('client'),type:f.get('type'),status:'فكرة',price,priceCurrency:cur,originalPrice:raw,exchangeRateAtAgreement:exchangeRate,received:0,expenses:0,progress:0,due:'2026/12/30',color:'blue'}; const next=[p,...projects];persistProjects(next);setModal(null);notify('تمت إضافة المشروع بنجاح'); };
  const saveProjectEdit = e => { e.preventDefault(); const f=new FormData(e.currentTarget); const raw=Number(f.get('price')||0); const cur=f.get('priceCurrency')||'IQD'; const price=cur==='USD'?Math.round(raw*exchangeRate):raw; const next=projects.map(p=>p.id===editingProject.id?{...p,name:f.get('name'),client:f.get('client'),type:f.get('type'),status:f.get('status'),price,priceCurrency:cur,originalPrice:raw,exchangeRateAtAgreement:exchangeRate,progress:Number(f.get('progress')||0),due:f.get('due')||p.due}:p); persistProjects(next); setEditingProject(null); setModal(null); notify('تم تحديث المشروع'); };
  const deleteProject = p => { if(!confirm(`حذف المشروع "${p.name}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) return; const next=projects.filter(x=>x.id!==p.id); persistProjects(next); notify('تم حذف المشروع'); };
  return <div className="app-shell">
    <aside className={`sidebar ${drawer?'open':''}`}><div className="brand"><div className="brand-mark"><Sparkles size={19}/></div><div><strong>مركز التحكم</strong><small>نظامك الشخصي</small></div><button className="mobile-close" onClick={()=>setDrawer(false)}><X size={18}/></button></div><div className="profile"><div className="avatar">م</div><div><strong>مرحباً بك</strong><small>المالك</small></div><ChevronLeft size={17}/></div><nav>{nav.map(([id,label,Icon])=><button key={id} className={page===id?'active':''} onClick={()=>{setPage(id);setDrawer(false)}}><Icon size={19}/><span>{label}</span>{id==='payments'&&<b className="nav-dot">3</b>}</button>)}</nav><div className="sidebar-foot"><div className="mini-card"><Zap size={17}/><div><strong>كل شيء تحت السيطرة</strong><span>آخر مزامنة: الآن</span></div></div><button className="sidebar-settings"><Settings size={17}/> إعدادات الحساب</button></div></aside>
    <main className="main"><header className="topbar"><button className="menu-btn" onClick={()=>setDrawer(true)}><Menu size={21}/></button><div className="search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث في المشاريع والعملاء والدفعات ..."/></div><div className="top-actions"><button className="icon-btn notify"><Bell size={19}/><i/></button><div className="date"><CalendarDays size={18}/><span>الأحد، 27 أيلول 2026</span></div></div></header>
      <div className="content">{page==='dashboard'&&<Dashboard totals={totals} projects={projects} filtered={filtered} onAdd={()=>setModal('project')} onPage={setPage} exchangeRate={exchangeRate} />}{page==='projects'&&<Projects projects={filtered} onAdd={()=>setModal('project')} onCopy={()=>notify('تم نسخ معرف المشروع')} onEdit={p=>{setEditingProject(p);setModal('editProject')}} onDelete={deleteProject} exchangeRate={exchangeRate} />}{page==='payments'&&<Payments projects={projects} payments={payments} setPayments={next=>{setPayments(next);localStorage.setItem('pp-payments',JSON.stringify(next));}} notify={notify} exchangeRate={exchangeRate} />}{page==='settings'&&<SettingsPage exchangeRate={exchangeRate} setExchangeRate={r=>{setExchangeRate(r);localStorage.setItem('pp-exchange-rate',String(r));notify('تم حفظ سعر الصرف')}} />}{page!=='dashboard'&&page!=='projects'&&page!=='payments'&&page!=='settings'&&<Placeholder page={page} onAdd={()=>setModal('project')} />}</div>
    </main>{modal==='project'&&<Modal title="إضافة مشروع جديد" close={()=>setModal(null)}><form onSubmit={addProject} className="form"><label>اسم المشروع<input name="name" required placeholder="مثال: متجر إلكتروني"/></label><label>اسم العميل<input name="client" required placeholder="مثال: محمد أحمد"/></label><label>نوع المشروع<select name="type"><option>موقع ويب</option><option>متجر إلكتروني</option><option>نظام إدارة</option><option>تطبيق</option><option>مشروع مخصص</option></select></label><label>السعر المتفق عليه<input name="price" type="number" step="0.01" required placeholder="0"/></label><label>عملة الاتفاق<select name="priceCurrency"><option value="IQD">دينار عراقي IQD</option><option value="USD">دولار أمريكي USD</option></select></label><div className="form-actions"><button type="button" className="btn ghost" onClick={()=>setModal(null)}>إلغاء</button><button className="btn primary"><Plus size={17}/> حفظ المشروع</button></div></form></Modal>}{modal==='editProject'&&editingProject&&<Modal title="تعديل المشروع" close={()=>{setModal(null);setEditingProject(null)}}><form onSubmit={saveProjectEdit} className="form"><label>اسم المشروع<input name="name" required defaultValue={editingProject.name}/></label><label>اسم العميل<input name="client" required defaultValue={editingProject.client}/></label><label>نوع المشروع<select name="type" defaultValue={editingProject.type}><option>موقع ويب</option><option>متجر إلكتروني</option><option>نظام إدارة</option><option>تطبيق</option><option>مشروع مخصص</option><option>نظام POS</option><option>نظام ولاء</option></select></label><label>الحالة<select name="status" defaultValue={editingProject.status}><option>فكرة</option><option>قيد التصميم</option><option>قيد البرمجة</option><option>قيد الاختبار</option><option>بانتظار العميل</option><option>مكتمل</option><option>تم التسليم</option><option>صيانة</option><option>متوقف</option><option>ملغي</option></select></label><label>السعر<input name="price" type="number" step="0.01" required defaultValue={editingProject.priceCurrency==="USD"?(editingProject.originalPrice??(editingProject.price/exchangeRate)):editingProject.price}/></label><label>عملة الاتفاق<select name="priceCurrency" defaultValue={editingProject.priceCurrency||"IQD"}><option value="IQD">دينار عراقي IQD</option><option value="USD">دولار أمريكي USD</option></select></label><label>نسبة الإنجاز<input name="progress" type="number" min="0" max="100" defaultValue={editingProject.progress}/></label><label>موعد التسليم<input name="due" type="date" defaultValue={(editingProject.due||'').replaceAll('/','-')}/></label><div className="form-actions"><button type="button" className="btn ghost" onClick={()=>{setModal(null);setEditingProject(null)}}>إلغاء</button><button className="btn primary"><Check size={17}/> حفظ التعديلات</button></div></form></Modal>}{toast&&<div className="toast"><Check size={17}/>{toast}</div>}
  </div>
}

function Dashboard({totals,projects,filtered,onAdd,onPage,exchangeRate}){const [range,setRange]=useState('آخر 6 أشهر'); return <>
  <div className="page-head"><div><h1>لوحة التحكم</h1><p>نظرة شاملة على مشاريعك ومالك وأعمالك</p></div><div className="head-actions"><button className="btn ghost"><ArrowDownLeft size={16}/> تصدير البيانات</button><button className="btn primary" onClick={onAdd}><Plus size={17}/> مشروع جديد</button></div></div>
  <section className="metric-grid"><Metric title="صافي الربح هذا الشهر" value={dualMoney(totals.received-totals.expenses,exchangeRate)} trend="+18%" caption="أعلى من الشهر الماضي" icon={CircleDollarSign} tone="mint"/><Metric title="إيرادات هذا الشهر" value={dualMoney(totals.received,exchangeRate)} trend="+22%" caption="مقارنة بالشهر الماضي" icon={ArrowUpLeft} tone="blue"/><Metric title="المصاريف هذا الشهر" value={dualMoney(totals.expenses,exchangeRate)} trend="-12%" caption="أقل من الشهر الماضي" icon={ArrowDownLeft} tone="orange"/><Metric title="المستحقات القادمة" value={dualMoney(totals.price-totals.received,exchangeRate)} caption="من 3 دفعات" icon={WalletCards} tone="violet"/></section>
  <section className="dashboard-grid"><div className="panel chart-panel"><div className="panel-head"><div><h2>الإيرادات والمصاريف</h2><p>نظرة على التدفق المالي خلال الفترة</p></div><select value={range} onChange={e=>setRange(e.target.value)}><option>آخر 6 أشهر</option><option>هذا العام</option></select></div><div className="legend"><span><i className="dot mint"/> الإيرادات</span><span><i className="dot orange"/> المصاريف</span></div><div className="chart"><div className="y-labels"><span>8م</span><span>6م</span><span>4م</span><span>2م</span><span>0</span></div><div className="bars">{['نيسان','آذار','شباط','كانون الثاني','كانون الأول','تشرين الثاني'].map((m,i)=><div className="bar-group" key={m}><div className="bar-wrap"><i className="bar income" style={{height:`${46+i%3*9}%`}}/><i className="bar expense" style={{height:`${24+i%2*8}%`}}/></div><span>{m}</span></div>)}</div></div></div><div className="panel donut-panel"><div className="panel-head"><div><h2>توزيع حالة المشاريع</h2><p>حسب الحالة الحالية</p></div><button className="more"><MoreVertical size={18}/></button></div><div className="donut-body"><div className="donut"><div><strong>{projects.length}</strong><span>مشاريع</span></div></div><div className="status-list"><Stat label="قيد التنفيذ" value="5" color="mint"/><Stat label="مكتمل" value="3" color="green"/><Stat label="متوقف" value="2" color="orange"/><Stat label="ملغى" value="1" color="red"/><Stat label="مخطط له" value="1" color="slate"/></div></div></div></section>
  <section className="lower-grid"><div className="panel projects-panel"><div className="panel-head"><div><h2>المشاريع النشطة</h2><p>المشاريع التي تحتاج إلى متابعة</p></div><button className="text-btn" onClick={()=>onPage('projects')}>عرض كل المشاريع <ChevronLeft size={16}/></button></div><ProjectTable projects={filtered.slice(0,4)} exchangeRate={exchangeRate}/></div><ActivityPanel/></section>
  <section className="quick"><div className="panel-head"><h2>إجراءات سريعة</h2></div><div className="quick-grid"><button onClick={onAdd}><Plus/><span>إضافة مشروع</span></button><button onClick={()=>onPage('payments')}><CreditCard/><span>تسجيل دفعة</span></button><button onClick={()=>onPage('clients')}><Users/><span>إضافة عميل</span></button><button onClick={()=>onPage('expenses')}><Receipt/><span>إضافة مصروف</span></button></div></section>
</>}
function Metric({title,value,trend,caption,icon:Icon,tone}){return <div className="metric"><div className={`metric-icon ${tone}`}><Icon size={20}/></div><div className="metric-copy"><span>{title}</span><strong>{value}</strong><small>{trend&&<em className={trend.startsWith('-')?'down':''}>{trend}</em>} {caption}</small></div></div>}
function Stat({label,value,color}){return <div><span><i className={`dot ${color}`}/>{label}</span><strong>{value}</strong></div>}
function ProjectTable({projects,exchangeRate}){return <div className="table-wrap"><table><thead><tr><th>اسم المشروع</th><th>العميل</th><th>الحالة</th><th>القيمة</th><th>الإنجاز</th><th/></tr></thead><tbody>{projects.map(p=><tr key={p.id}><td><div className="project-name"><span className={`project-avatar ${p.color}`}>{p.name.slice(0,1)}</span><div><strong>{p.name}</strong><small>{p.id}</small></div></div></td><td>{p.client}</td><td><span className={`status ${statusClass(p.status)}`}>{p.status}</span></td><td><strong>{money(p.price)}</strong><small style={{display:'block'}}>{usdMoney(p.price/exchangeRate)}</small></td><td><div className="progress"><span><i style={{width:`${p.progress}%`}}/></span><small>{p.progress}%</small></div></td><td><button className="more"><MoreVertical size={17}/></button></td></tr>)}</tbody></table></div>}
function ActivityPanel(){return <div className="panel activity-panel"><div className="panel-head"><div><h2>الأنشطة الأخيرة</h2><p>آخر التحديثات على نظامك</p></div><Activity size={19} className="muted"/></div><div className="activities">{activities.map(([text,time,type])=><div className="activity" key={text}><div className={`activity-icon ${type}`}>{type==='payment'?<CreditCard size={16}/>:type==='expense'?<Receipt size={16}/>:type==='project'?<FolderKanban size={16}/>:type==='domain'?<Globe2 size={16}/>:<Users size={16}/>}</div><div><strong>{text}</strong><small>{time}</small></div></div>)}</div><button className="text-btn all-activity">عرض كل الأنشطة <ChevronLeft size={16}/></button></div>}
function Projects({projects,onAdd,onCopy,onEdit,onDelete,exchangeRate}){return <><div className="page-head"><div><h1>المشاريع</h1><p>إدارة المشاريع والاتفاقات والتقدم المالي</p></div><button className="btn primary" onClick={onAdd}><Plus size={17}/> مشروع جديد</button></div><div className="toolbar panel"><div className="filter-search"><Search size={17}/><input placeholder="ابحث باسم المشروع أو العميل..."/></div><button className="btn ghost"><Tags size={16}/> كل الحالات</button><button className="btn ghost"><CalendarDays size={16}/> 2026</button></div><div className="project-cards">{projects.map(p=><div className="project-card panel" key={p.id}><div className="project-card-top"><span className={`status ${statusClass(p.status)}`}>{p.status}</span><div style={{display:'flex',gap:8}}><button className="btn ghost" onClick={()=>onEdit(p)}>تعديل</button><button className="btn ghost" onClick={()=>onDelete(p)}>حذف</button></div></div><div className="project-title"><span className={`project-avatar ${p.color}`}>{p.name.slice(0,1)}</span><div><h3>{p.name}</h3><small>{p.id} · {p.type}</small></div></div><div className="client-line"><Users size={15}/>{p.client}</div><div className="finance-row"><div><small>السعر</small><strong>{money(p.price)}</strong><small>{usdMoney(p.price/exchangeRate)}</small></div><div><small>المستلم</small><strong>{money(p.received)}</strong><small>{usdMoney(p.received/exchangeRate)}</small></div><div><small>الباقي</small><strong>{money(p.price-p.received)}</strong><small>{usdMoney((p.price-p.received)/exchangeRate)}</small></div></div><div className="card-progress"><div><span>نسبة الإنجاز</span><strong>{p.progress}%</strong></div><span className="progress"><i style={{width:`${p.progress}%`}}/></span></div><div className="project-card-foot"><span>التسليم المتوقع <b>{p.due}</b></span><button className="text-btn" onClick={onCopy}><Copy size={14}/> نسخ المعرف</button></div></div>)}</div></>}

function Payments({projects,payments,setPayments,notify,exchangeRate}){
  const [projectId,setProjectId]=useState('');
  const selected=projects.find(p=>p.id===projectId);
  const rows=payments.filter(x=>x.projectId===projectId);
  const received=rows.reduce((a,x)=>a+(Number(x.amountIqd??x.amount)||0),0);
  const addPayment=e=>{e.preventDefault(); if(!projectId)return; const f=new FormData(e.currentTarget); const raw=Number(f.get('amount')||0); const cur=f.get('currency')||'IQD'; const amountIqd=cur==='USD'?Math.round(raw*exchangeRate):raw; const p={id:`PAY-${Date.now()}`,projectId,date:f.get('date'),amount:amountIqd,amountIqd,originalAmount:raw,currency:cur,exchangeRate,method:f.get('method'),type:f.get('type'),note:f.get('note')||''}; setPayments([p,...payments]); e.currentTarget.reset(); notify('تم تسجيل الدفعة');};
  const del=id=>{if(!confirm('حذف هذه الدفعة؟'))return; setPayments(payments.filter(x=>x.id!==id)); notify('تم حذف الدفعة');};
  return <><div className="page-head"><div><h1>الدفعات</h1><p>اختر المشروع أولاً ثم أدر دفعاته</p></div></div>
  <div className="panel" style={{padding:20,marginBottom:18}}><label style={{display:'grid',gap:8,fontWeight:700}}>اختيار المشروع<select value={projectId} onChange={e=>setProjectId(e.target.value)} style={{padding:12,borderRadius:10}}><option value="">— اختر مشروعاً —</option>{projects.map(p=><option key={p.id} value={p.id}>{p.name} — {p.client}</option>)}</select></label></div>
  {!selected?<div className="placeholder panel"><div className="placeholder-icon"><CreditCard size={28}/></div><h1>اختر مشروعاً</h1><p>بعد اختيار المشروع تظهر الدفعات والمبلغ المستلم والباقي.</p></div>:<>
    <section className="metric-grid"><Metric title="قيمة المشروع" value={dualMoney(selected.price,exchangeRate)} icon={BriefcaseBusiness} tone="blue"/><Metric title="المستلم من سجل الدفعات" value={dualMoney(received,exchangeRate)} icon={ArrowUpLeft} tone="mint"/><Metric title="الباقي" value={dualMoney(Math.max(selected.price-received,0),exchangeRate)} icon={WalletCards} tone="orange"/></section>
    <div className="panel" style={{padding:20,marginBottom:18}}><h2 style={{marginTop:0}}>إضافة دفعة — {selected.name}</h2><form onSubmit={addPayment} className="form"><label>التاريخ<input name="date" type="date" required/></label><label>المبلغ<input name="amount" type="number" min="0.01" step="0.01" required/></label><label>العملة<select name="currency"><option value="IQD">دينار عراقي IQD</option><option value="USD">دولار أمريكي USD</option></select></label><label>طريقة الدفع<select name="method"><option>نقدي</option><option>تحويل</option><option>Zain Cash</option><option>Asia Hawala</option><option>Qi Card</option><option>أخرى</option></select></label><label>نوع الدفعة<select name="type"><option>دفعة أولى</option><option>دفعة وسطية</option><option>دفعة نهائية</option><option>صيانة</option><option>خدمة إضافية</option><option>أخرى</option></select></label><label>ملاحظة<input name="note"/></label><div className="form-actions"><button className="btn primary"><Plus size={17}/> تسجيل الدفعة</button></div></form></div>
    <div className="panel" style={{padding:20}}><h2 style={{marginTop:0}}>سجل الدفعات</h2>{rows.length===0?<p>لا توجد دفعات لهذا المشروع بعد.</p>:<div className="table-wrap"><table><thead><tr><th>التاريخ</th><th>المبلغ</th><th>الطريقة</th><th>النوع</th><th>ملاحظة</th><th/></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.date}</td><td><strong>{money(r.amountIqd??r.amount)}</strong><small style={{display:'block'}}>{usdMoney((r.amountIqd??r.amount)/exchangeRate)}</small></td><td>{r.method}</td><td>{r.type}</td><td>{r.note||'—'}</td><td><button className="btn ghost" onClick={()=>del(r.id)}>حذف</button></td></tr>)}</tbody></table></div>}</div>
  </>}</>
}

function SettingsPage({exchangeRate,setExchangeRate}){
  const [rate,setRate]=useState(exchangeRate);
  return <><div className="page-head"><div><h1>الإعدادات</h1><p>تخصيص العملة وسعر الصرف</p></div></div><div className="panel" style={{padding:20,maxWidth:620}}><h2 style={{marginTop:0}}>سعر صرف الدولار</h2><p style={{color:'#64748b'}}>يُستخدم لعرض السعر بالدولار والدينار معاً. لا يغير القيم الأصلية المخزنة للمشاريع القديمة.</p><label style={{display:'grid',gap:8,fontWeight:700}}>1 دولار أمريكي =<input type="number" min="1" value={rate} onChange={e=>setRate(Number(e.target.value)||0)} style={{padding:12,borderRadius:10}}/></label><div style={{marginTop:14,padding:14,borderRadius:12,background:'#f8fafc'}}>{usdMoney(1)} = {money(rate)}</div><div className="form-actions" style={{marginTop:16}}><button className="btn primary" onClick={()=>setExchangeRate(rate)}>حفظ سعر الصرف</button></div></div></>
}

function Placeholder({page,onAdd}){const meta={clients:['العملاء','ملفات العملاء والعلاقة المالية لكل عميل',Users],payments:['الدفعات','تتبع المستحقات والدفعات المكتملة',CreditCard],expenses:['المصاريف','مصروفات المشاريع والمصاريف العامة',Receipt],domains:['الدومينات والاشتراكات','تواريخ التجديد والتكاليف القادمة',Globe2],reports:['التقارير','قراءة أعمق لأداء المشاريع والربحية',BarChart3],settings:['الإعدادات','تخصيص النظام والنسخ الاحتياطي',Settings]}[page]||['الصفحة','قيد التجهيز',Gauge]; const Icon=meta[2];return <div className="placeholder panel"><div className="placeholder-icon"><Icon size={28}/></div><h1>{meta[0]}</h1><p>{meta[1]}</p><button className="btn primary" onClick={onAdd}><Plus size={17}/> إضافة جديد</button></div>}
function Modal({title,close,children}){return <div className="modal-backdrop" onMouseDown={close}><div className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><h2>{title}</h2><button className="more" onClick={close}><X size={19}/></button></div>{children}</div></div>}
createRoot(document.getElementById('root')).render(<AuthGate><App/></AuthGate>);
