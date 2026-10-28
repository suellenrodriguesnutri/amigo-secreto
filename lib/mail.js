// Envio de e-mails pelo Gmail (senha de app). Sem as variáveis, só registra no log (modo teste).

let transporter;
function getTransporter() {
  if (!transporter) {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      service: 'gmail',
      pool: true,
      maxConnections: 3,
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
  }
  return transporter;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

function details(g) {
  const rows = [];
  if (g.date) rows.push(`📅 <b>Dia da nossa troca de presentes:</b> ${esc(fmtDate(g.date))}`);
  if (g.budget) rows.push(`💰 <b>Valor do presente:</b> ${esc(g.budget)}`);
  if (g.notes) rows.push(`📝 ${esc(g.notes)}`);
  return rows.length
    ? `<p style="margin:18px 0 0;padding:14px 16px;background:#F6F1E9;border-radius:10px;font-size:14px;line-height:1.7;color:#3b453f">${rows.join('<br>')}</p>`
    : '';
}

function layout(g, inner, btnText, btnUrl) {
  return `<!doctype html><html><body style="margin:0;background:#EFE8DC;font-family:Arial,Helvetica,sans-serif;color:#1F2A24">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#1E4D3A;padding:22px 26px;color:#F6F1E9;font-size:13px;letter-spacing:2px;text-transform:uppercase">🎁 Amigo Secreto · ${esc(g.name)}</td></tr>
<tr><td style="padding:28px 26px 30px;font-size:16px;line-height:1.55">
${inner}
${btnUrl ? `<p style="margin:26px 0 6px"><a href="${esc(btnUrl)}" style="display:inline-block;background:#B33A2E;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:bold">${esc(btnText)}</a></p>
<p style="margin:10px 0 0;font-size:12px;color:#7a837d">Esse link é só seu — não compartilhe, ele mostra quem você tirou.</p>` : ''}
</td></tr></table></td></tr></table></body></html>`;
}

const templates = {
  draw(g, p, giftee, url) {
    return {
      subject: `🎁 Amigo secreto "${g.name}": veja quem você tirou!`,
      html: layout(g, `
<p style="margin:0 0 6px">Oi, <b>${esc(p.name)}</b>!</p>
<p style="margin:0">O sorteio foi feito. Você tirou:</p>
<p style="margin:16px 0;font-family:Georgia,serif;font-size:32px;color:#B33A2E;font-weight:bold">${esc(giftee.name)}</p>
<p style="margin:0">Na sua página você vê a lista de desejos de ${esc(giftee.name)}, cadastra a sua e pode mandar perguntas anônimas pra ${esc(giftee.name)} sem revelar quem você é. 🤫</p>
${details(g)}`, 'Abrir minha página', url),
    };
  },
  invite(g, p, url) {
    return {
      subject: `🎄 Amigo secreto "${g.name}": monte sua lista de desejos`,
      html: layout(g, `
<p style="margin:0 0 6px">Oi, <b>${esc(p.name)}</b>!</p>
<p style="margin:0">Você está no amigo secreto <b>${esc(g.name)}</b>. O sorteio ainda vai acontecer — enquanto isso, deixe até 3 sugestões de presente (com link, se quiser) pra facilitar a vida de quem te tirar.</p>
${details(g)}`, 'Montar minha lista', url),
    };
  },
  admin(g, url) {
    return {
      subject: `🔑 Seu link de organizador: "${g.name}"`,
      html: layout(g, `
<p style="margin:0">Grupo criado! Guarde este e-mail: é pelo link abaixo que você gerencia os participantes, envia convites e faz o sorteio.</p>
<p style="margin:14px 0 0;font-size:14px;color:#5b655f">O painel de organizador nunca mostra quem tirou quem — você pode participar do sorteio normalmente.</p>`, 'Abrir painel do organizador', url),
    };
  },
  toGiftee(g, giftee, text, url) {
    return {
      subject: `🤫 Seu amigo secreto te mandou uma mensagem`,
      html: layout(g, `
<p style="margin:0 0 12px">Oi, <b>${esc(giftee.name)}</b>! Seu amigo secreto mandou:</p>
<p style="margin:0;padding:14px 16px;border-left:4px solid #C9A24B;background:#FBF8F2;font-style:italic">${esc(text)}</p>`, 'Ler e responder', url),
    };
  },
  toSanta(g, santa, giftee, text, url) {
    return {
      subject: `💬 ${giftee.name} respondeu sua mensagem`,
      html: layout(g, `
<p style="margin:0 0 12px">Oi, <b>${esc(santa.name)}</b>! <b>${esc(giftee.name)}</b> respondeu:</p>
<p style="margin:0;padding:14px 16px;border-left:4px solid #C9A24B;background:#FBF8F2;font-style:italic">${esc(text)}</p>`, 'Ver conversa', url),
    };
  },
};

// Traduz os erros mais comuns do Gmail para algo que dá para resolver.
function explain(e) {
  const m = String(e && (e.response || e.message) || '');
  if (e.code === 'EAUTH' || /535|Username and Password not accepted|BadCredentials/i.test(m))
    return 'O Gmail recusou o login. Confira no Vercel se GMAIL_USER é o seu Gmail completo e se GMAIL_APP_PASSWORD é a senha de app de 16 letras (sem espaços), e faça Redeploy.';
  if (/534|Application-specific password required/i.test(m))
    return 'O Gmail exige uma senha de app. Crie em myaccount.google.com/apppasswords e coloque em GMAIL_APP_PASSWORD.';
  if (e.code === 'EENVELOPE' || /550|5\.1\.1/.test(m)) return 'Endereço de e-mail não existe ou foi recusado.';
  if (/limit|quota|454|421/i.test(m)) return 'O Gmail limitou os envios por hoje. Tente de novo mais tarde.';
  return 'Erro do Gmail: ' + m.slice(0, 200);
}

async function send(to, { subject, html }) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log('[e-mail simulado]', to, '|', subject);
    return { simulated: true };
  }
  try {
    await getTransporter().sendMail({
      from: `"Amigo Secreto" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });
  } catch (e) {
    transporter = null; // recria a conexão na próxima tentativa
    throw new Error(explain(e));
  }
  return { ok: true };
}

module.exports = { send, templates };
