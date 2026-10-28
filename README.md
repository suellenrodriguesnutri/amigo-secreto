# 🎁 Amigo Secreto

App de amigo secreto 100% online:

- O organizador cadastra os participantes (nome + e-mail) e faz o sorteio.
- Cada pessoa recebe **por e-mail** quem tirou e um link pessoal.
- No link pessoal: lista de desejos com **3 opções + link do presente**, a lista de quem tirou e **mensagens anônimas** (quem tirou pergunta, a pessoa responde sem saber quem é). Cada mensagem gera um aviso por e-mail.
- O painel do organizador **nunca mostra quem tirou quem** — dá pra organizar e participar.

## Como publicar (uns 15 minutos, tudo grátis)

### 1. Senha de app do Gmail (para enviar os e-mails)
1. Entre em https://myaccount.google.com/security e ative a **Verificação em duas etapas** (se ainda não tiver).
2. Abra https://myaccount.google.com/apppasswords, crie uma senha com o nome "Amigo Secreto".
3. Copie a senha de 16 letras (aparece uma vez só).

### 2. GitHub
Crie um repositório novo chamado `amigo-secreto` e envie todos os arquivos desta pasta (mesmo jeito da lista de mercado).

### 3. Vercel
1. **Add New → Project** e importe o repositório `amigo-secreto`. Clique em **Deploy**.
2. No projeto, vá em **Storage → Create Database → Redis** (da empresa Redis), plano **Free**, e conecte ao projeto. A variável do banco (`REDIS_URL`) é criada sozinha. (Upstash também funciona.)
3. Em **Settings → Environment Variables**, adicione:

| Nome | Valor |
|---|---|
| `ADMIN_PASSWORD` | uma senha sua (só quem tem ela cria grupos) |
| `GMAIL_USER` | seu Gmail (ex.: `seuemail@gmail.com`) |
| `GMAIL_APP_PASSWORD` | a senha de 16 letras do passo 1 (sem espaços) |

4. Vá em **Deployments**, nos três pontinhos do último deploy, **Redeploy** (para pegar as variáveis).

### 4. Usar
1. Abra o endereço do app, preencha o grupo, os participantes e a senha → **Criar grupo**.
2. Salve o link do painel (ele também vai pro seu e-mail).
3. (Opcional) **Enviar convite** para todos montarem a lista antes.
4. **Sortear e enviar e-mails**. Pronto!

## Dicas
- Limite do Gmail: cerca de 500 e-mails por dia — sobra para qualquer grupo.
- Se o e-mail cair no spam, peça para marcarem "Não é spam".
- Errou um e-mail? No painel, toque em ↻ ao lado da pessoa, corrija e reenvie.
- Quer trocar participantes depois do sorteio? **Desfazer sorteio**, edite e sorteie de novo.
- Os dados apagam sozinhos depois de 180 dias.

## Por que e-mail e não WhatsApp?
A API oficial do WhatsApp exige conta Business verificada na Meta, aprovação de cada modelo de mensagem e cobra por conversa. O Gmail é grátis, funciona com qualquer pessoa e não precisa de aprovação.
