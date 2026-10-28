// Banco de dados: Upstash Redis (grátis, conectado pelo Vercel Marketplace).
// Usa a API REST do Upstash direto com fetch, sem dependências.
// Sem as variáveis configuradas, usa memória (só para testes locais).

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL = String(60 * 60 * 24 * 180); // dados somem sozinhos após 180 dias
const mem = new Map();

function memCmd([c, k, ...rest]) {
  switch (c) {
    case 'GET': return mem.has(k) ? mem.get(k) : null;
    case 'SET': mem.set(k, rest[0]); return 'OK';
    case 'DEL': mem.delete(k); return 1;
    case 'RPUSH': { const l = mem.get(k) || []; l.push(...rest); mem.set(k, l); return l.length; }
    case 'LRANGE': return (mem.get(k) || []).slice();
    case 'EXPIRE': return 1;
    default: throw new Error('Comando não suportado: ' + c);
  }
}

async function cmd(args) {
  if (!URL_ || !TOKEN) return memCmd(args);
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const j = await r.json();
  if (j.error) throw new Error('Banco de dados: ' + j.error);
  return j.result;
}

module.exports = {
  keys: {
    group: (g) => `g:${g}`,
    wishes: (g, p) => `w:${g}:${p}`,
    thread: (g, giver) => `t:${g}:${giver}`, // conversa entre quem tirou (giver) e quem foi tirado
  },
  async get(k) { const v = await cmd(['GET', k]); return v ? JSON.parse(v) : null; },
  async set(k, v) { return cmd(['SET', k, JSON.stringify(v), 'EX', TTL]); },
  async del(k) { return cmd(['DEL', k]); },
  async push(k, v) { await cmd(['RPUSH', k, JSON.stringify(v)]); await cmd(['EXPIRE', k, TTL]); },
  async list(k) { const a = await cmd(['LRANGE', k, '0', '-1']); return (a || []).map((x) => JSON.parse(x)); },
};
