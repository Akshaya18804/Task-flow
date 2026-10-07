/* TaskFlow – front-end logic. Data is stored in the browser (localStorage)
   so the site works without a server. Later this will be replaced by REST API calls. */
const $ = id => document.getElementById(id);
const get = (k, d) => JSON.parse(localStorage.getItem(k) || JSON.stringify(d));
const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const today = () => new Date().toISOString().slice(0, 10);
const esc = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let me = null; // logged-in user

/* ---------- Helpers ---------- */
function toast(msg){const t=$('toast');t.textContent=msg;t.hidden=false;setTimeout(()=>t.hidden=true,2200)}
function setErr(id,msg){$(id).textContent=msg;return !msg}
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const users = () => get('tf_users', []);
const allTasks = () => get('tf_tasks', []);
const myTasks = () => allTasks().filter(t => t.uid === me.id);
function status(t){return t.done ? 'completed' : (t.due && t.due < today() ? 'overdue' : 'pending')}

/* ---------- Routing (hash based) ---------- */
function route(){
  const r = (location.hash.replace('#/','') || '').split('?')[0];
  const session = localStorage.getItem('tf_session') || sessionStorage.getItem('tf_session');
  me = session ? users().find(u => u.id === session) : null;
  const appPages = ['dashboard','tasks','profile'];
  document.querySelectorAll('.view').forEach(v => v.classList.remove('on'));
  if (appPages.includes(r)) {
    if (!me) return location.hash = '#/login';
    $('v-app').classList.add('on');
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('on', p.id === 'p-' + r));
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === r));
    closeSide(); renderAll();
  } else if (r === 'login' || r === 'register') {
    if (me) return location.hash = '#/dashboard';
    $('v-' + r).classList.add('on');
  } else { $('v-landing').classList.add('on'); }
  window.scrollTo(0,0);
}
window.addEventListener('hashchange', route);

/* ---------- Auth ---------- */
document.querySelectorAll('[data-eye]').forEach(b => b.onclick = () => {
  const i = $(b.dataset.eye); i.type = i.type === 'password' ? 'text' : 'password';
});
$('forgot').onclick = e => { e.preventDefault(); toast('Password reset will be added in a later version.'); };

$('rPass').oninput = () => {
  const p = $('rPass').value; let s = 0;
  if (p.length >= 8) s++; if (/[A-Z]/.test(p)) s++; if (/\d/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p)) s++;
  const lv = [['–','0','#e5e7f0'],['Weak','25%','#dc2626'],['Fair','50%','#f59e0b'],['Good','75%','#4f46e5'],['Strong','100%','#16a34a']][p ? s || 1 : 0];
  $('meterBar').style.width = lv[1]; $('meterBar').style.background = lv[2]; $('meterTxt').textContent = 'Strength: ' + lv[0];
};

$('regForm').onsubmit = e => {
  e.preventDefault();
  const name = $('rName').value.trim(), email = $('rEmail').value.trim().toLowerCase(), p = $('rPass').value, p2 = $('rPass2').value;
  let ok = true;
  ok = setErr('rNameE', name.length < 2 ? 'Please enter your full name.' : '') && ok;
  ok = setErr('rEmailE', validEmail(email) ? '' : 'Please enter a valid email address.') && ok;
  ok = setErr('rPassE', p.length >= 8 && /\d/.test(p) && /[A-Za-z]/.test(p) ? '' : 'Use 8+ characters with letters and numbers.') && ok;
  ok = setErr('rPass2E', p === p2 && p2 ? '' : 'Passwords do not match.') && ok;
  if (!ok) return;
  const list = users();
  if (list.some(u => u.email === email)) { $('regAlert').textContent = 'An account with this email already exists.'; $('regAlert').hidden = false; return; }
  list.push({ id: 'u' + Date.now(), name, email, pass: btoa(p) }); // demo only – real app: hash on server
  set('tf_users', list); $('regForm').reset(); $('regAlert').hidden = true;
  toast('Account created! Please log in.'); location.hash = '#/login';
};

$('loginForm').onsubmit = e => {
  e.preventDefault();
  const email = $('lEmail').value.trim().toLowerCase(), p = $('lPass').value;
  let ok = setErr('lEmailE', validEmail(email) ? '' : 'Please enter a valid email address.');
  ok = setErr('lPassE', p ? '' : 'Password is required.') && ok;
  if (!ok) return;
  const u = users().find(u => u.email === email && u.pass === btoa(p));
  if (!u) { $('loginAlert').textContent = 'Incorrect email or password.'; $('loginAlert').hidden = false; return; }
  (($('remember').checked ? localStorage : sessionStorage)).setItem('tf_session', u.id);
  $('loginAlert').hidden = true; $('loginForm').reset(); location.hash = '#/dashboard';
};

$('logoutBtn').onclick = () => { localStorage.removeItem('tf_session'); sessionStorage.removeItem('tf_session'); location.hash = '#/'; };

/* ---------- Rendering ---------- */
function taskHTML(t){
  const s = status(t);
  return `<div class="task ${t.done ? 'done' : ''}">
    <input type="checkbox" data-toggle="${t.id}" ${t.done ? 'checked' : ''} aria-label="Mark complete">
    <div><h3>${esc(t.title)}</h3><div class="meta">
      <span class="badge">${t.cat}</span><span class="badge ${t.pri}">${t.pri}</span>
      <span class="badge st-${s}">${s}</span><span>📅 ${t.due || 'No date'}</span></div></div>
    <div class="acts"><button class="icon-btn" data-edit="${t.id}" aria-label="Edit">✏️</button><button class="icon-btn del" data-del="${t.id}" aria-label="Delete">🗑️</button></div></div>`;
}
const list = (arr, msg) => arr.length ? arr.map(taskHTML).join('') : `<div class="empty">${msg}</div>`;

