# Implantação e backup — LOGAN | Gestão Integrada

O sistema é duas aplicações separadas (API + frontend) e um banco PostgreSQL. Qualquer provedor que
rode Node.js e PostgreSQL serve. Abaixo, os três caminhos mais diretos.

## Opção 1 — Supabase (banco) + Railway/Render (API) + Vercel/Netlify (frontend)

Boa opção se você já usa ou pretende usar Supabase para outras coisas (auth, storage, etc. no
futuro) — aqui ele é usado só como PostgreSQL gerenciado.

1. **Banco (Supabase):** crie um projeto, copie a *connection string* (modo "Transaction" ou
   "Session" — prefira a porta 5432/6543 conforme o plano). Essa string vai em `DATABASE_URL`.
2. **API (Railway ou Render):**
   - Suba a pasta `backend/` como um serviço Node.
   - Variáveis de ambiente: `DATABASE_URL` (do Supabase), `JWT_SECRET` (gere uma string aleatória
     longa — nunca reuse a de desenvolvimento), `PORT` (a plataforma geralmente define sozinha),
     `TZ=America/Fortaleza`.
   - Comando de build: `npm install && npx drizzle-kit push` (cria/atualiza as tabelas a partir de
     `src/db/schema.ts`). Comando de start: `npm run build && npm run start` (ou `npm run dev` se a
     plataforma preferir rodar via `tsx` diretamente — funciona, mas `build`+`start` é mais robusto
     em produção).
   - Rode `npm run seed` **uma vez**, manualmente (shell da plataforma ou localmente apontando
     `DATABASE_URL` para o banco de produção), para criar os usuários administradores e os
     cadastros padrão. Depois disso, rode `npm run migrar` e `npm run backfill:estoque` se for
     migrar as planilhas para o ambiente de produção (veja o aviso de segurança abaixo).
3. **Frontend (Vercel ou Netlify):**
   - Suba a pasta `frontend/`.
   - Variável de build: configure a URL da API (ajuste `frontend/src/lib/api.ts` ou uma variável
     `VITE_API_URL`, conforme preferir, para apontar para o domínio da API em produção — em
     desenvolvimento isso é resolvido pelo proxy do Vite, que não existe em produção).
   - Comando de build: `npm install && npm run build`; publique a pasta `dist/`.

## Opção 2 — Railway "tudo em um"

Railway consegue hospedar o Postgres, a API e (com um serviço estático) o frontend no mesmo
projeto, o que simplifica o gerenciamento de variáveis de ambiente (ele injeta `DATABASE_URL`
automaticamente ao linkar o serviço de banco ao de API). Os passos de build/seed/migração são os
mesmos da Opção 1.

## Opção 3 — VPS própria (ex.: DigitalOcean, Hetzner, um servidor da empresa)

Para quem prefere manter tudo sob controle direto.

1. Instale PostgreSQL 16, Node.js 20+ e (opcional, recomendado) `nginx` como proxy reverso.
2. Crie o banco e o usuário (`createuser`/`createdb`, ou via `psql`).
3. Copie `backend/` e `frontend/` para o servidor (ou clone o repositório git).
4. Backend:
   ```bash
   cd backend && npm install && npm run build
   cp .env.example .env   # edite com os dados reais
   npx drizzle-kit push
   npm run seed
   # process manager (recomendado): pm2 start dist/server.js --name logan-api
   ```
5. Frontend: `cd frontend && npm install && npm run build` — sirva a pasta `dist/` com `nginx`
   (ou qualquer servidor de arquivos estáticos), com um `location /api { proxy_pass
   http://localhost:3334; }` apontando para a API.
6. Configure HTTPS (Let's Encrypt via `certbot`, por exemplo) — o sistema lida com dados comerciais
   e credenciais de login, não deve rodar sem TLS em produção.

## Migrando as planilhas para o ambiente de produção

As planilhas de origem (`migracao/*.xlsx`) contêm dados reais de clientes — **não** devem ser
versionadas num repositório público nem deixadas em um servidor sem controle de acesso. Para migrar
em produção:

```bash
cd backend
DATABASE_URL="<string de produção>" npm run migrar
DATABASE_URL="<string de produção>" npm run backfill:estoque
```

Depois de migrar, acesse a tela **Validação da Migração** e revise as 41 pendências antes de
considerar os dados prontos para uso operacional (ver `relatorio-migracao.md`).

## Senhas e segredos

- Troque `JWT_SECRET` para uma string aleatória longa e exclusiva de produção — nunca reutilize a
  de desenvolvimento (`logan-dev-secret-...`).
- Troque as senhas provisórias dos dois usuários administradores (`Logan@2026`) assim que o sistema
  estiver acessível — o campo `mustResetPwd` já força isso no primeiro login.
- Nunca commite o arquivo `.env` (já está fora do controle de versão por convenção; apenas
  `.env.example`, sem segredos, é versionado).

## Backup

O dado vale mais que o código — faça backup do **banco**, regularmente.

**Backup lógico (recomendado, simples de restaurar em qualquer versão do Postgres):**
```bash
pg_dump "$DATABASE_URL" -Fc -f logan_backup_$(date +%Y%m%d_%H%M).dump
# restaurar:
pg_restore -d "$DATABASE_URL_DESTINO" --clean --if-exists logan_backup_AAAAMMDD_HHMM.dump
```

**Se o banco for gerenciado (Supabase, Railway, RDS, etc.):** ative o backup automático diário do
próprio provedor — é a forma mais confiável, já que roda fora da aplicação e sobrevive mesmo que o
servidor da API caia. Verifique a política de retenção (geralmente 7 dias no plano gratuito,
estendível nos pagos) e, se o negócio exigir mais histórico, combine com o `pg_dump` manual acima
rodado por uma rotina agendada (cron) guardando os arquivos em outro local (outro provedor de
storage, não o mesmo servidor do banco).

**Frequência sugerida:** diária, fora do horário comercial, com retenção de pelo menos 30 dias para
poder recuperar um erro operacional percebido tarde (ex.: "entrega registrada errada há duas
semanas").

## Monitoramento básico

A API expõe `GET /api/health` (retorna `{"ok": true, ...}`) — use isso num *health check* da
plataforma de hospedagem ou de um monitor externo simples (UptimeRobot, etc.) para saber se o
sistema caiu antes que um usuário avise.
