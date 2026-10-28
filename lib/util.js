const crypto = require('crypto');

class HttpError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}

const util = {
  id: (n = 12) => crypto.randomBytes(n).toString('base64url'),
  fail(status, msg) { throw new HttpError(status, msg); },
  str: (v, max = 200) => String(v ?? '').trim().slice(0, max),
  isEmail: (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),

  link(v) {
    v = util.str(v, 800);
    if (!v) return '';
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
    try {
      const u = new URL(v);
      if (!['http:', 'https:'].includes(u.protocol)) throw 0;
      return u.href;
    } catch { util.fail(400, 'Esse link não parece válido: ' + v); }
  },

  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  baseUrl(req) {
    if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
    const h = req.headers['x-forwarded-host'] || req.headers.host;
    const p = req.headers['x-forwarded-proto'] || 'https';
    return `${p}://${h}`;
  },

  // Envolve a função da API: só aceita POST, trata erros e devolve JSON.
  handler(fn) {
    return async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
      try {
        let body = req.body || {};
        if (typeof body === 'string') body = JSON.parse(body || '{}');
        res.status(200).json(await fn(body, req));
      } catch (e) {
        if (!e.status) console.error(e);
        res.status(e.status || 500).json({ error: e.status ? e.message : 'Erro no servidor: ' + e.message });
      }
    };
  },
};

module.exports = util;
