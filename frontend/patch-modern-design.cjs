const fs = require('fs');
const path = 'src/style.css';
let css = fs.readFileSync(path, 'utf8');
const patch = `

/* Modern commercial UI refresh */
:root {
  --bg-0: #042B34;
  --bg-1: #063945;
  --bg-2: #0A4550;
  --line: rgba(255,255,255,.10);
  --gold: #d4af37;
  --gold-soft: rgba(212,175,55,.14);
  --text: #f7f7f8;
  --muted: #b7c8cc;
  --danger: #ff7a7a;
  --success: #6ee7a8;
  --radius: 20px;
  --shadow: 0 16px 45px rgba(0,0,0,.28);
}
html, body, #root { background: #042B34 !important; }
body {
  background:
    radial-gradient(circle at top right, rgba(212,175,55,.08), transparent 28%),
    linear-gradient(180deg, #042B34, #063945 55%, #042B34) !important;
  color: var(--text);
}
.appShell { min-height: 100vh; background:#042B34; }
.sidebar {
  background: linear-gradient(180deg, rgba(6,57,69,.99), rgba(4,43,52,.99));
  border-right: 1px solid rgba(212,175,55,.16);
  box-shadow: 14px 0 40px rgba(0,0,0,.22);
}
.brand {
  padding: 8px 6px 20px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 18px;
}
.brandLogo {
  box-shadow: inset 0 0 0 1px rgba(212,175,55,.35), 0 10px 25px rgba(0,0,0,.3);
}
.content { padding: 28px 30px 50px; background:#042B34; }
.topbar {
  background: rgba(6,57,69,.88);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 18px 20px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(14px);
}
.topbar h2 { font-size: clamp(24px, 2.2vw, 34px); letter-spacing: -.5px; }
.topbar p { color: var(--muted); }
.panel,
.metric {
  background: linear-gradient(180deg, rgba(10,69,80,.94), rgba(6,57,69,.96));
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}
.panel { padding: 22px; }
.panel h3 { font-size: 18px; letter-spacing: -.2px; margin-bottom: 16px; }
.cards { gap: 16px; }
.metric {
  position: relative;
  overflow: hidden;
  min-height: 128px;
  padding: 20px;
  transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease;
}
.metric::after {
  content: '';
  position: absolute;
  width: 92px;
  height: 92px;
  border-radius: 50%;
  right: -30px;
  top: -30px;
  background: rgba(212,175,55,.08);
}
.metric:hover { transform: translateY(-2px); border-color: rgba(212,175,55,.28); }
.metric > span { color: var(--muted); font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .7px; }
.metric > strong { display: block; margin-top: 13px; font-size: clamp(23px, 2vw, 32px); line-height: 1.1; }
.metric.gold { background: linear-gradient(145deg, rgba(212,175,55,.18), rgba(10,69,80,.96)); border-color: rgba(212,175,55,.38); }
.metric.danger { background: linear-gradient(145deg, rgba(255,107,107,.13), rgba(10,69,80,.96)); }
button {
  border-radius: 13px;
  font-weight: 750;
  transition: transform .15s ease, filter .15s ease, border-color .15s ease;
}
button:hover { transform: translateY(-1px); filter: brightness(1.07); }
button:active { transform: translateY(0); }
.primaryBtn,
button:not(.secondaryBtn):not(.iconBtn) {
  box-shadow: 0 8px 20px rgba(212,175,55,.10);
}
input, select, textarea {
  background: rgba(4,43,52,.78);
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 13px;
  min-height: 44px;
  padding: 11px 13px;
  transition: border-color .15s ease, box-shadow .15s ease;
}
input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: rgba(212,175,55,.62);
  box-shadow: 0 0 0 3px rgba(212,175,55,.10);
}
table {
  border-collapse: separate;
  border-spacing: 0;
  border: 1px solid var(--line);
  border-radius: 16px;
  overflow: hidden;
  background: rgba(6,57,69,.72);
}
th {
  background: rgba(10,69,80,.90);
  color: #e3ecee;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: .55px;
}
th, td { padding: 13px 14px; border-bottom: 1px solid var(--line); }
tbody tr { transition: background .15s ease; }
tbody tr:hover { background: rgba(212,175,55,.05); }
tbody tr:last-child td { border-bottom: 0; }
.notice {
  border-radius: 14px;
  border: 1px solid rgba(212,175,55,.22);
  background: rgba(212,175,55,.08);
  box-shadow: 0 8px 25px rgba(0,0,0,.16);
}
.summaryLine { padding: 12px 0; }
.summaryLine.total { color: var(--gold); font-size: 17px; }
.navGroup { gap: 7px; }
.navSectionLabel { color: #91a7ac; }
.groupedNav button {
  min-height: 43px;
  border: 1px solid transparent;
  border-radius: 12px;
}
.groupedNav button.active {
  background: linear-gradient(90deg, rgba(212,175,55,.18), rgba(212,175,55,.07));
  border-color: rgba(212,175,55,.26);
  color: #f5d873;
}
.reportControls { gap: 12px; }
.rechartBox { border-radius: 16px; overflow: hidden; }
@media (max-width: 768px) {
  .content { padding: 12px 12px 30px !important; }
  .topbar { padding: 14px !important; border-radius: 16px !important; }
  .panel, .metric { border-radius: 16px !important; box-shadow: 0 10px 28px rgba(0,0,0,.22) !important; }
  .panel { padding: 15px !important; }
  .metric { min-height: 110px !important; padding: 16px !important; }
  .metric > strong { font-size: 24px !important; }
  .cards { gap: 10px !important; }
  th, td { padding: 10px 9px !important; }
}
`;
if (!css.includes('/* Modern commercial UI refresh */')) css += patch;
fs.writeFileSync(path, css);
