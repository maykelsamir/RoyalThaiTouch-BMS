const fs = require('fs');
const path = 'src/style.css';
let s = fs.readFileSync(path, 'utf8');
const mobile = `

/* Strong mobile layout fix */
@media (max-width: 768px) {
  html, body, #root { width: 100% !important; max-width: 100% !important; overflow-x: hidden !important; }
  body { font-size: 15px; }
  .appShell { display: block !important; width: 100% !important; min-width: 0 !important; overflow-x: hidden !important; }
  .sidebar { width: 100% !important; max-width: 100% !important; position: relative !important; border-right: 0 !important; border-bottom: 1px solid rgba(212,175,55,.22); padding: 12px !important; }
  .sidebar .brand { margin-bottom: 10px !important; }
  .sidebar .brandLogo { width: 56px !important; height: 42px !important; }
  .brand h1 { font-size: 16px !important; }
  nav { display: flex !important; overflow-x: auto !important; gap: 8px !important; padding-bottom: 8px !important; }
  nav button { flex: 0 0 auto !important; width: auto !important; min-height: 40px !important; padding: 9px 11px !important; font-size: 13px !important; white-space: nowrap !important; }
  .content { width: 100% !important; max-width: 100% !important; min-width: 0 !important; padding: 12px !important; overflow-x: hidden !important; }
  .topbar { display: block !important; margin-bottom: 12px !important; }
  .topbar h2 { font-size: 22px !important; line-height: 1.25 !important; white-space: normal !important; word-break: break-word !important; }
  .topbar p { font-size: 13px !important; }
  .dateBox { width: 100% !important; display: grid !important; grid-template-columns: 1fr !important; margin-top: 10px !important; }
  .cards { grid-template-columns: 1fr !important; gap: 10px !important; }
  .metric, .panel { width: 100% !important; max-width: 100% !important; padding: 14px !important; border-radius: 16px !important; margin-bottom: 12px !important; overflow: hidden !important; }
  .panel h3 { font-size: 18px !important; line-height: 1.25 !important; white-space: normal !important; }
  .entryLayout { display: block !important; width: 100% !important; max-width: 100% !important; }
  .entryPanel, .summaryPanel { width: 100% !important; max-width: 100% !important; min-width: 0 !important; }
  .inlineForm, .employeeForm, .reportControls, .expenseRow { display: grid !important; grid-template-columns: 1fr !important; gap: 10px !important; }
  .splitPanel { display: block !important; }
  input, select, textarea, button { width: 100% !important; max-width: 100% !important; min-width: 0 !important; font-size: 16px !important; }
  button { min-height: 44px !important; }
  .buttonGroup { display: grid !important; grid-template-columns: 1fr !important; gap: 8px !important; width: 100% !important; }
  .notice { width: 100% !important; max-width: 100% !important; font-size: 14px !important; line-height: 1.4 !important; white-space: normal !important; overflow-wrap: anywhere !important; }
  table { display: block !important; width: 100% !important; max-width: 100% !important; overflow-x: auto !important; white-space: nowrap !important; }
  th, td { padding: 10px 8px !important; font-size: 13px !important; }
  .rechartBox { width: 100% !important; overflow: hidden !important; }
  .appShell > form.panel { width: calc(100vw - 24px) !important; max-width: calc(100vw - 24px) !important; margin: 12px auto !important; padding: 14px !important; }
  .appShell > form.panel .brandLogo { width: 100% !important; height: 150px !important; }
  .appShell > form.panel .brandLogo::after { font-size: 22px !important; letter-spacing: 2px !important; bottom: 26px !important; }
  img { max-width: 100% !important; height: auto !important; }
}
`;
if (!s.includes('/* Strong mobile layout fix */')) s += mobile;
fs.writeFileSync(path, s);
