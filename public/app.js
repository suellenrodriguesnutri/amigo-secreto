// Funções compartilhadas pelas páginas.
const qs = new URLSearchParams(location.search);

async function api(path, body) {
  let r;
  try {
    r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new Error('Sem conexão. Verifique sua internet e tente de novo.');
  }
  let j = {};
  try { j = await r.json(); } catch {}
  if (!r.ok) throw new Error(j.error || 'Algo deu errado. Tente de novo.');
  return j;
}

// Cria elementos sem usar innerHTML com texto do usuário (evita injeção de código).
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : String(k));
  return e;
}

let toastTimer;
function toast(msg, isError) {
  let t = document.getElementById('toast');
  if (!t) { t = h('div', { id: 'toast', role: 'status' }); document.body.append(t); }
  t.textContent = msg;
  t.className = 'show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = isError ? 'error' : ''), 3200);
}

// Executa uma ação travando o botão enquanto carrega.
async function busy(btn, fn, label = 'Aguarde…') {
  const old = btn.textContent;
  btn.disabled = true; btn.textContent = label;
  try { return await fn(); }
  catch (e) { toast(e.message, true); }
  finally { btn.disabled = false; btn.textContent = old; }
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return d ? `${d}/${m}/${y}` : iso;
}
function fmtTime(ts) {
  const d = new Date(ts);
  const today = new Date().toDateString() === d.toDateString();
  return (today ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ') +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
const initial = (name) => (name || '?').trim().charAt(0).toUpperCase();

function headerChips(g) {
  const box = document.getElementById('chips');
  box.replaceChildren();
  if (g.date) box.append(h('span', { class: 'chip' }, '📅 ' + fmtDate(g.date)));
  if (g.budget) box.append(h('span', { class: 'chip' }, '💰 ' + g.budget));
}
