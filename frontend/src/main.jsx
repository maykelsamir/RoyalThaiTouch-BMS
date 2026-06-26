import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BarChart3, Building2, CalendarDays, Download, FileText, ListChecks, Plus, Printer, RefreshCcw, Save, Settings, Trash2, Users } from 'lucide-react';
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import './style.css';

const API = 'http://localhost:8000';
const todayISO = () => new Date().toISOString().slice(0, 10);
const firstDayOfMonthISO = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const formatIQD = v => 'IQD ' + Number(v || 0).toLocaleString('en-US');
const compactNumber = v => Number(v || 0).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const loadEmployees = () => { try { return JSON.parse(localStorage.getItem('rtt_employees') || '[]'); } catch { return []; } };

function TrendChart({ data }) {
  const rows = (data || []).map(x => ({ ...x, label: String(x.date || '').slice(5) }));
  return <div className="rechartBox"><ResponsiveContainer width="100%" height={290}><AreaChart data={rows}><CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false}/><XAxis dataKey="label" stroke="#a1a1aa" tick={{ fontSize: 11 }}/><YAxis stroke="#a1a1aa" tickFormatter={compactNumber} tick={{ fontSize: 11 }}/><Tooltip contentStyle={{ background: '#101217', border: '1px solid rgba(212,175,55,.25)', borderRadius: 12, color: '#fff' }} formatter={v => formatIQD(v)} labelStyle={{ color: '#d4af37' }}/><Legend/><Area type="monotone" dataKey="revenue" name="Revenue" stroke="#d4af37" fill="#d4af37" fillOpacity={0.18} strokeWidth={3}/><Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ff6b6b" fill="#ff6b6b" fillOpacity={0.12} strokeWidth={3}/><Area type="monotone" dataKey="profit" name="Profit" stroke="#53d769" fill="#53d769" fillOpacity={0.12} strokeWidth={3}/></AreaChart></ResponsiveContainer></div>;
}

