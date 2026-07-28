const fs = require('fs');
const indexPath = 'index.html';
let html = fs.readFileSync(indexPath, 'utf8');
if (!html.includes('manifest.webmanifest')) {
  html = '<meta name="theme-color" content="#d4af37">\n<link rel="manifest" href="/manifest.webmanifest">\n<link rel="apple-touch-icon" href="/icons/icon-192.svg">\n' + html;
}
fs.writeFileSync(indexPath, html);

const mainPath = 'src/main.jsx';
let js = fs.readFileSync(mainPath, 'utf8');
if (!js.includes('navigator.serviceWorker.register')) {
  js += "\nif ('serviceWorker' in navigator) { window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {})); }\n";
}
fs.writeFileSync(mainPath, js);
