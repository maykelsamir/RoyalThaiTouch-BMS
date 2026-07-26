import { useEffect, useMemo, useState } from 'react'
import { api, apiDownload } from '../api/client'
import './ReportsPage.css'

function isoDate(date) { return date.toISOString().slice(0, 10) }
function initialDates() { const now = new Date(); return { dateFrom: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), dateTo: isoDate(now) } }
function formatIQD(value) { return `${Number(value || 0).toLocaleString('en-US')} IQD` }
function formatCount(value) { return Number(value || 0).toLocaleString('en-US') }

const defaultContent = { revenue: true, expenses: true, profit: true, branchSummary: true, dailyDetails: true }

export default function ReportsPage({ user }) {
  const defaults = initialDates()
  const [filters, setFilters] = useState({ ...defaults, branchIds: [], includeUnapproved: false })
  const [content, setContent] = useState(defaultContent)
  const [branches, setBranches] = useState([])
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState('')
  const [error, setError] = useState('')

  const canExcel = user.role.toLowerCase() === 'admin' || user.permissions.includes('reports.export_excel')
  const canPdf = user.role.toLowerCase() === 'admin' || user.permissions.includes('reports.export_pdf')
  const selectedMetricCount = Number(content.revenue) + Number(content.expenses) + Number(content.profit)

  function queryString() {
    const params = new URLSearchParams({ date_from: filters.dateFrom, date_to: filters.dateTo, include_unapproved: String(filters.includeUnapproved), show_revenue: String(content.revenue), show_expenses: String(content.expenses), show_profit: String(content.profit), show_branch_summary: String(content.branchSummary), show_daily_details: String(content.dailyDetails) })
    filters.branchIds.forEach((id) => params.append('branch_ids', id))
    return params.toString()
  }

  async function loadReport() {
    if (!selectedMetricCount) return setError('Select at least one financial value: Total Revenue, Expenses, or Net Profit.')
    setLoading(true); setError('')
    try { setReport(await api(`/reports?${queryString()}`)) } catch (requestError) { setError(requestError.message) } finally { setLoading(false) }
  }

  useEffect(() => { async function bootstrap() { try { const data = await api('/reports/branches'); setBranches(data); await loadReport() } catch (requestError) { setError(requestError.message) } } bootstrap() }, [])

  const selectedNames = useMemo(() => filters.branchIds.length ? branches.filter((item) => filters.branchIds.includes(String(item.id))).map((item) => item.name).join(', ') : 'All accessible centers', [filters.branchIds, branches])
  function toggleBranch(id) { const value = String(id); setFilters((current) => ({ ...current, branchIds: current.branchIds.includes(value) ? current.branchIds.filter((item) => item !== value) : [...current.branchIds, value] })) }
  function toggleContent(key) { setContent((current) => ({ ...current, [key]: !current[key] })) }
  async function exportFile(type) { setExporting(type); setError(''); try { await apiDownload(`/reports/export/${type}?${queryString()}`, `financial_report.${type === 'excel' ? 'xlsx' : 'pdf'}`) } catch (requestError) { setError(requestError.message) } finally { setExporting('') } }

  return <>
    <div className="pageTitleRow reportsTitleRow"><div><span className="eyebrow">Business Intelligence</span><h2>Advanced Financial Reports</h2><p>Revenue, customer traffic, average revenue per customer, expenses, and profit in one report.</p></div><div className="reportExportActions">{canExcel && <button className="excelButton" disabled={!!exporting || loading} onClick={() => exportFile('excel')}>{exporting === 'excel' ? 'Preparing…' : 'Export Excel'}</button>}{canPdf && <button className="pdfButton" disabled={!!exporting || loading} onClick={() => exportFile('pdf')}>{exporting === 'pdf' ? 'Preparing…' : 'Export PDF'}</button>}</div></div>
    {error && <div className="alert">{error}</div>}
    <section className="reportFilterPanel">
      <label>From<input type="date" value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} /></label>
      <label>To<input type="date" value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} /></label>
      <div className="reportBranchFilter"><span>Centers</span><div className="reportBranchChecks"><label><input type="checkbox" checked={!filters.branchIds.length} onChange={() => setFilters({ ...filters, branchIds: [] })} />All centers</label>{branches.map((branch) => <label key={branch.id}><input type="checkbox" checked={filters.branchIds.includes(String(branch.id))} onChange={() => toggleBranch(branch.id)} />{branch.name}</label>)}</div><small>{selectedNames}</small></div>
      <label className="reportToggle"><input type="checkbox" checked={filters.includeUnapproved} onChange={(event) => setFilters({ ...filters, includeUnapproved: event.target.checked })} /><span>Include draft, submitted, and rejected entries</span></label>
      <div className="reportContentChooser"><div className="reportChooserHeader"><div><span className="eyebrow">Report Content</span><h3>Choose what to include</h3></div></div><div className="reportContentChecks"><label><input type="checkbox" checked={content.revenue} onChange={() => toggleContent('revenue')} /><span><strong>Total Revenue</strong></span></label><label><input type="checkbox" checked={content.expenses} onChange={() => toggleContent('expenses')} /><span><strong>Allocated Expenses</strong></span></label><label><input type="checkbox" checked={content.profit} onChange={() => toggleContent('profit')} /><span><strong>Net Profit</strong></span></label><label><input type="checkbox" checked={content.branchSummary} onChange={() => toggleContent('branchSummary')} /><span><strong>Branch Summary</strong></span></label><label><input type="checkbox" checked={content.dailyDetails} onChange={() => toggleContent('dailyDetails')} /><span><strong>Daily Details</strong></span></label></div></div>
      <button className="primaryButton reportRunButton" disabled={loading} onClick={loadReport}>{loading ? 'Generating…' : 'Generate Report'}</button>
    </section>
    {report && <>
      <section className="reportMetrics"><article><span>Total Customers</span><strong>{formatCount(report.company_customer_count)}</strong></article><article><span>Revenue / Customer</span><strong>{formatIQD(report.company_revenue_per_customer)}</strong></article>{content.revenue && <article><span>Total Revenue</span><strong>{formatIQD(report.company_revenue)}</strong></article>}{content.expenses && <article><span>Allocated Expenses</span><strong>{formatIQD(report.company_expenses)}</strong></article>}{content.profit && <article className="profitMetric"><span>Net Profit</span><strong>{formatIQD(report.company_net_profit)}</strong></article>}</section>
      {content.branchSummary && <section className="reportPanel"><div className="panelHeading"><span className="eyebrow">Center Comparison</span><h3>Branch Summary</h3></div><div className="responsiveTable"><table><thead><tr><th>Center</th>{content.revenue && <th>Revenue</th>}<th>Customers</th><th>Revenue / Customer</th>{content.expenses && <th>Expenses</th>}{content.profit && <th>Net Profit</th>}<th>Approved Days</th><th>Missing Days</th></tr></thead><tbody>{report.branches.map((item) => <tr key={item.branch_id}><td><strong>{item.branch_name}</strong></td>{content.revenue && <td>{formatIQD(item.revenue)}</td>}<td>{formatCount(item.customer_count)}</td><td>{formatIQD(item.revenue_per_customer)}</td>{content.expenses && <td>{formatIQD(item.expenses)}</td>}{content.profit && <td>{formatIQD(item.net_profit)}</td>}<td>{item.approved_entries}</td><td>{item.missing_days}</td></tr>)}</tbody></table></div></section>}
      {content.dailyDetails && <section className="reportPanel"><div className="panelHeading"><span className="eyebrow">Detailed Ledger</span><h3>Daily Financial Breakdown</h3></div><div className="responsiveTable reportDetailsTable"><table><thead><tr><th>Date</th><th>Center</th>{content.revenue && <th>Revenue</th>}<th>Customers</th><th>Revenue / Customer</th>{content.expenses && <th>Allocated Expense</th>}{content.profit && <th>Net Profit</th>}<th>Status</th></tr></thead><tbody>{report.daily_rows.map((item) => <tr key={`${item.branch_id}-${item.business_date}`}><td>{item.business_date}</td><td>{item.branch_name}</td>{content.revenue && <td>{formatIQD(item.revenue)}</td>}<td>{formatCount(item.customer_count)}</td><td>{formatIQD(item.revenue_per_customer)}</td>{content.expenses && <td>{formatIQD(item.allocated_expense)}</td>}{content.profit && <td>{formatIQD(item.net_profit)}</td>}<td><span className={`statusBadge status-${item.entry_status}`}>{item.entry_status}</span></td></tr>)}</tbody></table></div></section>}
    </>}
  </>
}
