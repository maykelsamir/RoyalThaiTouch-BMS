import { useEffect, useMemo, useState } from 'react'
import { api, apiDownload } from '../api/client'
import './ReportsPage.css'

function isoDate(date) { const year=date.getFullYear(); const month=String(date.getMonth()+1).padStart(2,'0'); const day=String(date.getDate()).padStart(2,'0'); return `${year}-${month}-${day}` }
function initialDates(){const now=new Date();return{dateFrom:isoDate(new Date(now.getFullYear(),now.getMonth(),1)),dateTo:isoDate(now)}}
function formatIQD(value){return `${Number(value||0).toLocaleString('en-US')} IQD`}
function formatCount(value){return Number(value||0).toLocaleString('en-US')}
function formatPercent(value){return `${Number(value||0).toLocaleString('en-US',{maximumFractionDigits:2})}%`}

const defaultContent={revenue:true,expenses:true,profit:true,customers:true,revenueSharing:true,branchSummary:true,dailyDetails:true}

export default function ReportsPage({user}){
  const defaults=initialDates()
  const[filters,setFilters]=useState({...defaults,branchIds:[],includeUnapproved:false})
  const[content,setContent]=useState(defaultContent)
  const[branches,setBranches]=useState([])
  const[report,setReport]=useState(null)
  const[loading,setLoading]=useState(false)
  const[exporting,setExporting]=useState('')
  const[error,setError]=useState('')
  const canExcel=user.role.toLowerCase()==='admin'||user.permissions.includes('reports.export_excel')
  const canPdf=user.role.toLowerCase()==='admin'||user.permissions.includes('reports.export_pdf')
  const selectedMetricCount=Number(content.revenue)+Number(content.expenses)+Number(content.profit)+Number(content.customers)+Number(content.revenueSharing)

  function queryString(){const params=new URLSearchParams({date_from:filters.dateFrom,date_to:filters.dateTo,include_unapproved:String(filters.includeUnapproved),show_revenue:String(content.revenue),show_expenses:String(content.expenses),show_profit:String(content.profit),show_customers:String(content.customers),show_revenue_sharing:String(content.revenueSharing),show_branch_summary:String(content.branchSummary),show_daily_details:String(content.dailyDetails)});filters.branchIds.forEach(id=>params.append('branch_ids',id));return params.toString()}
  async function loadReport(){if(!selectedMetricCount)return setError('Select at least one financial value.');setLoading(true);setError('');try{setReport(await api(`/reports?${queryString()}`))}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{async function bootstrap(){try{const data=await api('/reports/branches');setBranches(data);await loadReport()}catch(e){setError(e.message)}}bootstrap()},[])
  const selectedNames=useMemo(()=>filters.branchIds.length?branches.filter(item=>filters.branchIds.includes(String(item.id))).map(item=>item.name).join(', '):'All accessible centers',[filters.branchIds,branches])
  function toggleBranch(id){const value=String(id);setFilters(current=>({...current,branchIds:current.branchIds.includes(value)?current.branchIds.filter(item=>item!==value):[...current.branchIds,value]}))}
  function toggleContent(key){setContent(current=>({...current,[key]:!current[key]}))}
  async function exportFile(type){setExporting(type);setError('');try{await apiDownload(`/reports/export/${type}?${queryString()}`,`financial_report.${type==='excel'?'xlsx':'pdf'}`)}catch(e){setError(e.message)}finally{setExporting('')}}

  return <>
    <div className="pageTitleRow reportsTitleRow"><div><span className="eyebrow">Business Intelligence</span><h2>Advanced Financial Reports</h2><p>Gross revenue, revenue sharing, company income, hotel share, expenses, customers, and company net profit.</p></div><div className="reportExportActions">{canExcel&&<button className="excelButton" disabled={!!exporting||loading} onClick={()=>exportFile('excel')}>{exporting==='excel'?'Preparing…':'Export Excel'}</button>}{canPdf&&<button className="pdfButton" disabled={!!exporting||loading} onClick={()=>exportFile('pdf')}>{exporting==='pdf'?'Preparing…':'Export PDF'}</button>}</div></div>
    {error&&<div className="alert">{error}</div>}
    <section className="reportFilterPanel">
      <label>From<input type="date" value={filters.dateFrom} onChange={e=>setFilters({...filters,dateFrom:e.target.value})}/></label>
      <label>To<input type="date" value={filters.dateTo} onChange={e=>setFilters({...filters,dateTo:e.target.value})}/></label>
      <div className="reportBranchFilter"><span>Centers</span><div className="reportBranchChecks"><label><input type="checkbox" checked={!filters.branchIds.length} onChange={()=>setFilters({...filters,branchIds:[]})}/>All centers</label>{branches.map(branch=><label key={branch.id}><input type="checkbox" checked={filters.branchIds.includes(String(branch.id))} onChange={()=>toggleBranch(branch.id)}/>{branch.name}</label>)}</div><small>{selectedNames}</small></div>
      <label className="reportToggle"><input type="checkbox" checked={filters.includeUnapproved} onChange={e=>setFilters({...filters,includeUnapproved:e.target.checked})}/><span>Include draft, submitted, and rejected entries</span></label>
      <div className="reportContentChooser"><div className="reportChooserHeader"><div><span className="eyebrow">Report Content</span><h3>Choose what to include</h3></div></div><div className="reportContentChecks">
        <label><input type="checkbox" checked={content.revenue} onChange={()=>toggleContent('revenue')}/><span><strong>Gross Revenue</strong></span></label>
        <label><input type="checkbox" checked={content.revenueSharing} onChange={()=>toggleContent('revenueSharing')}/><span><strong>Revenue Sharing</strong><small>Company %, hotel %, and both shares</small></span></label>
        <label><input type="checkbox" checked={content.customers} onChange={()=>toggleContent('customers')}/><span><strong>Number of Customers</strong></span></label>
        <label><input type="checkbox" checked={content.expenses} onChange={()=>toggleContent('expenses')}/><span><strong>Fixed Daily Expenses</strong></span></label>
        <label><input type="checkbox" checked={content.profit} onChange={()=>toggleContent('profit')}/><span><strong>Company Net Profit</strong></span></label>
        <label><input type="checkbox" checked={content.branchSummary} onChange={()=>toggleContent('branchSummary')}/><span><strong>Branch Summary</strong></span></label>
        <label><input type="checkbox" checked={content.dailyDetails} onChange={()=>toggleContent('dailyDetails')}/><span><strong>Daily Details</strong></span></label>
      </div></div>
      <button className="primaryButton reportRunButton" disabled={loading} onClick={loadReport}>{loading?'Generating…':'Generate Report'}</button>
    </section>
    {report&&<>
      <section className="reportMetrics">{content.customers&&<article><span>Total Customers</span><strong>{formatCount(report.company_customer_count)}</strong></article>}{content.revenue&&<article><span>Gross Revenue</span><strong>{formatIQD(report.company_revenue)}</strong></article>}{content.revenueSharing&&<><article><span>Company Share</span><strong>{formatIQD(report.company_share)}</strong></article><article><span>Hotel Share</span><strong>{formatIQD(report.hotel_share)}</strong></article></>}{content.expenses&&<article><span>Fixed Expenses</span><strong>{formatIQD(report.company_expenses)}</strong></article>}{content.profit&&<article className={`profitMetric ${Number(report.company_net_profit)<0?'negativeProfit':''}`}><span>Company Net Profit</span><strong>{formatIQD(report.company_net_profit)}</strong></article>}</section>
      {content.branchSummary&&<section className="reportPanel"><div className="panelHeading"><span className="eyebrow">Center Comparison</span><h3>Branch Summary</h3></div><div className="responsiveTable"><table><thead><tr><th>Center</th>{content.revenue&&<th>Gross Revenue</th>}{content.revenueSharing&&<><th>Company %</th><th>Hotel %</th><th>Company Share</th><th>Hotel Share</th></>}{content.customers&&<th>Customers</th>}{content.expenses&&<th>Expenses</th>}{content.profit&&<th>Company Net Profit</th>}<th>Approved</th><th>Missing</th></tr></thead><tbody>{report.branches.map(item=><tr key={item.branch_id}><td><strong>{item.branch_name}</strong></td>{content.revenue&&<td>{formatIQD(item.revenue)}</td>}{content.revenueSharing&&<><td>{formatPercent(item.company_percentage)}</td><td>{formatPercent(item.hotel_percentage)}</td><td>{formatIQD(item.company_share)}</td><td>{formatIQD(item.hotel_share)}</td></>}{content.customers&&<td>{formatCount(item.customer_count)}</td>}{content.expenses&&<td>{formatIQD(item.expenses)}</td>}{content.profit&&<td className={Number(item.net_profit)<0?'negativeProfitCell':''}>{formatIQD(item.net_profit)}</td>}<td>{item.approved_entries}</td><td>{item.missing_days}</td></tr>)}</tbody></table></div></section>}
      {content.dailyDetails&&<section className="reportPanel"><div className="panelHeading"><span className="eyebrow">Detailed Ledger</span><h3>Daily Financial Breakdown</h3></div><div className="responsiveTable reportDetailsTable"><table><thead><tr><th>Date</th><th>Center</th>{content.revenue&&<th>Gross Revenue</th>}{content.revenueSharing&&<><th>Company %</th><th>Hotel %</th><th>Company Share</th><th>Hotel Share</th></>}{content.customers&&<th>Customers</th>}{content.expenses&&<th>Fixed Daily Expense</th>}{content.profit&&<th>Company Net Profit</th>}<th>Status</th></tr></thead><tbody>{report.daily_rows.map(item=><tr key={`${item.branch_id}-${item.business_date}`}><td>{item.business_date}</td><td>{item.branch_name}</td>{content.revenue&&<td>{formatIQD(item.revenue)}</td>}{content.revenueSharing&&<><td>{formatPercent(item.company_percentage)}</td><td>{formatPercent(item.hotel_percentage)}</td><td>{formatIQD(item.company_share)}</td><td>{formatIQD(item.hotel_share)}</td></>}{content.customers&&<td>{formatCount(item.customer_count)}</td>}{content.expenses&&<td>{formatIQD(item.allocated_expense)}</td>}{content.profit&&<td className={Number(item.net_profit)<0?'negativeProfitCell':''}>{formatIQD(item.net_profit)}</td>}<td><span className={`statusBadge status-${item.entry_status}`}>{item.entry_status}</span></td></tr>)}</tbody></table></div></section>}
    </>}
  </>
}
