// Banco de dados Redis, conectado pela aba Storage do Vercel. Funciona com:
//  - Redis (da empresa Redis, plano Free): variável REDIS_URL
//  - Upstash Redis: variáveis KV_REST_API_URL / KV_REST_API_TOKEN
// Sem nenhuma delas, usa memória (só para testes no computador).

// Procura as variáveis do banco mesmo com prefixo personalizado (ex.: STORAGE_KV_REST_API_URL).
function findEnv(suffixes, avoid) {
  for (const s of suffixes) if (process.env[s]) return process.env[s];
  const k = Object.keys(process.env).find((key) => suffixes.some((s) => key.endsWith(s)) && !(avoid && key.includes(avoid)));
  return k ? process.env[k] : undefined;
}
const URL_ = findEnv(['KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL']);
const TOKEN = findEnv(['KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN'], 'READ_ONLY');
const REDIS_URL = findEnv(['REDIS_URL']);
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

// Conexão direta com o Redis (reaproveitada entre os acessos).
let clientP;
async function tcpCmd(args) {
  if (!clientP) {
    const { createClient } = require('redis');
    const c = createClient({ url: REDIS_URL, socket: { connectTimeout: 8000 } });
    c.on('error', (e) => console.error('Redis:', e.message));
    clientP = c.connect().then(() => c).catch((e) => { clientP = null; throw e; });
  }
  const c = await clientP;
  return c.sendCommand(args.map(String));
}

async function cmd(args) {
  if ((!URL_ || !TOKEN) && REDIS_URL) return tcpCmd(args);
  if (!URL_ || !TOKEN) {
    // No Vercel, sem banco os dados se perdem entre um clique e outro: avisa em vez de fingir que salvou.
    if (process.env.VERCEL) {
      const e = new Error('O banco de dados não está conectado. No Vercel: Storage → Create Database → Redis (plano Free) → Connect ao projeto e depois Redeploy.');
      e.status = 503;
      throw e;
    }
    return memCmd(args);
  }
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
