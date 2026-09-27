import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, Archive, ArrowDownLeft, ArrowUpLeft, BarChart3, Bell, BriefcaseBusiness, CalendarDays, Check, ChevronLeft, CircleDollarSign, ClipboardList, Cloud, Copy, CreditCard, Database, FileText, FolderKanban, Gauge, Globe2, LayoutDashboard, Menu, MoreVertical, Plus, Receipt, Search, Settings, Sparkles, Tags, Users, WalletCards, X, Zap } from 'lucide-react';
import './styles.css';
import { auth, db, googleProvider, firebaseConfigured } from './firebase';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { get, onValue, ref, set } from 'firebase/database';

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
  { id:'PAY-001', projectId:'PRJ-2026-001', date:'2026-09-01', amountIqd:300000, amountUsd:0, method:'نقدي', type:'دفعة أولى', note:'' },
  { id:'PAY-002', projectId:'PRJ-2026-001', date:'2026-09-15', amountIqd:250000, amountUsd:0, method:'تحويل', type:'دفعة وسطية', note:'' },
  { id:'PAY-003', projectId:'PRJ-2026-002', date:'2026-09-10', amountIqd:500000, amountUsd:0, method:'Zain Cash', type:'دفعة أولى', note:'' },
];
const seedExpenses = [];
const nav = [
  ['dashboard','لوحة التحكم',LayoutDashboard],['projects','المشاريع',FolderKanban],['clients','العملاء',Users],['payments','الدفعات',CreditCard],['expenses','المصاريف',Receipt],['domains','الدومينات',Globe2],['ai','AI والأدوات',Sparkles],['reports','التقارير',BarChart3],['settings','الإعدادات',Settings]
];
const money = n => `${new Intl.NumberFormat('ar-IQ').format(Math.round(Number(n)||0))} د.ع`;
const usdMoney = n => `${new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(Number(n)||0)}`;
const projectPriceIqd = p => Number(p?.priceIqd ?? p?.price ?? 0) || 0;
const projectPriceUsd = p => Number(p?.priceUsd ?? (p?.priceCurrency==='USD' ? p?.originalPrice : 0) ?? 0) || 0;
const paymentIqd = p => Number(p?.amountIqd ?? (p?.currency==='USD' ? 0 : p?.amount) ?? 0) || 0;
const paymentUsd = p => Number(p?.amountUsd ?? (p?.currency==='USD' ? p?.originalAmount : 0) ?? 0) || 0;
const expenseIqd = e => Number(e?.amountIqd ?? 0) || 0;
const expenseUsd = e => Number(e?.amountUsd ?? 0) || 0;
const statusClass = s => ['منجز','مكتمل','تم التسليم'].includes(s) ? 'success' : s === 'بانتظار العميل' ? 'warning' : s === 'متوقف' ? 'danger' : 'info';
const readLocalJson = (key,fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error('Invalid local data for', key, err);
    return fallback;
  }
};

const makeUid = () => (globalThis.crypto?.randomUUID?.() || `uid-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const nextProjectCode = list => {
  const max = (Array.isArray(list) ? list : []).reduce((m,p)=>{
    const match=String(p?.id||'').match(/^PRJ-(\d{4})-(\d+)$/);
    return match ? Math.max(m,Number(match[2])||0) : m;
  },0);
  return `PRJ-${new Date().getFullYear()}-${String(max+1).padStart(3,'0')}`;
};
const sameProjectData = (a,b) =>
  String(a?.name||'')===String(b?.name||'') &&
  String(a?.client||'')===String(b?.client||'') &&
  String(a?.type||'')===String(b?.type||'') &&
  projectPriceIqd(a)===projectPriceIqd(b) &&
  projectPriceUsd(a)===projectPriceUsd(b) &&
  String(a?.due||'')===String(b?.due||'');

const normalizeProjects = input => {
  const list=Array.isArray(input)?input:[];
  const used=new Map();
  let seq=list.reduce((m,p)=>{
    const match=String(p?.id||'').match(/^PRJ-(\d{4})-(\d+)$/);
    return match?Math.max(m,Number(match[2])||0):m;
  },0);
  const out=[];
  for(const raw of list){
    const p={...raw,uid:raw?.uid||makeUid()};
    let code=String(p.id||'').trim();
    if(!code){ seq+=1; code=`PRJ-${new Date().getFullYear()}-${String(seq).padStart(3,'0')}`; }
    if(used.has(code)){
      const existing=used.get(code);
      if(sameProjectData(existing,p)) continue;
      seq+=1;
      code=`PRJ-${new Date().getFullYear()}-${String(seq).padStart(3,'0')}`;
    }
    p.id=code;
    used.set(code,p);
    out.push(p);
  }
  return out;
};


const projectFinancials = (p,payments,expenses) => {
  const rows=payments.filter(x=>x.projectId===p.id);
  const ex=expenses.filter(x=>x.projectId===p.id);
  const receivedIqd=rows.reduce((a,x)=>a+paymentIqd(x),0);
  const receivedUsd=rows.reduce((a,x)=>a+paymentUsd(x),0);
  const domains=ex.filter(x=>x.category==='Domain');
  const ai=ex.filter(x=>x.category==='AI / API');
  const other=ex.filter(x=>!['Domain','AI / API'].includes(x.category));
  const domainIqd=domains.reduce((a,x)=>a+expenseIqd(x),0);
  const domainUsd=domains.reduce((a,x)=>a+expenseUsd(x),0);
  const aiIqd=ai.reduce((a,x)=>a+expenseIqd(x),0);
  const aiUsd=ai.reduce((a,x)=>a+expenseUsd(x),0);
  const otherIqd=other.reduce((a,x)=>a+expenseIqd(x),0);
  const otherUsd=other.reduce((a,x)=>a+expenseUsd(x),0);
  const expensesIqd=domainIqd+aiIqd+otherIqd;
  const expensesUsd=domainUsd+aiUsd+otherUsd;
  return {
    receivedIqd,receivedUsd,domainIqd,domainUsd,aiIqd,aiUsd,otherIqd,otherUsd,
    expensesIqd,expensesUsd,
    remainingIqd:Math.max(projectPriceIqd(p)-receivedIqd,0),
    remainingUsd:Math.max(projectPriceUsd(p)-receivedUsd,0),
    profitIqd:projectPriceIqd(p)-expensesIqd,
    profitUsd:projectPriceUsd(p)-expensesUsd
  };
};
const esc = value => String(value??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const printHtml = (title,body) => {
  const w=window.open('','_blank','width=1000,height=800');
  if(!w){ alert('المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع.'); return; }
  w.document.open();
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
  @page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,Tahoma,sans-serif;color:#222;margin:0;background:#fff;font-size:12px}
  h1{font-size:22px;margin:0 0 5px}h2{font-size:15px;margin:18px 0 8px}.muted{color:#666}.header{border-bottom:2px solid #333;padding-bottom:10px;margin-bottom:16px}
  .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.box{border:1px solid #bbb;border-radius:6px;padding:9px}.box span{display:block;color:#666;font-size:10px}.box b{display:block;margin-top:4px;font-size:13px}
  table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #bbb;padding:7px;text-align:right}th{background:#f3f3f3}
  .profit{background:#eef7f1;font-weight:700}.project-section{page-break-inside:avoid;margin-bottom:22px;padding-bottom:16px;border-bottom:2px solid #ddd}
  .print-date{margin-top:5px;color:#777;font-size:10px}@media print{button{display:none}}
  </style></head><body>${body}<script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`);
  w.document.close();
};
const projectReportMarkup = (p,payments,expenses) => {
  const f=projectFinancials(p,payments,expenses);
  return `<section class="project-section"><div class="header"><h1>${esc(p.name)}</h1><div class="muted">${esc(p.id)} — ${esc(p.client)} — ${esc(p.type)}</div><div class="print-date">الحالة: ${esc(p.status)} | الإنجاز: ${Number(p.progress)||0}% | التسليم: ${esc(p.due||'—')}</div></div>
  <div class="meta">
    <div class="box"><span>السعر بالعراقي</span><b>${esc(money(projectPriceIqd(p)))}</b></div>
    <div class="box"><span>السعر بالدولار</span><b>${esc(usdMoney(projectPriceUsd(p)))}</b></div>
    <div class="box"><span>المستلم بالعراقي</span><b>${esc(money(f.receivedIqd))}</b></div>
    <div class="box"><span>المستلم بالدولار</span><b>${esc(usdMoney(f.receivedUsd))}</b></div>
    <div class="box"><span>الباقي بالعراقي</span><b>${esc(money(f.remainingIqd))}</b></div>
    <div class="box"><span>الباقي بالدولار</span><b>${esc(usdMoney(f.remainingUsd))}</b></div>
  </div>
  <h2>التكاليف والربح</h2>
  <table><thead><tr><th>البند</th><th>IQD</th><th>USD</th></tr></thead><tbody>
    <tr><td>الدومين</td><td>${esc(money(f.domainIqd))}</td><td>${esc(usdMoney(f.domainUsd))}</td></tr>
    <tr><td>AI</td><td>${esc(money(f.aiIqd))}</td><td>${esc(usdMoney(f.aiUsd))}</td></tr>
    <tr><td>مصاريف أخرى</td><td>${esc(money(f.otherIqd))}</td><td>${esc(usdMoney(f.otherUsd))}</td></tr>
    <tr><td>إجمالي المصاريف</td><td>${esc(money(f.expensesIqd))}</td><td>${esc(usdMoney(f.expensesUsd))}</td></tr>
    <tr class="profit"><td>الربح الصافي</td><td>${esc(money(f.profitIqd))}</td><td>${esc(usdMoney(f.profitUsd))}</td></tr>
  </tbody></table></section>`;
};



