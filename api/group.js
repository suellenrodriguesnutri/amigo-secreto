// API do organizador. Nunca devolve quem tirou quem.
const db = require('../lib/db');
const mail = require('../lib/mail');
const u = require('../lib/util');
const K = db.keys;

const personUrl = (base, g, p) => `${base}/p.html?g=${g.id}&t=${p.token}`;
const adminUrl = (base, g) => `${base}/admin.html?g=${g.id}&k=${g.adminKey}`;

function parseParticipants(list, existing = []) {
  if (!Array.isArray(list)) u.fail(400, 'Lista de participantes inválida.');
  const out = [];
  const names = new Set();
  for (const raw of list) {
    const name = u.str(raw && raw.name, 60);
    const email = u.str(raw && raw.email, 120).toLowerCase();
    if (!name && !email) continue;
    if (!name) u.fail(400, `Falta o nome de quem tem o e-mail ${email}.`);
    if (!u.isEmail(email)) u.fail(400, `O e-mail de ${name} não parece válido.`);
    const nk = name.toLowerCase();
    if (names.has(nk)) u.fail(400, `O nome "${name}" está repetido. Diferencie (ex.: "Ana S." e "Ana P.").`);
    names.add(nk);
    const prev = raw.id && existing.find((p) => p.id === raw.id);
    out.push(prev ? { ...prev, name, email } : { id: u.id(6), token: u.id(18), name, email });
  }
  if (out.length < 3) u.fail(400, 'O amigo secreto precisa de pelo menos 3 pessoas.');
  if (out.length > 80) u.fail(400, 'Máximo de 80 participantes por grupo.');
  return out;
}

async function summary(g) {
  const wishes = await Promise.all(g.participants.map((p) => db.get(K.wishes(g.id, p.id))));
  return {
    id: g.id,
    name: g.name, date: g.date, budget: g.budget, notes: g.notes,
    drawn: g.drawn, drawnAt: g.drawnAt || null,
    participants: g.participants.map((p, i) => ({
      id: p.id, name: p.name, email: p.email,
      hasWishes: !!(wishes[i] && wishes[i].some((w) => w.text)),
      lastEmail: p.lastEmail || null,
    })),
  };
}

// Envia e-mails para as pessoas indicadas e registra o resultado de cada um.
async function sendTo(g, people, base) {
  const failed = [];
  let reason = '';
  await Promise.all(people.map(async (p) => {
    const url = personUrl(base, g, p);
    const msg = g.drawn
      ? mail.templates.draw(g, p, g.participants.find((x) => x.id === g.pairs[p.id]), url)
      : mail.templates.invite(g, p, url);
    try {
      await mail.send(p.email, msg);
      p.lastEmail = { type: g.drawn ? 'sorteio' : 'convite', at: Date.now(), ok: true };
    } catch (e) {
      console.error('Falha ao enviar para', p.email, e.message);
      reason = reason || e.message;
      p.lastEmail = { type: g.drawn ? 'sorteio' : 'convite', at: Date.now(), ok: false };
      failed.push(p.name);
    }
  }));
  await db.set(K.group(g.id), g);
  failed.reason = reason;
  return failed;
}

module.exports = u.handler(async (b, req) => {
  const base = u.baseUrl(req);

  if (b.action === 'login') {
    if (!process.env.ADMIN_PASSWORD) u.fail(500, 'Falta configurar a variável ADMIN_PASSWORD no Vercel.');
    if (b.password !== process.env.ADMIN_PASSWORD) u.fail(401, 'Senha incorreta.');
    return { ok: true };
  }

  if (b.action === 'create') {
    if (!process.env.ADMIN_PASSWORD) u.fail(500, 'Falta configurar a variável ADMIN_PASSWORD no Vercel.');
    if (b.password !== process.env.ADMIN_PASSWORD) u.fail(401, 'Senha de organizador incorreta.');
    const organizerEmail = u.str(b.organizerEmail, 120).toLowerCase();
    const g = {
      id: u.id(8), adminKey: u.id(18),
      name: u.str(b.name, 80) || 'Amigo Secreto',
      date: u.str(b.date, 20), budget: u.str(b.budget, 40), notes: u.str(b.notes, 300),
      participants: parseParticipants(b.participants),
      drawn: false, pairs: null, createdAt: Date.now(),
    };
    await db.set(K.group(g.id), g);
    const url = adminUrl(base, g);
    if (u.isEmail(organizerEmail)) {
      await mail.send(organizerEmail, mail.templates.admin(g, url)).catch((e) => console.error(e.message));
    }
    return { id: g.id, key: g.adminKey, adminUrl: url };
  }

  const g = await db.get(K.group(u.str(b.id, 40)));
  if (!g || g.adminKey !== b.key) u.fail(404, 'Grupo não encontrado ou link de organizador inválido.');
  const findP = () => g.participants.find((p) => p.id === b.pid) || u.fail(404, 'Participante não encontrado.');

  switch (b.action) {
    case 'get':
      return summary(g);

    case 'update': {
      if (g.drawn) u.fail(409, 'O sorteio já foi feito. Para mudar participantes, refaça o sorteio depois de editar.');
      g.name = u.str(b.name, 80) || g.name;
      g.date = u.str(b.date, 20); g.budget = u.str(b.budget, 40); g.notes = u.str(b.notes, 300);
      g.participants = parseParticipants(b.participants, g.participants);
      await db.set(K.group(g.id), g);
      return summary(g);
    }

    case 'updateEmail': {
      const p = findP();
      const email = u.str(b.email, 120).toLowerCase();
      if (!u.isEmail(email)) u.fail(400, 'E-mail inválido.');
      p.email = email;
      await db.set(K.group(g.id), g);
      return summary(g);
    }

    case 'invite': {
      if (g.drawn) u.fail(409, 'O sorteio já foi feito — use "reenviar" em cada pessoa.');
      const failed = await sendTo(g, g.participants, base);
      return { ...(await summary(g)), failed, failReason: failed.reason };
    }

    case 'draw': {
      if (g.drawn) u.fail(409, 'O sorteio já foi feito.');
      // Embaralha e cada pessoa tira a próxima da fila: ninguém tira a si mesmo.
      const ids = u.shuffle(g.participants.map((p) => p.id));
      g.pairs = {};
      ids.forEach((id, i) => { g.pairs[id] = ids[(i + 1) % ids.length]; });
      g.drawn = true;
      g.drawnAt = Date.now();
      await db.set(K.group(g.id), g);
      const failed = await sendTo(g, g.participants, base);
      return { ...(await summary(g)), failed, failReason: failed.reason };
    }

    case 'reset': {
      // Desfaz o sorteio (apaga as conversas) para editar participantes e sortear de novo.
      await Promise.all(g.participants.map((p) => db.del(K.thread(g.id, p.id))));
      g.drawn = false; g.pairs = null; g.drawnAt = null;
      await db.set(K.group(g.id), g);
      return summary(g);
    }

    case 'resend': {
      const p = findP();
      const failed = await sendTo(g, [p], base);
      if (failed.length) u.fail(502, `Não consegui enviar para ${p.name}. ${failed.reason}`);
      return summary(g);
    }

    default:
      u.fail(400, 'Ação desconhecida.');
  }
});