function renderAll(){
  const t = myTasks(), h = new Date().getHours();
  const first = me.name.split(' ')[0];
  $('greet').textContent = `Good ${h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening'}, ${first}!`;
  $('topName').textContent = me.name; $('avatar').textContent = me.name[0].toUpperCase();
  const c = { done: t.filter(x => x.done).length, over: t.filter(x => status(x) === 'overdue').length };
  const pend = t.length - c.done, rate = t.length ? Math.round(c.done / t.length * 100) : 0;
  const cards = [
    ['📋','Total Tasks',t.length,'All tasks you created',''],
    ['✅','Completed',c.done,'Tasks finished',`<span class="trend up">▲ ${rate}% completion</span>`],
    ['⏳','Pending',pend,'Still to do',''],
    ['⚠️','Overdue',c.over,'Past their due date',c.over ? '<span class="trend down">▼ Needs attention</span>' : '<span class="trend up">▲ All clear</span>']];
  $('stats').innerHTML = cards.map(x => `<div class="card stat"><span class="ic">${x[0]}</span><div><b>${x[2]}</b><small>${x[1]} · ${x[3]}</small>${x[4]}</div></div>`).join('');
  const q = $('gSearch').value.toLowerCase();
  const todays = t.filter(x => (x.due === today() || status(x) === 'overdue' || !x.done) && (x.title + x.cat).toLowerCase().includes(q))
                  .sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).slice(0, 8);
  $('todayList').innerHTML = list(todays, 'No tasks yet. Click “Add Task” to get started!');
  const s = $('tSearch').value.toLowerCase(), fs = $('fStatus').value, fp = $('fPri').value;
  const f = t.filter(x => (x.title + x.cat).toLowerCase().includes(s) && (fs === 'all' || status(x) === fs) && (fp === 'all' || x.pri === fp));
  $('allList').innerHTML = list(f, 'No tasks match your search.');
  $('pName').value = me.name; $('pEmail').value = me.email;
}
['tSearch','fStatus','fPri'].forEach(i => $(i).oninput = renderAll);
$('gSearch').oninput = () => { if (!$('p-tasks').classList.contains('on')) renderAll(); else { $('tSearch').value = $('gSearch').value; renderAll(); } };

/* ---------- Task CRUD ---------- */
function openModal(t){
  $('mTitle').textContent = t ? 'Edit Task' : 'Add Task';
  $('tId').value = t ? t.id : ''; $('tTitle').value = t ? t.title : '';
  $('tCat').value = t ? t.cat : 'Assignment'; $('tPri').value = t ? t.pri : 'Medium'; $('tDue').value = t ? t.due : today();
  $('tTitleE').textContent = $('tDueE').textContent = ''; $('modal').hidden = false; $('tTitle').focus();
}
const closeModal = () => $('modal').hidden = true;
document.querySelectorAll('[data-add]').forEach(b => b.onclick = () => openModal());
$('mCancel').onclick = closeModal;
$('modal').onclick = e => { if (e.target === $('modal')) closeModal(); };
document.onkeydown = e => { if (e.key === 'Escape') closeModal(); };

$('taskForm').onsubmit = e => {
  e.preventDefault();
  const title = $('tTitle').value.trim();
  let ok = setErr('tTitleE', title ? '' : 'Task title is required.');
  ok = setErr('tDueE', $('tDue').value ? '' : 'Please choose a due date.') && ok;
  if (!ok) return;
  const all = allTasks(), id = $('tId').value;
  const data = { title, cat: $('tCat').value, pri: $('tPri').value, due: $('tDue').value };
  if (id) Object.assign(all.find(t => t.id === id), data);
  else all.push({ id: 't' + Date.now(), uid: me.id, done: false, ...data });
  set('tf_tasks', all); closeModal(); renderAll(); toast(id ? 'Task updated' : 'Task added');
};

document.querySelector('.content').addEventListener('click', e => {
  const b = e.target.closest('[data-edit],[data-del]'); if (!b) return;
  const all = allTasks();
  if (b.dataset.edit) openModal(all.find(t => t.id === b.dataset.edit));
  else if (confirm('Delete this task?')) { set('tf_tasks', all.filter(t => t.id !== b.dataset.del)); renderAll(); toast('Task deleted'); }
});
document.querySelector('.content').addEventListener('change', e => {
  const id = e.target.dataset.toggle; if (!id) return;
  const all = allTasks(); const t = all.find(x => x.id === id); t.done = e.target.checked;
  set('tf_tasks', all); renderAll(); toast(t.done ? 'Marked as completed 🎉' : 'Marked as pending');
});

/* ---------- Profile ---------- */
$('profForm').onsubmit = e => {
  e.preventDefault();
  const name = $('pName').value.trim(), p = $('pPass').value, all = users(), u = all.find(x => x.id === me.id);
  if (name.length < 2) return toast('Name is too short');
  if (p && p.length < 8) return toast('New password must be 8+ characters');
  u.name = name; if (p) u.pass = btoa(p);
  set('tf_users', all); $('pPass').value = ''; me = u;
  $('profAlert').textContent = 'Profile updated successfully.'; $('profAlert').hidden = false; renderAll();
};

/* ---------- Mobile sidebar ---------- */
function closeSide(){ $('side').classList.remove('open'); $('scrim').classList.remove('show'); }
$('burger').onclick = () => { $('side').classList.add('open'); $('scrim').classList.add('show'); };
$('scrim').onclick = closeSide;

route();