class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state={error:null}; }
  static getDerivedStateFromError(error){ return {error}; }
  componentDidCatch(error,info){ console.error('Application error',error,info); }
  render(){
    if(this.state.error){
      return <div className="error-screen"><div className="error-card"><h1>صار خطأ بالواجهة</h1><p>ما راح نخلي الموقع يبقى شاشة بيضاء. جرّب إعادة التحميل، وإذا استمر امسح بيانات الموقع المحلية فقط.</p><button className="btn primary" onClick={()=>location.reload()}>إعادة تحميل</button></div></div>;
    }
    return this.props.children;
  }
}

function AuthGate({children}){
  const [user,setUser]=useState(undefined);
  const allowedEmail=(import.meta.env.VITE_ALLOWED_EMAIL||'').trim().toLowerCase();

  useEffect(()=>{
    if(!firebaseConfigured){ setUser(null); return; }
    return onAuthStateChanged(auth,u=>setUser(u||null));
  },[]);

  if(!firebaseConfigured) return React.cloneElement(children,{user:null});
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

  return <>{React.cloneElement(children,{user})}</>;
}

function App({user}){
  const [page,setPage] = useState('dashboard'); const [drawer,setDrawer]=useState(false); const [search,setSearch]=useState('');
  const [projects,setProjects] = useState(()=>normalizeProjects(readLocalJson('pp-projects',seedProjects)));
  const [payments,setPayments] = useState(()=>readLocalJson('pp-payments',seedPayments));
  const [expenses,setExpenses] = useState(()=>readLocalJson('pp-expenses',seedExpenses));
  const [modal,setModal]=useState(null); const [editingProject,setEditingProject]=useState(null); const [toast,setToast]=useState('');
  const [cloudReady,setCloudReady]=useState(false);
  const cloudPath=user?.uid ? `users/${user.uid}` : null;
  const saveCloud = (key,value) => {
    if(!cloudPath) return Promise.resolve();
    return set(ref(db,`${cloudPath}/${key}`),value).catch(err=>{
      console.error('Firebase save failed',key,err);
      setToast('تعذر حفظ آخر تعديل على السحابة');
      setTimeout(()=>setToast(''),3000);
    });
  };
  useEffect(()=>{
    if(modal){
      document.body.classList.add('modal-open');
      return ()=>document.body.classList.remove('modal-open');
    }
    document.body.classList.remove('modal-open');
  },[modal]);
  useEffect(()=>{
    if(!cloudPath){ setCloudReady(true); return; }
    let unsub=()=>{};
    let cancelled=false;
    const root=ref(db,cloudPath);
    get(root).then(snapshot=>{
      if(cancelled) return;
      if(snapshot.exists()){
        const data=snapshot.val()||{};
        if(Array.isArray(data.projects)){ const clean=normalizeProjects(data.projects); setProjects(clean); localStorage.setItem('pp-projects',JSON.stringify(clean)); }
        if(Array.isArray(data.payments)){ setPayments(data.payments); localStorage.setItem('pp-payments',JSON.stringify(data.payments)); }
        if(Array.isArray(data.expenses)){ setExpenses(data.expenses); localStorage.setItem('pp-expenses',JSON.stringify(data.expenses)); }
      }else{
        return set(root,{projects:normalizeProjects(projects),payments,expenses,updatedAt:Date.now()});
      }
    }).then(()=>{
      if(cancelled) return;
      unsub=onValue(root,snap=>{
        if(!snap.exists()) return;
        const data=snap.val()||{};
        if(Array.isArray(data.projects)){ const clean=normalizeProjects(data.projects); setProjects(clean); localStorage.setItem('pp-projects',JSON.stringify(clean)); }
        if(Array.isArray(data.payments)){ setPayments(data.payments); localStorage.setItem('pp-payments',JSON.stringify(data.payments)); }
        if(Array.isArray(data.expenses)){ setExpenses(data.expenses); localStorage.setItem('pp-expenses',JSON.stringify(data.expenses)); }
        setCloudReady(true);
      },err=>{
        console.error('Firebase sync failed',err);
        setCloudReady(true);
      });
    }).catch(err=>{
      console.error('Firebase initial sync failed',err);
      setCloudReady(true);
    });
    return ()=>{cancelled=true;unsub();};
  },[cloudPath]);
  useEffect(()=>{ localStorage.setItem('pp-projects',JSON.stringify(projects)); },[]);
  const totals = useMemo(()=>{
    const agreedIqd=projects.reduce((a,p)=>a+projectPriceIqd(p),0);
    const agreedUsd=projects.reduce((a,p)=>a+projectPriceUsd(p),0);
    const receivedIqd=payments.reduce((a,p)=>a+paymentIqd(p),0);
    const receivedUsd=payments.reduce((a,p)=>a+paymentUsd(p),0);
    const expensesIqd=expenses.reduce((a,e)=>a+expenseIqd(e),0);
    const expensesUsd=expenses.reduce((a,e)=>a+expenseUsd(e),0);
    return {agreedIqd,agreedUsd,receivedIqd,receivedUsd,expensesIqd,expensesUsd};
  },[projects,payments,expenses]);
  const filtered = projects.filter(p=>`${p.name} ${p.client} ${p.id}`.includes(search));
  const notify = msg => { setToast(msg); setTimeout(()=>setToast(''),2600); };
  const persistProjects = next => { const clean=normalizeProjects(next); setProjects(clean); localStorage.setItem('pp-projects',JSON.stringify(clean)); saveCloud('projects',clean); };
  const persistPayments = next => { setPayments(next); localStorage.setItem('pp-payments',JSON.stringify(next)); saveCloud('payments',next); };
  const persistExpenses = next => { setExpenses(next); localStorage.setItem('pp-expenses',JSON.stringify(next)); saveCloud('expenses',next); };
  const addProject = e => { e.preventDefault(); const form=e.currentTarget; if(form.dataset.submitting==='1') return; form.dataset.submitting='1'; const f=new FormData(form); const p={uid:makeUid(),id:nextProjectCode(projects),name:f.get('name'),client:f.get('client'),type:f.get('type'),status:'فكرة',priceIqd:Number(f.get('priceIqd')||0),priceUsd:Number(f.get('priceUsd')||0),received:0,expenses:0,progress:0,due:'2026/12/30',color:'blue'}; persistProjects([p,...projects]); setModal(null); notify('تمت إضافة المشروع بنجاح'); };
  const saveProjectEdit = e => { e.preventDefault(); const f=new FormData(e.currentTarget); const status=f.get('status'); const enteredProgress=Math.max(0,Math.min(100,Number(f.get('progress')||0))); const progress=['منجز','مكتمل','تم التسليم'].includes(status)?100:enteredProgress; const next=projects.map(p=>p.uid===editingProject.uid?{...p,name:f.get('name'),client:f.get('client'),type:f.get('type'),status,priceIqd:Number(f.get('priceIqd')||0),priceUsd:Number(f.get('priceUsd')||0),progress,due:f.get('due')||p.due}:p); persistProjects(next); setEditingProject(null); setModal(null); notify('تم تحديث المشروع'); };
  const deleteProject = p => { if(!confirm(`حذف المشروع "${p.name}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) return; const next=projects.filter(x=>x.uid!==p.uid); persistProjects(next); notify('تم حذف المشروع'); };
  return <div className="app-shell">
    <aside className={`sidebar ${drawer?'open':''}`}><div className="brand"><div className="brand-mark"><Sparkles size={19}/></div><div><strong>مركز التحكم</strong><small>نظامك الشخصي</small></div><button className="mobile-close" onClick={()=>setDrawer(false)}><X size={18}/></button></div><div className="profile"><div className="avatar">م</div><div><strong>مرحباً بك</strong><small>المالك</small></div><ChevronLeft size={17}/></div><nav>{nav.map(([id,label,Icon])=><button key={id} className={page===id?'active':''} onClick={()=>{setPage(id);setDrawer(false)}}><Icon size={19}/><span>{label}</span>{id==='payments'&&<b className="nav-dot">3</b>}</button>)}</nav><div className="sidebar-foot"><div className="mini-card"><Zap size={17}/><div><strong>كل شيء تحت السيطرة</strong><span>{cloudReady?'مزامنة السحابة: فعالة':'جاري مزامنة البيانات...'}</span></div></div><button className="sidebar-settings"><Settings size={17}/> إعدادات الحساب</button></div></aside>
    <main className="main"><header className="topbar"><button className="menu-btn" onClick={()=>setDrawer(true)}><Menu size={21}/></button><div className="search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث في المشاريع والعملاء والدفعات ..."/></div><div className="top-actions"><button className="icon-btn notify"><Bell size={19}/><i/></button><div className="date"><CalendarDays size={18}/><span>الأحد، 27 أيلول 2026</span></div></div></header>
      <div className="content">{page==='dashboard'&&<Dashboard totals={totals} projects={projects} filtered={filtered} onAdd={()=>setModal('project')} onPage={setPage} />}{page==='projects'&&<Projects projects={filtered} payments={payments} expenses={expenses} onAdd={()=>setModal('project')} onCopy={()=>notify('تم نسخ معرف المشروع')} onEdit={p=>{setEditingProject(p);setModal('editProject')}} onDelete={deleteProject} />}{page==='payments'&&<Payments projects={projects} payments={payments} setPayments={persistPayments} notify={notify} />}{page==='expenses'&&<Expenses projects={projects} expenses={expenses} setExpenses={persistExpenses} notify={notify} />}{page==='domains'&&<Domains projects={projects} expenses={expenses} setExpenses={persistExpenses} notify={notify} />}{page==='ai'&&<AIExpenses projects={projects} expenses={expenses} setExpenses={persistExpenses} notify={notify} />}{page==='settings'&&<SettingsPage />}{page!=='dashboard'&&page!=='projects'&&page!=='payments'&&page!=='expenses'&&page!=='domains'&&page!=='ai'&&page!=='settings'&&<Placeholder page={page} onAdd={()=>setModal('project')} />}</div>
    </main>{modal==='project'&&<Modal title="إضافة مشروع جديد" close={()=>setModal(null)}><form onSubmit={addProject} className="form"><label>اسم المشروع<input name="name" required placeholder="مثال: متجر إلكتروني"/></label><label>اسم العميل<input name="client" required placeholder="مثال: محمد أحمد"/></label><label>نوع المشروع<select name="type"><option>موقع ويب</option><option>متجر إلكتروني</option><option>نظام إدارة</option><option>تطبيق</option><option>مشروع مخصص</option></select></label><div className="money-fields"><label>السعر بالعراقي<input name="priceIqd" type="number" min="0" step="1" placeholder="0"/></label><label>السعر بالدولار<input name="priceUsd" type="number" min="0" step="0.01" placeholder="0"/></label></div><div className="form-actions"><button type="button" className="btn ghost" onClick={()=>setModal(null)}>إلغاء</button><button className="btn primary"><Plus size={17}/> حفظ المشروع</button></div></form></Modal>}{modal==='editProject'&&editingProject&&<Modal title="تعديل المشروع" close={()=>{setModal(null);setEditingProject(null)}}><form onSubmit={saveProjectEdit} className="form"><label>اسم المشروع<input name="name" required defaultValue={editingProject.name}/></label><label>اسم العميل<input name="client" required defaultValue={editingProject.client}/></label><label>نوع المشروع<select name="type" defaultValue={editingProject.type}><option>موقع ويب</option><option>متجر إلكتروني</option><option>نظام إدارة</option><option>تطبيق</option><option>مشروع مخصص</option><option>نظام POS</option><option>نظام ولاء</option></select></label><label>الحالة<select name="status" defaultValue={editingProject.status}><option>فكرة</option><option>قيد التصميم</option><option>قيد البرمجة</option><option>قيد الاختبار</option><option>بانتظار العميل</option><option>منجز</option><option>مكتمل</option><option>تم التسليم</option><option>صيانة</option><option>متوقف</option><option>ملغي</option></select></label><div className="money-fields"><label>السعر بالعراقي<input name="priceIqd" type="number" min="0" step="1" defaultValue={projectPriceIqd(editingProject)}/></label><label>السعر بالدولار<input name="priceUsd" type="number" min="0" step="0.01" defaultValue={projectPriceUsd(editingProject)}/></label></div><label>نسبة الإنجاز<input name="progress" type="number" min="0" max="100" defaultValue={editingProject.progress}/></label><label>موعد التسليم<input name="due" type="date" defaultValue={(editingProject.due||'').replaceAll('/','-')}/></label><div className="form-actions"><button type="button" className="btn ghost" onClick={()=>{setModal(null);setEditingProject(null)}}>إلغاء</button><button className="btn primary"><Check size={17}/> حفظ التعديلات</button></div></form></Modal>}{toast&&<div className="toast"><Check size={17}/>{toast}</div>}
  </div>
}

function Dashboard({totals,projects,filtered,onAdd,onPage}){const [range,setRange]=useState('آخر 6 أشهر'); return <>
  <div className="page-head"><div><h1>لوحة التحكم</h1><p>نظرة شاملة على مشاريعك ومالك وأعمالك</p></div><div className="head-actions"><button className="btn ghost"><ArrowDownLeft size={16}/> تصدير البيانات</button><button className="btn primary" onClick={onAdd}><Plus size={17}/> مشروع جديد</button></div></div>
  <section className="metric-grid">
    <MoneyMetric title="صافي الربح" iqd={totals.receivedIqd-totals.expensesIqd} usd={totals.receivedUsd-totals.expensesUsd} icon={CircleDollarSign} tone="mint"/>
    <MoneyMetric title="إجمالي المستلم" iqd={totals.receivedIqd} usd={totals.receivedUsd} icon={ArrowUpLeft} tone="blue"/>
    <MoneyMetric title="إجمالي المصاريف" iqd={totals.expensesIqd} usd={totals.expensesUsd} icon={ArrowDownLeft} tone="orange"/>
    <MoneyMetric title="إجمالي الاتفاقات" iqd={totals.agreedIqd} usd={totals.agreedUsd} icon={WalletCards} tone="violet"/>
  </section>
  <section className="dashboard-grid"><div className="panel chart-panel"><div className="panel-head"><div><h2>الإيرادات والمصاريف</h2><p>نظرة على التدفق المالي خلال الفترة</p></div><select value={range} onChange={e=>setRange(e.target.value)}><option>آخر 6 أشهر</option><option>هذا العام</option></select></div><div className="legend"><span><i className="dot mint"/> الإيرادات</span><span><i className="dot orange"/> المصاريف</span></div><div className="chart"><div className="y-labels"><span>8م</span><span>6م</span><span>4م</span><span>2م</span><span>0</span></div><div className="bars">{['نيسان','آذار','شباط','كانون الثاني','كانون الأول','تشرين الثاني'].map((m,i)=><div className="bar-group" key={m}><div className="bar-wrap"><i className="bar income" style={{height:`${46+i%3*9}%`}}/><i className="bar expense" style={{height:`${24+i%2*8}%`}}/></div><span>{m}</span></div>)}</div></div></div><div className="panel donut-panel"><div className="panel-head"><div><h2>توزيع حالة المشاريع</h2><p>حسب الحالة الحالية</p></div><button className="more"><MoreVertical size={18}/></button></div><div className="donut-body"><div className="donut"><div><strong>{projects.length}</strong><span>مشاريع</span></div></div><div className="status-list"><Stat label="قيد التنفيذ" value={projects.filter(p=>!['منجز','مكتمل','تم التسليم','متوقف','ملغي'].includes(p.status)).length} color="mint"/><Stat label="مكتمل" value={projects.filter(p=>['منجز','مكتمل','تم التسليم'].includes(p.status)).length} color="green"/><Stat label="متوقف" value={projects.filter(p=>p.status==='متوقف').length} color="orange"/><Stat label="ملغى" value={projects.filter(p=>p.status==='ملغي').length} color="red"/></div></div></div></section>
  <section className="lower-grid"><div className="panel projects-panel"><div className="panel-head"><div><h2>المشاريع النشطة</h2><p>المشاريع التي تحتاج إلى متابعة</p></div><button className="text-btn" onClick={()=>onPage('projects')}>عرض كل المشاريع <ChevronLeft size={16}/></button></div><ProjectTable projects={filtered.slice(0,4)}/></div><ActivityPanel/></section>
  <section className="quick"><div className="panel-head"><h2>إجراءات سريعة</h2></div><div className="quick-grid"><button onClick={onAdd}><Plus/><span>إضافة مشروع</span></button><button onClick={()=>onPage('payments')}><CreditCard/><span>تسجيل دفعة</span></button><button onClick={()=>onPage('clients')}><Users/><span>إضافة عميل</span></button><button onClick={()=>onPage('expenses')}><Receipt/><span>إضافة مصروف</span></button></div></section>
</>}
function MoneyMetric({title,iqd,usd,icon:Icon,tone}){return <div className="metric money-metric"><div className={`metric-icon ${tone}`}><Icon size={20}/></div><div className="metric-copy"><span>{title}</span><div className="currency-pair"><div><small>IQD</small><strong>{money(iqd)}</strong></div><div><small>USD</small><strong>{usdMoney(usd)}</strong></div></div></div></div>}
function Metric({title,value,trend,caption,icon:Icon,tone}){return <div className="metric"><div className={`metric-icon ${tone}`}><Icon size={20}/></div><div className="metric-copy"><span>{title}</span><strong>{value}</strong><small>{trend&&<em className={trend.startsWith('-')?'down':''}>{trend}</em>} {caption}</small></div></div>}
function Stat({label,value,color}){return <div><span><i className={`dot ${color}`}/>{label}</span><strong>{value}</strong></div>}
function ProjectTable({projects}){return <div className="table-wrap"><table><thead><tr><th>اسم المشروع</th><th>العميل</th><th>الحالة</th><th>القيمة</th><th>الإنجاز</th><th/></tr></thead><tbody>{projects.map(p=><tr key={p.uid||p.id}><td><div className="project-name"><span className={`project-avatar ${p.color}`}>{p.name.slice(0,1)}</span><div><strong>{p.name}</strong><small>{p.id}</small></div></div></td><td>{p.client}</td><td><span className={`status ${statusClass(p.status)}`}>{p.status}</span></td><td><div className="table-money"><span>{money(projectPriceIqd(p))}</span><span>{usdMoney(projectPriceUsd(p))}</span></div></td><td><div className="progress"><span><i style={{width:`${p.progress}%`}}/></span><small>{p.progress}%</small></div></td><td><button className="more"><MoreVertical size={17}/></button></td></tr>)}</tbody></table></div>}
function ActivityPanel(){return <div className="panel activity-panel"><div className="panel-head"><div><h2>الأنشطة الأخيرة</h2><p>آخر التحديثات على نظامك</p></div><Activity size={19} className="muted"/></div><div className="activities">{activities.map(([text,time,type])=><div className="activity" key={text}><div className={`activity-icon ${type}`}>{type==='payment'?<CreditCard size={16}/>:type==='expense'?<Receipt size={16}/>:type==='project'?<FolderKanban size={16}/>:type==='domain'?<Globe2 size={16}/>:<Users size={16}/>}</div><div><strong>{text}</strong><small>{time}</small></div></div>)}</div><button className="text-btn all-activity">عرض كل الأنشطة <ChevronLeft size={16}/></button></div>}
function Projects({projects,payments,expenses,onAdd,onCopy,onEdit,onDelete}){
  const printOne=p=>printHtml(`تقرير ${p.name}`,projectReportMarkup(p,payments,expenses));
  const printAll=()=>{
    const total=projects.reduce((a,p)=>{const f=projectFinancials(p,payments,expenses);a.priceIqd+=projectPriceIqd(p);a.priceUsd+=projectPriceUsd(p);a.receivedIqd+=f.receivedIqd;a.receivedUsd+=f.receivedUsd;a.expensesIqd+=f.expensesIqd;a.expensesUsd+=f.expensesUsd;a.profitIqd+=f.profitIqd;a.profitUsd+=f.profitUsd;return a;},{priceIqd:0,priceUsd:0,receivedIqd:0,receivedUsd:0,expensesIqd:0,expensesUsd:0,profitIqd:0,profitUsd:0});
    const summary=`<div class="header"><h1>تقرير جميع المشاريع</h1><div class="muted">عدد المشاريع: ${projects.length}</div></div><div class="meta"><div class="box"><span>إجمالي الاتفاقات IQD</span><b>${esc(money(total.priceIqd))}</b></div><div class="box"><span>إجمالي الاتفاقات USD</span><b>${esc(usdMoney(total.priceUsd))}</b></div><div class="box"><span>إجمالي المستلم IQD</span><b>${esc(money(total.receivedIqd))}</b></div><div class="box"><span>إجمالي المستلم USD</span><b>${esc(usdMoney(total.receivedUsd))}</b></div><div class="box"><span>إجمالي المصاريف IQD</span><b>${esc(money(total.expensesIqd))}</b></div><div class="box"><span>إجمالي المصاريف USD</span><b>${esc(usdMoney(total.expensesUsd))}</b></div><div class="box profit"><span>صافي الربح IQD</span><b>${esc(money(total.profitIqd))}</b></div><div class="box profit"><span>صافي الربح USD</span><b>${esc(usdMoney(total.profitUsd))}</b></div></div>`;
    printHtml('تقرير جميع المشاريع',summary+projects.map(p=>projectReportMarkup(p,payments,expenses)).join(''));
  };
  return <><div className="page-head"><div><h1>المشاريع</h1><p>تفاصيل السعر والدفعات والمصاريف والربح لكل مشروع</p></div><div className="head-actions"><button className="btn ghost" onClick={printAll}><FileText size={17}/> طباعة تقرير الكل</button><button className="btn primary" onClick={onAdd}><Plus size={17}/> مشروع جديد</button></div></div><div className="toolbar panel"><div className="filter-search"><Search size={17}/><input placeholder="ابحث باسم المشروع أو العميل..."/></div><button className="btn ghost"><Tags size={16}/> كل الحالات</button><button className="btn ghost"><CalendarDays size={16}/> 2026</button></div><div className="project-cards">{projects.map(p=>{const f=projectFinancials(p,payments,expenses);return <div className="project-card panel" key={p.uid||p.id}><div className="project-card-top"><span className={`status ${statusClass(p.status)}`}>{p.status}</span><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button className="btn ghost" onClick={()=>printOne(p)}><FileText size={15}/> تقرير</button><button className="btn ghost" onClick={()=>onEdit(p)}>تعديل</button><button className="btn ghost" onClick={()=>onDelete(p)}>حذف</button></div></div><div className="project-title"><span className={`project-avatar ${p.color}`}>{p.name.slice(0,1)}</span><div><h3>{p.name}</h3><small>{p.id} · {p.type}</small></div></div><div className="client-line"><Users size={15}/>{p.client}</div><div className="project-money-grid"><MoneyBox label="السعر بالعراقي" value={money(projectPriceIqd(p))}/><MoneyBox label="السعر بالدولار" value={usdMoney(projectPriceUsd(p))}/><MoneyBox label="المستلم بالعراقي" value={money(f.receivedIqd)}/><MoneyBox label="المستلم بالدولار" value={usdMoney(f.receivedUsd)}/><MoneyBox label="الباقي بالعراقي" value={money(f.remainingIqd)}/><MoneyBox label="الباقي بالدولار" value={usdMoney(f.remainingUsd)}/></div><div className="cost-breakdown"><h4>تفاصيل التكلفة والربح</h4><div className="cost-grid"><CostLine label="الدومين" iqd={f.domainIqd} usd={f.domainUsd}/><CostLine label="AI" iqd={f.aiIqd} usd={f.aiUsd}/><CostLine label="مصاريف أخرى" iqd={f.otherIqd} usd={f.otherUsd}/><CostLine label="إجمالي المصاريف" iqd={f.expensesIqd} usd={f.expensesUsd} strong/><CostLine label="الربح الصافي" iqd={f.profitIqd} usd={f.profitUsd} profit/></div></div><div className="card-progress"><div><span>نسبة الإنجاز</span><strong>{p.progress}%</strong></div><span className="progress"><i style={{width:`${p.progress}%`}}/></span></div><div className="project-card-foot"><span>التسليم المتوقع <b>{p.due}</b></span><button className="text-btn" onClick={onCopy}><Copy size={14}/> نسخ المعرف</button></div></div>})}</div></>
}
function MoneyBox({label,value}){return <div className="money-box"><small>{label}</small><strong>{value}</strong></div>}
function CostLine({label,iqd,usd,strong,profit}){return <div className={`cost-line ${strong?'strong':''} ${profit?'profit':''}`}><span>{label}</span><b>{money(iqd)}</b><b>{usdMoney(usd)}</b></div>}
function Payments({projects,payments,setPayments,notify}){
  const [projectId,setProjectId]=useState('');
  const selected=projects.find(p=>p.id===projectId);
  const rows=payments.filter(x=>x.projectId===projectId);
  const receivedIqd=rows.reduce((a,x)=>a+paymentIqd(x),0);
  const receivedUsd=rows.reduce((a,x)=>a+paymentUsd(x),0);
  const addPayment=e=>{e.preventDefault(); if(!projectId)return; const f=new FormData(e.currentTarget); const p={id:`PAY-${Date.now()}`,projectId,date:f.get('date'),amountIqd:Number(f.get('amountIqd')||0),amountUsd:Number(f.get('amountUsd')||0),method:f.get('method'),type:f.get('type'),note:f.get('note')||''}; setPayments([p,...payments]); e.currentTarget.reset(); notify('تم تسجيل الدفعة وتحديث المشروع');};
  const del=id=>{if(!confirm('حذف هذه الدفعة؟'))return; setPayments(payments.filter(x=>x.id!==id)); notify('تم حذف الدفعة وتحديث المشروع');};
  return <><div className="page-head"><div><h1>الدفعات</h1><p>اختر المشروع ثم سجل العراقي والدولار كل واحد بحسابه</p></div></div><div className="panel selector-panel"><label>اختيار المشروع<select value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">— اختر مشروعاً —</option>{projects.map(p=><option key={p.uid||p.id} value={p.id}>{p.name} — {p.client}</option>)}</select></label></div>{!selected?<div className="placeholder panel"><div className="placeholder-icon"><CreditCard size={28}/></div><h1>اختر مشروعاً</h1><p>تظهر بعدها أسعار المشروع والدفعات والباقي بالعراقي والدولار بشكل مستقل.</p></div>:<><section className="payment-summary"><MoneySummary title="سعر المشروع بالعراقي" value={money(projectPriceIqd(selected))} tone="blue"/><MoneySummary title="سعر المشروع بالدولار" value={usdMoney(projectPriceUsd(selected))} tone="blue"/><MoneySummary title="المستلم بالعراقي" value={money(receivedIqd)} tone="mint"/><MoneySummary title="المستلم بالدولار" value={usdMoney(receivedUsd)} tone="mint"/><MoneySummary title="الباقي بالعراقي" value={money(Math.max(projectPriceIqd(selected)-receivedIqd,0))} tone="orange"/><MoneySummary title="الباقي بالدولار" value={usdMoney(Math.max(projectPriceUsd(selected)-receivedUsd,0))} tone="orange"/></section><div className="panel payment-form-panel"><div className="section-heading"><div><h2>إضافة دفعة</h2><p>{selected.name}</p></div></div><form onSubmit={addPayment} className="form"><label>التاريخ<input name="date" type="date" required/></label><div className="money-fields"><label>المبلغ بالعراقي<input name="amountIqd" type="number" min="0" step="1" placeholder="0"/></label><label>المبلغ بالدولار<input name="amountUsd" type="number" min="0" step="0.01" placeholder="0"/></label></div><label>طريقة الدفع<select name="method"><option>نقدي</option><option>تحويل</option><option>Zain Cash</option><option>Asia Hawala</option><option>Qi Card</option><option>أخرى</option></select></label><label>نوع الدفعة<select name="type"><option>دفعة أولى</option><option>دفعة وسطية</option><option>دفعة نهائية</option><option>صيانة</option><option>خدمة إضافية</option><option>أخرى</option></select></label><label>ملاحظة<input name="note"/></label><div className="form-actions"><button className="btn primary"><Plus size={17}/> تسجيل الدفعة</button></div></form></div><div className="panel payments-history"><h2>سجل الدفعات</h2>{rows.length===0?<p className="empty-copy">لا توجد دفعات لهذا المشروع بعد.</p>:<div className="table-wrap"><table><thead><tr><th>التاريخ</th><th>IQD</th><th>USD</th><th>الطريقة</th><th>النوع</th><th>ملاحظة</th><th/></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.date}</td><td>{money(paymentIqd(r))}</td><td>{usdMoney(paymentUsd(r))}</td><td>{r.method}</td><td>{r.type}</td><td>{r.note||'—'}</td><td><button className="btn ghost" onClick={()=>del(r.id)}>حذف</button></td></tr>)}</tbody></table></div>}</div></>}</>}
function MoneySummary({title,value,tone}){return <div className={`money-summary ${tone}`}><span>{title}</span><strong>{value}</strong></div>}

function Expenses({projects,expenses,setExpenses,notify}){
  const [projectId,setProjectId]=useState('');
  const selected=projects.find(p=>p.id===projectId);
  const rows=expenses.filter(e=>e.projectId===projectId);
  const addExpense=e=>{e.preventDefault(); if(!projectId)return; const f=new FormData(e.currentTarget); const item={id:`EXP-${Date.now()}`,projectId,date:f.get('date'),category:f.get('category'),description:f.get('description'),amountIqd:Number(f.get('amountIqd')||0),amountUsd:Number(f.get('amountUsd')||0)}; setExpenses([item,...expenses]); e.currentTarget.reset(); notify('تمت إضافة المصروف وتحديث المشروع');};
  const del=id=>{if(!confirm('حذف هذا المصروف؟'))return; setExpenses(expenses.filter(e=>e.id!==id)); notify('تم حذف المصروف وتحديث المشروع');};
  return <><div className="page-head"><div><h1>المصاريف</h1><p>ملخص مصاريف كل المشاريع ثم تفاصيل المشروع المختار</p></div></div><div className="expense-projects-grid">{projects.map(p=>{const list=expenses.filter(e=>e.projectId===p.id);const iqd=list.reduce((a,e)=>a+expenseIqd(e),0);const usd=list.reduce((a,e)=>a+expenseUsd(e),0);return <button key={p.uid||p.id} className={`expense-project-card ${projectId===p.id?'active':''}`} onClick={()=>setProjectId(p.id)}><strong>{p.name}</strong><span>{p.client}</span><div><b>{money(iqd)}</b><b>{usdMoney(usd)}</b></div></button>})}</div>{!selected?<div className="placeholder panel"><div className="placeholder-icon"><Receipt size={28}/></div><h1>اختر مشروعاً</h1><p>من الأعلى حتى تضيف أو تراجع مصاريفه.</p></div>:<><div className="panel payment-form-panel"><div className="section-heading"><div><h2>إضافة مصروف</h2><p>{selected.name}</p></div></div><form onSubmit={addExpense} className="form"><label>التاريخ<input name="date" type="date" required/></label><label>التصنيف<select name="category"><option>Domain</option><option>Hosting</option><option>AI / API</option><option>Firebase</option><option>Cloudflare</option><option>Design</option><option>Plugin</option><option>أخرى</option></select></label><label>الوصف<input name="description" required placeholder="مثال: شراء دومين"/></label><div className="money-fields"><label>المبلغ بالعراقي<input name="amountIqd" type="number" min="0" step="1" placeholder="0"/></label><label>المبلغ بالدولار<input name="amountUsd" type="number" min="0" step="0.01" placeholder="0"/></label></div><div className="form-actions"><button className="btn primary"><Plus size={17}/> إضافة المصروف</button></div></form></div><div className="panel payments-history"><h2>مصاريف {selected.name}</h2>{rows.length===0?<p className="empty-copy">لا توجد مصاريف مسجلة لهذا المشروع.</p>:<div className="table-wrap"><table><thead><tr><th>التاريخ</th><th>التصنيف</th><th>الوصف</th><th>IQD</th><th>USD</th><th/></tr></thead><tbody>{rows.map(e=><tr key={e.id}><td>{e.date}</td><td>{e.category}</td><td>{e.description}</td><td>{money(expenseIqd(e))}</td><td>{usdMoney(expenseUsd(e))}</td><td><button className="btn ghost" onClick={()=>del(e.id)}>حذف</button></td></tr>)}</tbody></table></div>}</div></>}</>}

function Domains({projects,expenses,setExpenses,notify}){
  const [projectId,setProjectId]=useState('');
  const selected=projects.find(p=>p.id===projectId);
  const rows=expenses.filter(e=>e.projectId===projectId&&e.category==='Domain');
  const addDomain=e=>{e.preventDefault();if(!projectId)return;const f=new FormData(e.currentTarget);const item={id:`EXP-${Date.now()}`,projectId,date:f.get('date'),category:'Domain',description:f.get('domainName')||'Domain',domainName:f.get('domainName')||'',provider:f.get('provider')||'',expiryDate:f.get('expiryDate')||'',amountIqd:Number(f.get('amountIqd')||0),amountUsd:Number(f.get('amountUsd')||0)};setExpenses([item,...expenses]);e.currentTarget.reset();notify('تمت إضافة تكلفة الدومين وتحديث ربح المشروع');};
  const del=id=>{if(!confirm('حذف تكلفة هذا الدومين؟'))return;setExpenses(expenses.filter(e=>e.id!==id));notify('تم حذف تكلفة الدومين وتحديث المشروع');};
  return <><div className="page-head"><div><h1>الدومينات</h1><p>اختر المشروع ثم أضف الدومين وتكلفته الفعلية</p></div></div><div className="panel selector-panel"><label>المشروع<select value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">— اختر مشروعاً —</option>{projects.map(p=><option key={p.uid||p.id} value={p.id}>{p.name} — {p.client}</option>)}</select></label></div>{!selected?<div className="placeholder panel"><div className="placeholder-icon"><Globe2 size={28}/></div><h1>اختر مشروعاً</h1><p>بعد اختيار المشروع تقدر تضيف الدومين وسعره بالعراقي والدولار.</p></div>:<><div className="panel payment-form-panel"><div className="section-heading"><div><h2>إضافة دومين</h2><p>{selected.name}</p></div></div><form onSubmit={addDomain} className="form"><label>اسم الدومين<input name="domainName" required placeholder="example.com"/></label><label>الشركة / المزود<input name="provider" placeholder="Cloudflare / Namecheap ..."/></label><div className="money-fields"><label>التكلفة بالعراقي<input name="amountIqd" type="number" min="0" step="1" placeholder="0"/></label><label>التكلفة بالدولار<input name="amountUsd" type="number" min="0" step="0.01" placeholder="0"/></label></div><div className="money-fields"><label>تاريخ الشراء<input name="date" type="date" required/></label><label>تاريخ الانتهاء<input name="expiryDate" type="date"/></label></div><div className="form-actions"><button className="btn primary"><Plus size={17}/> حفظ الدومين</button></div></form></div><div className="panel payments-history"><h2>دومينات {selected.name}</h2>{rows.length===0?<p className="empty-copy">لا توجد دومينات مسجلة لهذا المشروع.</p>:<div className="table-wrap"><table><thead><tr><th>الدومين</th><th>المزود</th><th>IQD</th><th>USD</th><th>الانتهاء</th><th/></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.domainName||r.description}</td><td>{r.provider||'—'}</td><td>{money(expenseIqd(r))}</td><td>{usdMoney(expenseUsd(r))}</td><td>{r.expiryDate||'—'}</td><td><button className="btn ghost" onClick={()=>del(r.id)}>حذف</button></td></tr>)}</tbody></table></div>}</div></>}</>
}

function AIExpenses({projects,expenses,setExpenses,notify}){
  const [projectId,setProjectId]=useState('');
  const selected=projects.find(p=>p.id===projectId);
  const rows=expenses.filter(e=>e.projectId===projectId&&e.category==='AI / API');
  const addAI=e=>{e.preventDefault();if(!projectId)return;const f=new FormData(e.currentTarget);const tool=f.get('tool');const item={id:`EXP-${Date.now()}`,projectId,date:f.get('date'),category:'AI / API',description:tool,aiTool:tool,notes:f.get('notes')||'',amountIqd:Number(f.get('amountIqd')||0),amountUsd:Number(f.get('amountUsd')||0)};setExpenses([item,...expenses]);e.currentTarget.reset();notify('تمت إضافة تكلفة AI وتحديث ربح المشروع');};
  const del=id=>{if(!confirm('حذف تكلفة AI؟'))return;setExpenses(expenses.filter(e=>e.id!==id));notify('تم حذف تكلفة AI وتحديث المشروع');};
  return <><div className="page-head"><div><h1>AI والأدوات</h1><p>تكلفة الذكاء الاصطناعي لكل مشروع بشكل مستقل</p></div></div><div className="panel selector-panel"><label>المشروع<select value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">— اختر مشروعاً —</option>{projects.map(p=><option key={p.uid||p.id} value={p.id}>{p.name} — {p.client}</option>)}</select></label></div>{!selected?<div className="placeholder panel"><div className="placeholder-icon"><Sparkles size={28}/></div><h1>اختر مشروعاً</h1><p>بعدها أضف تكلفة ChatGPT أو OpenAI أو Claude أو أي أداة AI.</p></div>:<><div className="panel payment-form-panel"><div className="section-heading"><div><h2>إضافة تكلفة AI</h2><p>{selected.name}</p></div></div><form onSubmit={addAI} className="form"><label>الأداة<select name="tool"><option>ChatGPT</option><option>OpenAI API</option><option>Claude</option><option>Gemini</option><option>Cursor</option><option>GitHub Copilot</option><option>أداة AI أخرى</option></select></label><div className="money-fields"><label>التكلفة بالعراقي<input name="amountIqd" type="number" min="0" step="1" placeholder="0"/></label><label>التكلفة بالدولار<input name="amountUsd" type="number" min="0" step="0.01" placeholder="0"/></label></div><label>التاريخ<input name="date" type="date" required/></label><label>ملاحظة<input name="notes" placeholder="مثال: API لهذا المشروع"/></label><div className="form-actions"><button className="btn primary"><Plus size={17}/> حفظ تكلفة AI</button></div></form></div><div className="panel payments-history"><h2>تكاليف AI — {selected.name}</h2>{rows.length===0?<p className="empty-copy">لا توجد تكاليف AI لهذا المشروع بعد.</p>:<div className="table-wrap"><table><thead><tr><th>الأداة</th><th>التاريخ</th><th>IQD</th><th>USD</th><th>ملاحظة</th><th/></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.aiTool||r.description}</td><td>{r.date}</td><td>{money(expenseIqd(r))}</td><td>{usdMoney(expenseUsd(r))}</td><td>{r.notes||'—'}</td><td><button className="btn ghost" onClick={()=>del(r.id)}>حذف</button></td></tr>)}</tbody></table></div>}</div></>}</>
}

function SettingsPage(){return <><div className="page-head"><div><h1>الإعدادات</h1><p>إعدادات النظام الشخصي</p></div></div><div className="panel" style={{padding:20,maxWidth:620}}><h2 style={{marginTop:0}}>العملات</h2><p style={{color:'#64748b'}}>أسعار المشاريع والدفعات والمصاريف محفوظة بالعراقي والدولار بشكل مستقل، بدون تحويل تلقائي.</p></div></>}

function Placeholder({page,onAdd}){const meta={clients:['العملاء','ملفات العملاء والعلاقة المالية لكل عميل',Users],payments:['الدفعات','تتبع المستحقات والدفعات المكتملة',CreditCard],expenses:['المصاريف','مصروفات المشاريع والمصاريف العامة',Receipt],reports:['التقارير','قراءة أعمق لأداء المشاريع والربحية',BarChart3],settings:['الإعدادات','تخصيص النظام والنسخ الاحتياطي',Settings]}[page]||['الصفحة','قيد التجهيز',Gauge]; const Icon=meta[2];return <div className="placeholder panel"><div className="placeholder-icon"><Icon size={28}/></div><h1>{meta[0]}</h1><p>{meta[1]}</p><button className="btn primary" onClick={onAdd}><Plus size={17}/> إضافة جديد</button></div>}
function Modal({title,close,children}){return <div className="modal-backdrop" onMouseDown={close}><div className="modal" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><h2>{title}</h2><button className="more" onClick={close}><X size={19}/></button></div>{children}</div></div>}
createRoot(document.getElementById('root')).render(<ErrorBoundary><AuthGate><App/></AuthGate></ErrorBoundary>);
