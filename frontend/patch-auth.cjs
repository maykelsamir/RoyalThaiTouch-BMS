const fs = require('fs');
const path = 'src/main.jsx';
let s = fs.readFileSync(path, 'utf8');
const old = "function AuthScreen({users,onLogin,onCreateFirstAdmin}){const[setup]=useState(users.length===0),[username,setUsername]=useState(''),[secret,setSecret]=useState(''),[error,setError]=useState('');function submit(e){e.preventDefault();setError('');if(setup)return onCreateFirstAdmin(username,secret);const u=users.find(x=>x.username===username&&x.secret===secret&&x.active!==false);if(!u)return setError('Invalid login');onLogin(u)}";
const neu = "function AuthScreen({users,onLogin,onCreateFirstAdmin}){const setup=users.length===0;const[username,setUsername]=useState(''),[secret,setSecret]=useState(''),[error,setError]=useState('');function submit(e){e.preventDefault();setError('');if(setup)return onCreateFirstAdmin(username,secret).catch(err=>setError(err.message||'Could not create admin'));const u=users.find(x=>x.username===username&&x.secret===secret&&x.active!==false);if(!u)return setError('Invalid login');onLogin(u)}";
if (!s.includes(old)) {
  console.error('AuthScreen pattern not found');
  process.exit(1);
}
fs.writeFileSync(path, s.replace(old, neu));
