import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BarChart3, Building2, CalendarDays, Download, FileText, ListChecks, Plus, Printer, RefreshCcw, Save, Settings, Trash2, Users } from 'lucide-react';
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import './style.css';

const API = 'http://localhost:8000';

function formatIQD(value) {
  return 'IQD ' + Number(value || 0).toLocaleString('en-US');
}

function compactNumber(value) {
  return Number(value || 0).toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function loadEmployeesFromStorage() {
  try {
    return JSON.parse(localStorage.getItem('rtt_employees') || '[]');
  } catch {
    return [];
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function downloadFile(filename, mimeType, content) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildHtmlTable(title, rows) {
  const headers = rows.length ? Object.keys(rows[0]) : ['No Data'];
  const body = rows.length ? rows : [{ 'No Data': '-' }];
  return `<!doctype html><html><head><meta charset="utf-8"/><style>
    body{font-family:Arial,sans-serif;padding:24px;color:#111} h1{color:#111} h2{color:#8a6a13}
    table{width:100%;border-collapse:collapse;margin-top:18px} th{background:#111;color:#d4af37}
    th,td{border:1px solid #999;padding:8px;text-align:left} .meta{color:#555;margin-bottom:16px}
  </style></head><body><h1>Royal Thai Touch ERP</h1><h2>${escapeHtml(title)}</h2><div class="meta">Generated: ${new Date().toLocaleString()}</div><table><thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${body.map(row => `<tr>${headers.map(h => `<td>${escapeHtml(row[h])}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
}

function TrendChart({ data }) {
  const rows = (data || []).map(x => ({ ...x, label: String(x.date || '').slice(5) }));
  return (
    <div className="rechartBox">
      <ResponsiveContainer width="100%" height={290}>
        <AreaChart data={rows} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
          <XAxis dataKey="label" stroke="#a1a1aa" tick={{ fontSize: 11 }} />
          <YAxis stroke="#a1a1aa" tickFormatter={compactNumber} tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ background: '#101217', border: '1px solid rgba(212,175,55,.25)', borderRadius: 12, color: '#fff' }} formatter={(value) => formatIQD(value)} labelStyle={{ color: '#d4af37' }} />
          <Legend />
          <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#d4af37" fill="#d4af37" fillOpacity={0.18} strokeWidth={3} />
          <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ff6b6b" fill="#ff6b6b" fillOpacity={0.12} strokeWidth={3} />
          <Area type="monotone" dataKey="profit" name="Profit" stroke="#53d769" fill="#53d769" fillOpacity={0.12} strokeWidth={3} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
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
  const [employees, setEmployees] = useState(loadEmployeesFromStorage);
  const [employeeForm, setEmployeeForm] = useState({ name: '', branch_id: '', role: '', salary: '', phone: '', passportImage: '', residenceImage: '' });
  const [entry, setEntry] = useState({ branch_id: '', business_date: todayISO(), revenue: '', notes: '', expenses: [{ category: 'Other Expenses', amount: '', notes: '' }] });

  async function apiFetch(path, options = {}) {
    const res = await fetch(API + path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || 'Request failed');
    }
    return res.json();
  }

  async function loadData(dateValue = businessDate) {
    const [dash, branchList, trendRows] = await Promise.all([
      apiFetch(`/dashboard?business_date=${dateValue}`),
      apiFetch('/branches'),
      apiFetch('/dashboard/trend?days=30')
    ]);
    setDashboard(dash);
    setBranches(branchList);
    setTrend(trendRows);
    if (!entry.branch_id && branchList.length) {
      const branchId = String(branchList[0].id);
      setEntry(prev => ({ ...prev, branch_id: branchId }));
      setEmployeeForm(prev => ({ ...prev, branch_id: prev.branch_id || branchId }));
      setTimeout(() => loadEntry(branchId, entry.business_date), 100);
    }
  }

  async function loadReport() {
    const data = await apiFetch(`/reports/summary?date_from=${reportRange.from}&date_to=${reportRange.to}`);
    setReport(data);
  }

  async function loadAuditLogs() {
    const data = await apiFetch('/audit-logs');
    setAuditLogs(data);
  }

  useEffect(() => {
    loadData().catch(() => setMessage('Backend is starting. Please wait 30 seconds then refresh.'));
  }, []);

  useEffect(() => {
    localStorage.setItem('rtt_employees', JSON.stringify(employees));
  }, [employees]);

  async function loadEntry(branchId = entry.branch_id, dateValue = entry.business_date) {
    if (!branchId || !dateValue) return;
    const data = await apiFetch(`/daily-entry?branch_id=${branchId}&business_date=${dateValue}`);
    setEntry({
      branch_id: String(data.branch_id),
      business_date: data.business_date,
      revenue: data.revenue ? String(data.revenue) : '',
      notes: data.notes || '',
      expenses: data.expenses.length ? data.expenses.map(e => ({ category: e.category || 'Other Expenses', amount: e.amount ? String(e.amount) : '', notes: e.notes || '' })) : [{ category: 'Other Expenses', amount: '', notes: '' }]
    });
  }

  async function saveEntry(e) {
    e.preventDefault();
    setMessage('');
    try {
      await apiFetch('/daily-entry', {
        method: 'POST',
        body: JSON.stringify({
          branch_id: Number(entry.branch_id),
          business_date: entry.business_date,
          revenue: Number(entry.revenue || 0),
          notes: entry.notes,
          expenses: entry.expenses.map(x => ({ category: x.category || 'Other Expenses', amount: Number(x.amount || 0), notes: x.notes || '' }))
        })
      });
      setMessage('Saved successfully');
      await loadData(entry.business_date);
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function createBranch(e) {
    e.preventDefault();
    setMessage('');
    try {
      await apiFetch('/branches', { method: 'POST', body: JSON.stringify({ name: branchForm.name, address: branchForm.address, active: true }) });
      setBranchForm({ name: '', address: 'Erbil' });
      setMessage('Branch created successfully');
      await loadData();
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function closeDay() {
    try {
      await apiFetch(`/daily-entry/close?branch_id=${entry.branch_id}&business_date=${entry.business_date}`, { method: 'POST' });
      setMessage('Day closed successfully');
      await loadData(entry.business_date);
    } catch (err) {
      setMessage(err.message);
    }
  }

  function addExpense() {
    setEntry(prev => ({ ...prev, expenses: [...prev.expenses, { category: 'Other Expenses', amount: '', notes: '' }] }));
  }

  function removeExpense(index) {
    setEntry(prev => ({ ...prev, expenses: prev.expenses.filter((_, i) => i !== index) }));
  }

  function updateExpense(index, field, value) {
    setEntry(prev => ({ ...prev, expenses: prev.expenses.map((x, i) => i === index ? { ...x, [field]: value } : x) }));
  }

  function exportExcel(from = reportRange.from, to = reportRange.to) {
    window.open(`${API}/reports/excel?date_from=${from}&date_to=${to}`, '_blank');
  }

  function exportPdf(from = reportRange.from, to = reportRange.to) {
    window.open(`${API}/reports/pdf?date_from=${from}&date_to=${to}`, '_blank');
  }

  function fileToBase64(field, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setEmployeeForm(prev => ({ ...prev, [field]: reader.result }));
    reader.readAsDataURL(file);
  }

  function addEmployee(e) {
    e.preventDefault();
    const branch = branches.find(b => String(b.id) === String(employeeForm.branch_id));
    const row = { ...employeeForm, id: Date.now(), branch: branch?.name || '-', salary: Number(employeeForm.salary || 0), created_at: new Date().toISOString() };
    setEmployees(prev => [row, ...prev]);
    setEmployeeForm({ name: '', branch_id: employeeForm.branch_id, role: '', salary: '', phone: '', passportImage: '', residenceImage: '' });
    setMessage('Employee saved successfully');
  }

  function deleteEmployee(id) {
    setEmployees(prev => prev.filter(x => x.id !== id));
  }

  function printEmployee(emp) {
    const html = buildHtmlTable(`Employee File - ${emp.name}`, [{
      Name: emp.name,
      Branch: emp.branch,
      Job: emp.role || '-',
      Salary: formatIQD(emp.salary),
      Phone: emp.phone || '-'
    }]) + `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:24px"><div><h3>Passport</h3>${emp.passportImage ? `<img style="max-width:100%" src="${emp.passportImage}"/>` : 'No image'}</div><div><h3>Residence ID</h3>${emp.residenceImage ? `<img style="max-width:100%" src="${emp.residenceImage}"/>` : 'No image'}</div></div>`;
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  function currentExportRows() {
    if (page === 'dashboard') return (dashboard?.branches || []).map(r => ({ Branch: r.branch, Revenue: formatIQD(r.revenue), Expenses: formatIQD(r.expenses), NetProfit: formatIQD(r.net_profit), Status: r.status }));
    if (page === 'entry') return [{ BranchID: entry.branch_id, Date: entry.business_date, Revenue: formatIQD(entry.revenue), Expenses: formatIQD(expenseTotal), NetProfit: formatIQD(entryProfit), Notes: entry.notes || '-' }, ...entry.expenses.map(x => ({ BranchID: entry.branch_id, Date: entry.business_date, ExpenseCategory: x.category, ExpenseAmount: formatIQD(x.amount), Notes: x.notes || '-' }))];
    if (page === 'reports') return report ? [...report.branch_totals.map(r => ({ Type: 'Branch Total', Name: r.branch, Revenue: formatIQD(r.revenue), Expenses: formatIQD(r.expenses), NetProfit: formatIQD(r.net_profit) })), ...report.daily_rows.map(r => ({ Type: 'Daily', Name: r.date, Revenue: formatIQD(r.revenue), Expenses: formatIQD(r.expenses), NetProfit: formatIQD(r.net_profit) }))] : [];
    if (page === 'branches') return branches.map(b => ({ ID: b.id, Branch: b.name, Address: b.address, Status: 'Active' }));
    if (page === 'employees') return employees.map(e => ({ Name: e.name, Branch: e.branch, Job: e.role || '-', Salary: formatIQD(e.salary), Phone: e.phone || '-', Passport: e.passportImage ? 'Available' : 'Missing', ResidenceID: e.residenceImage ? 'Available' : 'Missing' }));
    if (page === 'audit') return auditLogs.map(l => ({ ID: l.id, Action: l.action, Entity: l.entity, Details: l.details, Date: l.created_at ? new Date(l.created_at).toLocaleString() : '-' }));
    return [{ Setting: 'Company', Value: 'Royal Thai Touch' }, { Setting: 'Currency', Value: 'IQD' }];
  }

  function currentTitle() {
    return page === 'dashboard' ? 'Dashboard' : page === 'entry' ? 'Daily Entry' : page === 'reports' ? 'Reports' : page === 'branches' ? 'Branches' : page === 'employees' ? 'Employees' : page === 'audit' ? 'Audit Log' : 'Settings';
  }

  function exportCurrentExcel() {
    if (page === 'reports') return exportExcel();
    const html = buildHtmlTable(currentTitle(), currentExportRows());
    downloadFile(`royal-thai-touch-${page}-${todayISO()}.xls`, 'application/vnd.ms-excel;charset=utf-8', html);
  }

  function exportCurrentPdf() {
    if (page === 'reports') return exportPdf();
    const html = buildHtmlTable(currentTitle(), currentExportRows());
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  const expenseTotal = useMemo(() => entry.expenses.reduce((sum, x) => sum + Number(x.amount || 0), 0), [entry.expenses]);
  const entryProfit = Number(entry.revenue || 0) - expenseTotal;
  const totalSalaries = employees.reduce((s, e) => s + Number(e.salary || 0), 0);

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand"><div className="brandLogo">RTT</div><div><h1>Royal Thai Touch</h1><span>ERP v0.8.4</span></div></div>
        <nav>
          <button className={page === 'dashboard' ? 'active' : ''} onClick={() => setPage('dashboard')}><BarChart3 size={18}/> Dashboard</button>
          <button className={page === 'entry' ? 'active' : ''} onClick={() => setPage('entry')}><Save size={18}/> Daily Entry</button>
          <button className={page === 'reports' ? 'active' : ''} onClick={() => { setPage('reports'); setTimeout(loadReport, 100); }}><Download size={18}/> Reports</button>
          <button className={page === 'branches' ? 'active' : ''} onClick={() => setPage('branches')}><Building2 size={18}/> Branches</button>
          <button className={page === 'employees' ? 'active' : ''} onClick={() => setPage('employees')}><Users size={18}/> Employees</button>
          <button className={page === 'audit' ? 'active' : ''} onClick={() => { setPage('audit'); setTimeout(loadAuditLogs, 100); }}><ListChecks size={18}/> Audit Log</button>
          <button className={page === 'settings' ? 'active' : ''} onClick={() => setPage('settings')}><Settings size={18}/> Settings</button>
        </nav>
      </aside>

      <main className="content">
        <header className="topbar">
          <div><h2>{currentTitle()}</h2><p>Royal Thai Touch ERP financial control center</p></div>
          <div className="dateBox">
            <CalendarDays size={18}/><input type="date" value={businessDate} onChange={async e => { setBusinessDate(e.target.value); await loadData(e.target.value); }} />
            <button onClick={() => loadData()}><RefreshCcw size={16}/> Refresh</button>
            <button onClick={exportCurrentExcel}><Download size={16}/> Save Excel</button>
            <button onClick={exportCurrentPdf}><FileText size={16}/> Save PDF</button>
          </div>
        </header>
        {message && <div className="notice">{message}</div>}

        {page === 'dashboard' && (<>
          <section className="cards"><div className="metric"><span>Revenue Today</span><strong>{formatIQD(dashboard?.total_revenue)}</strong></div><div className="metric danger"><span>Expenses Today</span><strong>{formatIQD(dashboard?.total_expenses)}</strong></div><div className="metric gold"><span>Net Profit</span><strong>{formatIQD(dashboard?.net_profit)}</strong></div><div className="metric"><span>Month Profit</span><strong>{formatIQD(dashboard?.month_profit)}</strong></div></section>
          <section className="panel"><h3>30-Day Revenue / Expenses / Profit Trend</h3><TrendChart data={trend}/></section>
          <section className="panel splitPanel"><div><h3>Company Status</h3><p>Best Branch: <strong className="goldText">{dashboard?.best_branch || '-'}</strong></p><p>Missing Branches: <strong>{dashboard?.missing_branches?.length || 0}</strong></p></div><div className="buttonGroup"><button onClick={() => exportExcel(businessDate, businessDate)}><Download size={18}/> Excel Today</button><button onClick={() => exportPdf(businessDate, businessDate)}><FileText size={18}/> PDF Today</button></div></section>
          <section className="panel"><h3>Branch Performance</h3><table><thead><tr><th>Branch</th><th>Revenue</th><th>Expenses</th><th>Net Profit</th><th>Status</th></tr></thead><tbody>{dashboard?.branches?.map(row => <tr key={row.branch_id}><td>{row.branch}</td><td>{formatIQD(row.revenue)}</td><td>{formatIQD(row.expenses)}</td><td>{formatIQD(row.net_profit)}</td><td><span className={'status ' + row.status.toLowerCase()}>{row.status}</span></td></tr>)}</tbody></table></section>
        </>)}

        {page === 'entry' && (<section className="entryLayout"><form className="panel entryPanel" onSubmit={saveEntry}><h3>Save Day</h3><label>Branch</label><select value={entry.branch_id} onChange={async e => { const id = e.target.value; setEntry({...entry, branch_id: id}); await loadEntry(id, entry.business_date); }}>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select><label>Date</label><input type="date" value={entry.business_date} onChange={async e => { const d = e.target.value; setEntry({...entry, business_date: d}); await loadEntry(entry.branch_id, d); }} /><label>Daily Revenue</label><input type="number" value={entry.revenue} onChange={e => setEntry({...entry, revenue: e.target.value})} placeholder="0" /><label>Revenue Notes</label><textarea value={entry.notes} onChange={e => setEntry({...entry, notes: e.target.value})} placeholder="Optional notes" /><div className="expenseHeader"><h4>Expenses</h4><button type="button" onClick={addExpense}><Plus size={16}/> Add Expense</button></div>{entry.expenses.map((expense, index) => <div className="expenseRow" key={index}><input value={expense.category} onChange={e => updateExpense(index, 'category', e.target.value)} placeholder="Other Expenses" /><input type="number" value={expense.amount} onChange={e => updateExpense(index, 'amount', e.target.value)} placeholder="Amount" /><input value={expense.notes} onChange={e => updateExpense(index, 'notes', e.target.value)} placeholder="Notes" /><button type="button" className="iconBtn" onClick={() => removeExpense(index)}><Trash2 size={16}/></button></div>)}<button className="primaryBtn">Save Day</button><button type="button" className="secondaryBtn" onClick={closeDay}>Close Day</button></form><div className="panel summaryPanel"><h3>Daily Summary</h3><div className="summaryLine"><span>Revenue</span><strong>{formatIQD(entry.revenue)}</strong></div><div className="summaryLine"><span>Expenses</span><strong>{formatIQD(expenseTotal)}</strong></div><div className="summaryLine total"><span>Net Profit</span><strong>{formatIQD(entryProfit)}</strong></div></div></section>)}

        {page === 'reports' && (<><section className="panel reportPanel"><h3>Reports</h3><div className="reportControls"><label>From</label><input type="date" value={reportRange.from} onChange={e => setReportRange({...reportRange, from: e.target.value})}/><label>To</label><input type="date" value={reportRange.to} onChange={e => setReportRange({...reportRange, to: e.target.value})}/><button onClick={loadReport}><BarChart3 size={18}/> Show</button><button onClick={() => exportExcel()}><Download size={18}/> Excel</button><button onClick={() => exportPdf()}><FileText size={18}/> PDF</button></div></section>{report && (<><section className="cards"><div className="metric"><span>Total Revenue</span><strong>{formatIQD(report.total_revenue)}</strong></div><div className="metric danger"><span>Total Expenses</span><strong>{formatIQD(report.total_expenses)}</strong></div><div className="metric gold"><span>Net Profit</span><strong>{formatIQD(report.net_profit)}</strong></div></section><section className="panel"><h3>Branch Totals</h3><table><thead><tr><th>Branch</th><th>Revenue</th><th>Expenses</th><th>Net Profit</th></tr></thead><tbody>{report.branch_totals.map(row => <tr key={row.branch}><td>{row.branch}</td><td>{formatIQD(row.revenue)}</td><td>{formatIQD(row.expenses)}</td><td>{formatIQD(row.net_profit)}</td></tr>)}</tbody></table></section><section className="panel"><h3>Daily Breakdown</h3><table><thead><tr><th>Date</th><th>Revenue</th><th>Expenses</th><th>Net Profit</th></tr></thead><tbody>{report.daily_rows.map(row => <tr key={row.date}><td>{row.date}</td><td>{formatIQD(row.revenue)}</td><td>{formatIQD(row.expenses)}</td><td>{formatIQD(row.net_profit)}</td></tr>)}</tbody></table></section></>)}</>)}

        {page === 'branches' && (<><section className="panel"><h3>Add Branch</h3><form className="inlineForm" onSubmit={createBranch}><input value={branchForm.name} onChange={e => setBranchForm({...branchForm, name: e.target.value})} placeholder="Branch name" required/><input value={branchForm.address} onChange={e => setBranchForm({...branchForm, address: e.target.value})} placeholder="Address"/><button><Plus size={16}/> Add Branch</button></form></section><section className="panel"><h3>Branches</h3><table><thead><tr><th>ID</th><th>Branch</th><th>Address</th><th>Status</th></tr></thead><tbody>{branches.map(b => <tr key={b.id}><td>{b.id}</td><td>{b.name}</td><td>{b.address}</td><td>Active</td></tr>)}</tbody></table></section></>)}

        {page === 'employees' && (<><section className="cards"><div className="metric"><span>Employees</span><strong>{employees.length}</strong></div><div className="metric gold"><span>Monthly Salaries</span><strong>{formatIQD(totalSalaries)}</strong></div></section><section className="panel"><h3>Add Employee</h3><form className="employeeForm" onSubmit={addEmployee}><input required value={employeeForm.name} onChange={e=>setEmployeeForm({...employeeForm,name:e.target.value})} placeholder="Employee name"/><select value={employeeForm.branch_id} onChange={e=>setEmployeeForm({...employeeForm,branch_id:e.target.value})}>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select><input value={employeeForm.role} onChange={e=>setEmployeeForm({...employeeForm,role:e.target.value})} placeholder="Job / position"/><input type="number" value={employeeForm.salary} onChange={e=>setEmployeeForm({...employeeForm,salary:e.target.value})} placeholder="Monthly salary"/><input value={employeeForm.phone} onChange={e=>setEmployeeForm({...employeeForm,phone:e.target.value})} placeholder="Phone"/><label>Passport image<input type="file" accept="image/*" onChange={e=>fileToBase64('passportImage', e.target.files[0])}/></label><label>Residence ID image<input type="file" accept="image/*" onChange={e=>fileToBase64('residenceImage', e.target.files[0])}/></label><button><Save size={16}/> Save Employee</button></form></section><section className="panel"><h3>Employees List</h3><table><thead><tr><th>Name</th><th>Branch</th><th>Job</th><th>Salary</th><th>Documents</th><th>Actions</th></tr></thead><tbody>{employees.map(emp=><tr key={emp.id}><td>{emp.name}</td><td>{emp.branch}</td><td>{emp.role || '-'}</td><td>{formatIQD(emp.salary)}</td><td>{emp.passportImage ? 'Passport ' : ''}{emp.residenceImage ? 'Residence ID' : ''}</td><td><div className="buttonGroup"><button onClick={()=>printEmployee(emp)}><Printer size={16}/> Print</button><button className="iconBtn" onClick={()=>deleteEmployee(emp.id)}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></section></>)}

        {page === 'audit' && (<section className="panel"><div className="splitPanel"><h3>Last 100 Operations</h3><button onClick={loadAuditLogs}><RefreshCcw size={16}/> Refresh</button></div><table><thead><tr><th>ID</th><th>Action</th><th>Entity</th><th>Details</th><th>Date</th></tr></thead><tbody>{auditLogs.map(log => <tr key={log.id}><td>{log.id}</td><td>{log.action}</td><td>{log.entity}</td><td>{log.details}</td><td>{log.created_at ? new Date(log.created_at).toLocaleString() : '-'}</td></tr>)}</tbody></table></section>)}
        {page === 'settings' && (<section className="panel"><h3>Settings</h3><p>Company: Royal Thai Touch</p><p>Currency: IQD</p><p>Expense default category: Other Expenses</p><p>Export: Save Excel and Save PDF buttons are available in every section.</p></section>)}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
