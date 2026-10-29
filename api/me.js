// API do participante (acessada pelo link pessoal do e-mail).
const db = require('../lib/db');
const mail = require('../lib/mail');
const u = require('../lib/util');
const K = db.keys;

const EMPTY = () => [0, 1, 2].map(() => ({ text: '', link: '', size: '' }));
const personUrl = (base, g, p) => `${base}/p.html?g=${g.id}&t=${p.token}`;

async function context(b) {
  const g = await db.get(K.group(u.str(b.g, 40)));
  const me = g && g.participants.find((p) => p.token === b.t);
  if (!me) u.fail(404, 'Link inválido ou expirado. Abra pelo link que chegou no seu e-mail.');
  const giftee = g.drawn ? g.participants.find((p) => p.id === g.pairs[me.id]) : null;
  const santaId = g.drawn ? Object.keys(g.pairs).find((k) => g.pairs[k] === me.id) : null;
  const santa = santaId ? g.participants.find((p) => p.id === santaId) : null;
  return { g, me, giftee, santa };
}

function cleanText(t) {
  const text = u.str(t, 500);
  if (!text) u.fail(400, 'Escreva uma mensagem.');
  return text;
}

module.exports = u.handler(async (b, req) => {
  const base = u.baseUrl(req);
  const { g, me, giftee, santa } = await context(b);

  switch (b.action) {
    case 'load': {
      const [myWishes, gifteeWishes, toGiftee, fromSanta] = await Promise.all([
        db.get(K.wishes(g.id, me.id)),
        giftee ? db.get(K.wishes(g.id, giftee.id)) : null,
        giftee ? db.list(K.thread(g.id, me.id)) : [],
        santa ? db.list(K.thread(g.id, santa.id)) : [],
      ]);
      return {
        group: { name: g.name, date: g.date, budget: g.budget, notes: g.notes, drawn: g.drawn },
        me: { name: me.name, wishes: myWishes || EMPTY() },
        giftee: giftee ? { name: giftee.name, wishes: gifteeWishes || EMPTY() } : null,
        // Na conversa com quem eu tirei, eu sou o "santa". Na conversa com quem me tirou, sou o "giftee".
        toGiftee: toGiftee.map((m) => ({ mine: m.by === 'santa', text: m.text, at: m.at })),
        fromSanta: fromSanta.map((m) => ({ mine: m.by === 'giftee', text: m.text, at: m.at })),
      };
    }

    case 'saveWishes': {
      const list = Array.isArray(b.wishes) ? b.wishes.slice(0, 3) : [];
      while (list.length < 3) list.push({});
      const wishes = list.map((w, i) => {
        const text = u.str(w && w.text, 140);
        const link = u.link(w && w.link);
        const size = u.str(w && w.size, 30);
        if ((link || size) && !text) u.fail(400, `Escreva o nome do presente ${i + 1} (o link ou o tamanho sozinho não diz o que é).`);
        return { text, link, size };
      });
      await db.set(K.wishes(g.id, me.id), wishes);
      return { wishes };
    }

    case 'sendToGiftee': {
      if (!giftee) u.fail(409, 'O sorteio ainda não foi feito.');
      const text = cleanText(b.text);
      const key = K.thread(g.id, me.id);
      if ((await db.list(key)).length >= 200) u.fail(429, 'Limite de mensagens atingido nesta conversa.');
      await db.push(key, { by: 'santa', text, at: Date.now() });
      await mail.send(giftee.email, mail.templates.toGiftee(g, giftee, text, personUrl(base, g, giftee)))
        .catch((e) => console.error(e.message));
      return { ok: true };
    }

    case 'replyToSanta': {
      if (!santa) u.fail(409, 'O sorteio ainda não foi feito.');
      const text = cleanText(b.text);
      const key = K.thread(g.id, santa.id);
      if ((await db.list(key)).length >= 200) u.fail(429, 'Limite de mensagens atingido nesta conversa.');
      await db.push(key, { by: 'giftee', text, at: Date.now() });
      await mail.send(santa.email, mail.templates.toSanta(g, santa, me, text, personUrl(base, g, santa)))
        .catch((e) => console.error(e.message));
      return { ok: true };
    }

    default:
      u.fail(400, 'Ação desconhecida.');
  }
});