function App() {
  const [page, setPage] = useState('dashboard');
  const [businessDate, setBusinessDate] = useState(todayISO());
  const [dashboard, setDashboard] = useState(null);
  const [trend, setTrend] = useState([]);
  const [branches, setBranches] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [message, setMessage] = useState('');
  const [report, setReport] = useState(null);
  const [reportRange, setReportRange] = useState({ from: firstDayOfMonthISO(), to: todayISO() });
  const [branchForm, setBranchForm] = useState({ name: '', address: 'Erbil' });
  const [employees, setEmployees] = useState(loadEmployees);
  const [employeeForm, setEmployeeForm] = useState({ name: '', branch_id: '', role: '', salary: '', phone: '', passportImage: '', residenceImage: '' });
  const [entry, setEntry] = useState({ branch_id: '', business_date: todayISO(), revenue: '', notes: '', expenses: [{ category: 'Other Expenses', amount: '', notes: '' }] });

  async function apiFetch(path, options = {}) {
    const res = await fetch(API + path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Request failed');
    return res.json();
  }

  async function loadData(dateValue = businessDate) {
    const [dash, branchList, trendRows] = await Promise.all([apiFetch(`/dashboard?business_date=${dateValue}`), apiFetch('/branches'), apiFetch('/dashboard/trend?days=30')]);
    setDashboard(dash); setBranches(branchList); setTrend(trendRows);
    if (!entry.branch_id && branchList.length) {
      const id = String(branchList[0].id);
      setEntry(p => ({ ...p, branch_id: id }));
      setEmployeeForm(p => ({ ...p, branch_id: p.branch_id || id }));
      setTimeout(() => loadEntry(id, entry.business_date), 100);
    }
  }

  async function loadReport() { setReport(await apiFetch(`/reports/summary?date_from=${reportRange.from}&date_to=${reportRange.to}`)); }
  async function loadAuditLogs() { setAuditLogs(await apiFetch('/audit-logs')); }
  useEffect(() => { loadData().catch(() => setMessage('Backend is starting. Please wait 30 seconds then refresh.')); }, []);
  useEffect(() => { localStorage.setItem('rtt_employees', JSON.stringify(employees)); }, [employees]);

  async function loadEntry(branchId = entry.branch_id, dateValue = entry.business_date) {
    if (!branchId || !dateValue) return;
    const data = await apiFetch(`/daily-entry?branch_id=${branchId}&business_date=${dateValue}`);
    setEntry({ branch_id: String(data.branch_id), business_date: data.business_date, revenue: data.revenue ? String(data.revenue) : '', notes: data.notes || '', expenses: data.expenses.length ? data.expenses.map(e => ({ category: e.category || 'Other Expenses', amount: e.amount ? String(e.amount) : '', notes: e.notes || '' })) : [{ category: 'Other Expenses', amount: '', notes: '' }] });
  }

  async function saveEntry(e) { e.preventDefault(); await apiFetch('/daily-entry', { method: 'POST', body: JSON.stringify({ branch_id: Number(entry.branch_id), business_date: entry.business_date, revenue: Number(entry.revenue || 0), notes: entry.notes, expenses: entry.expenses.map(x => ({ category: x.category || 'Other Expenses', amount: Number(x.amount || 0), notes: x.notes || '' })) }) }); setMessage('Saved successfully'); await loadData(entry.business_date); }
  async function createBranch(e) { e.preventDefault(); await apiFetch('/branches', { method: 'POST', body: JSON.stringify({ name: branchForm.name, address: branchForm.address, active: true }) }); setBranchForm({ name: '', address: 'Erbil' }); setMessage('Branch created successfully'); await loadData(); }
  async function closeDay() { await apiFetch(`/daily-entry/close?branch_id=${entry.branch_id}&business_date=${entry.business_date}`, { method: 'POST' }); setMessage('Day closed successfully'); await loadData(entry.business_date); }
  function addExpense() { setEntry(p => ({ ...p, expenses: [...p.expenses, { category: 'Other Expenses', amount: '', notes: '' }] })); }
  function removeExpense(i) { setEntry(p => ({ ...p, expenses: p.expenses.filter((_, idx) => idx !== i) })); }
  function updateExpense(i, f, v) { setEntry(p => ({ ...p, expenses: p.expenses.map((x, idx) => idx === i ? { ...x, [f]: v } : x) })); }
  function exportExcel() { window.open(`${API}/reports/excel?date_from=${reportRange.from}&date_to=${reportRange.to}`, '_blank'); }
  function exportPdf() { window.open(`${API}/reports/pdf?date_from=${reportRange.from}&date_to=${reportRange.to}`, '_blank'); }
  function fileToBase64(field, file) { if (!file) return; const r = new FileReader(); r.onload = () => setEmployeeForm(p => ({ ...p, [field]: r.result })); r.readAsDataURL(file); }
  function addEmployee(e) { e.preventDefault(); const branch = branches.find(b => String(b.id) === String(employeeForm.branch_id)); setEmployees(p => [{ ...employeeForm, id: Date.now(), branch: branch?.name || '-', salary: Number(employeeForm.salary || 0), created_at: new Date().toISOString() }, ...p]); setEmployeeForm({ name: '', branch_id: employeeForm.branch_id, role: '', salary: '', phone: '', passportImage: '', residenceImage: '' }); }
  function printEmployee(emp) { const w = window.open('', '_blank'); w.document.write(`<html><body style="font-family:Arial;padding:24px"><h1>Royal Thai Touch - Employee File</h1><p><b>Name:</b> ${emp.name}</p><p><b>Branch:</b> ${emp.branch}</p><p><b>Job:</b> ${emp.role || '-'}</p><p><b>Salary:</b> ${formatIQD(emp.salary)}</p><p><b>Phone:</b> ${emp.phone || '-'}</p><h3>Passport</h3>${emp.passportImage ? `<img style="max-width:100%" src="${emp.passportImage}"/>` : 'No image'}<h3>Residence ID</h3>${emp.residenceImage ? `<img style="max-width:100%" src="${emp.residenceImage}"/>` : 'No image'}<script>window.print()</script></body></html>`); w.document.close(); }

  const expenseTotal = useMemo(() => entry.expenses.reduce((s, x) => s + Number(x.amount || 0), 0), [entry.expenses]);
  const entryProfit = Number(entry.revenue || 0) - expenseTotal;
  const totalSalaries = employees.reduce((s, e) => s + Number(e.salary || 0), 0);
  const title = page === 'dashboard' ? 'Executive Dashboard' : page === 'entry' ? 'Daily Entry' : page === 'reports' ? 'Reports' : page === 'branches' ? 'Branches' : page === 'employees' ? 'Employees' : page === 'audit' ? 'Audit Log' : 'Settings';

  return <div className="appShell"><aside className="sidebar"><div className="brand"><div className="brandLogo">RTT</div><div><h1>Royal Thai Touch</h1><span>ERP v0.8.5</span></div></div><nav><button className={page==='dashboard'?'active':''} onClick={()=>setPage('dashboard')}><BarChart3 size={18}/> Dashboard</button><button className={page==='entry'?'active':''} onClick={()=>setPage('entry')}><Save size={18}/> Daily Entry</button><button className={page==='reports'?'active':''} onClick={()=>{setPage('reports');setTimeout(loadReport,100);}}><Download size={18}/> Reports</button><button className={page==='branches'?'active':''} onClick={()=>setPage('branches')}><Building2 size={18}/> Branches</button><button className={page==='employees'?'active':''} onClick={()=>setPage('employees')}><Users size={18}/> Employees</button><button className={page==='audit'?'active':''} onClick={()=>{setPage('audit');setTimeout(loadAuditLogs,100);}}><ListChecks size={18}/> Audit Log</button><button className={page==='settings'?'active':''} onClick={()=>setPage('settings')}><Settings size={18}/> Settings</button></nav></aside><main className="content"><header className="topbar"><div><h2>{title}</h2><p>Royal Thai Touch ERP financial control center</p></div><div className="dateBox"><CalendarDays size={18}/><input type="date" value={businessDate} onChange={async e=>{setBusinessDate(e.target.value);await loadData(e.target.value);}}/><button onClick={()=>loadData()}><RefreshCcw size={16}/> Refresh</button></div></header>{message&&<div className="notice">{message}</div>}

{page==='dashboard'&&<><section className="cards"><div className="metric"><span>Revenue Today</span><strong>{formatIQD(dashboard?.total_revenue)}</strong></div><div className="metric danger"><span>Expenses Today</span><strong>{formatIQD(dashboard?.total_expenses)}</strong></div><div className="metric gold"><span>Net Profit</span><strong>{formatIQD(dashboard?.net_profit)}</strong></div><div className="metric"><span>Month Profit</span><strong>{formatIQD(dashboard?.month_profit)}</strong></div></section><section className="panel"><h3>30-Day Revenue / Expenses / Profit Trend</h3><TrendChart data={trend}/></section><section className="panel"><h3>Branch Performance</h3><table><thead><tr><th>Branch</th><th>Revenue</th><th>Expenses</th><th>Net Profit</th><th>Status</th></tr></thead><tbody>{dashboard?.branches?.map(r=><tr key={r.branch_id}><td>{r.branch}</td><td>{formatIQD(r.revenue)}</td><td>{formatIQD(r.expenses)}</td><td>{formatIQD(r.net_profit)}</td><td><span className={'status '+r.status.toLowerCase()}>{r.status}</span></td></tr>)}</tbody></table></section></>}

{page==='entry'&&<section className="entryLayout"><form className="panel entryPanel" onSubmit={saveEntry}><h3>Save Day</h3><label>Branch</label><select value={entry.branch_id} onChange={async e=>{const id=e.target.value;setEntry({...entry,branch_id:id});await loadEntry(id,entry.business_date);}}>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><label>Date</label><input type="date" value={entry.business_date} onChange={async e=>{const d=e.target.value;setEntry({...entry,business_date:d});await loadEntry(entry.branch_id,d);}}/><label>Daily Revenue</label><input type="number" value={entry.revenue} onChange={e=>setEntry({...entry,revenue:e.target.value})}/><label>Revenue Notes</label><textarea value={entry.notes} onChange={e=>setEntry({...entry,notes:e.target.value})}/><div className="expenseHeader"><h4>Expenses</h4><button type="button" onClick={addExpense}><Plus size={16}/> Add Expense</button></div>{entry.expenses.map((x,i)=><div className="expenseRow" key={i}><input value={x.category} onChange={e=>updateExpense(i,'category',e.target.value)}/><input type="number" value={x.amount} onChange={e=>updateExpense(i,'amount',e.target.value)}/><input value={x.notes} onChange={e=>updateExpense(i,'notes',e.target.value)}/><button type="button" className="iconBtn" onClick={()=>removeExpense(i)}><Trash2 size={16}/></button></div>)}<button className="primaryBtn">Save Day</button><button type="button" className="secondaryBtn" onClick={closeDay}>Close Day</button></form><div className="panel summaryPanel"><h3>Daily Summary</h3><div className="summaryLine"><span>Revenue</span><strong>{formatIQD(entry.revenue)}</strong></div><div className="summaryLine"><span>Expenses</span><strong>{formatIQD(expenseTotal)}</strong></div><div className="summaryLine total"><span>Net Profit</span><strong>{formatIQD(entryProfit)}</strong></div></div></section>}

{page==='reports'&&<><section className="panel reportPanel"><h3>Reports</h3><div className="reportControls"><label>From</label><input type="date" value={reportRange.from} onChange={e=>setReportRange({...reportRange,from:e.target.value})}/><label>To</label><input type="date" value={reportRange.to} onChange={e=>setReportRange({...reportRange,to:e.target.value})}/><button onClick={loadReport}><BarChart3 size={18}/> Show</button><button onClick={exportExcel}><Download size={18}/> Export Excel</button><button onClick={exportPdf}><FileText size={18}/> Export PDF</button></div></section>{report&&<><section className="cards"><div className="metric"><span>Total Revenue</span><strong>{formatIQD(report.total_revenue)}</strong></div><div className="metric danger"><span>Total Expenses</span><strong>{formatIQD(report.total_expenses)}</strong></div><div className="metric gold"><span>Net Profit</span><strong>{formatIQD(report.net_profit)}</strong></div></section><section className="panel"><h3>Branch Totals</h3><table><thead><tr><th>Branch</th><th>Revenue</th><th>Expenses</th><th>Net Profit</th></tr></thead><tbody>{report.branch_totals.map(r=><tr key={r.branch}><td>{r.branch}</td><td>{formatIQD(r.revenue)}</td><td>{formatIQD(r.expenses)}</td><td>{formatIQD(r.net_profit)}</td></tr>)}</tbody></table></section><section className="panel"><h3>Daily Breakdown</h3><table><thead><tr><th>Date</th><th>Revenue</th><th>Expenses</th><th>Net Profit</th></tr></thead><tbody>{report.daily_rows.map(r=><tr key={r.date}><td>{r.date}</td><td>{formatIQD(r.revenue)}</td><td>{formatIQD(r.expenses)}</td><td>{formatIQD(r.net_profit)}</td></tr>)}</tbody></table></section></>}</>}

{page==='branches'&&<><section className="panel"><h3>Add Branch</h3><form className="inlineForm" onSubmit={createBranch}><input value={branchForm.name} onChange={e=>setBranchForm({...branchForm,name:e.target.value})} placeholder="Branch name" required/><input value={branchForm.address} onChange={e=>setBranchForm({...branchForm,address:e.target.value})} placeholder="Address"/><button><Plus size={16}/> Add Branch</button></form></section><section className="panel"><h3>Branches</h3><table><thead><tr><th>ID</th><th>Branch</th><th>Address</th><th>Status</th></tr></thead><tbody>{branches.map(b=><tr key={b.id}><td>{b.id}</td><td>{b.name}</td><td>{b.address}</td><td>Active</td></tr>)}</tbody></table></section></>}

{page==='employees'&&<><section className="cards"><div className="metric"><span>Employees</span><strong>{employees.length}</strong></div><div className="metric gold"><span>Monthly Salaries</span><strong>{formatIQD(totalSalaries)}</strong></div></section><section className="panel"><h3>Add Employee</h3><form className="employeeForm" onSubmit={addEmployee}><input required value={employeeForm.name} onChange={e=>setEmployeeForm({...employeeForm,name:e.target.value})} placeholder="Employee name"/><select value={employeeForm.branch_id} onChange={e=>setEmployeeForm({...employeeForm,branch_id:e.target.value})}>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><input value={employeeForm.role} onChange={e=>setEmployeeForm({...employeeForm,role:e.target.value})} placeholder="Job"/><input type="number" value={employeeForm.salary} onChange={e=>setEmployeeForm({...employeeForm,salary:e.target.value})} placeholder="Monthly salary"/><input value={employeeForm.phone} onChange={e=>setEmployeeForm({...employeeForm,phone:e.target.value})} placeholder="Phone"/><label>Passport image<input type="file" accept="image/*" onChange={e=>fileToBase64('passportImage',e.target.files[0])}/></label><label>Residence ID image<input type="file" accept="image/*" onChange={e=>fileToBase64('residenceImage',e.target.files[0])}/></label><button><Save size={16}/> Save Employee</button></form></section><section className="panel"><h3>Employees List</h3><table><thead><tr><th>Name</th><th>Branch</th><th>Job</th><th>Salary</th><th>Documents</th><th>Actions</th></tr></thead><tbody>{employees.map(emp=><tr key={emp.id}><td>{emp.name}</td><td>{emp.branch}</td><td>{emp.role||'-'}</td><td>{formatIQD(emp.salary)}</td><td>{emp.passportImage?'Passport ':''}{emp.residenceImage?'Residence ID':''}</td><td><div className="buttonGroup"><button onClick={()=>printEmployee(emp)}><Printer size={16}/> Print</button><button className="iconBtn" onClick={()=>setEmployees(p=>p.filter(x=>x.id!==emp.id))}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></section></>}

{page==='audit'&&<section className="panel"><div className="splitPanel"><h3>Last 100 Operations</h3><button onClick={loadAuditLogs}><RefreshCcw size={16}/> Refresh</button></div><table><thead><tr><th>ID</th><th>Action</th><th>Entity</th><th>Details</th><th>Date</th></tr></thead><tbody>{auditLogs.map(l=><tr key={l.id}><td>{l.id}</td><td>{l.action}</td><td>{l.entity}</td><td>{l.details}</td><td>{l.created_at?new Date(l.created_at).toLocaleString():'-'}</td></tr>)}</tbody></table></section>}
{page==='settings'&&<section className="panel"><h3>Settings</h3><p>Company: Royal Thai Touch</p><p>Currency: IQD</p><p>Export buttons are available only inside Reports.</p></section>}
</main></div>;
}

createRoot(document.getElementById('root')).render(<App />);
