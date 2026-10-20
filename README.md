# GitHub Codespaces ♥️ React

Welcome to your shiny new Codespace running React! We've got everything fired up and running for you to explore React.

You've got a blank canvas to work on from a git perspective as well. There's a single initial commit with the what you're seeing right now - where you go from here is up to you!

Everything you do here is contained within this one codespace. There is no repository on GitHub yet. If and when you’re ready you can click "Publish Branch" and we’ll create your repository and push up your project. If you were just exploring then and have no further need for this code then you can simply delete your codespace and it's gone forever.

This project was bootstrapped for you with [Vite](https://vitejs.dev/).

## Executar a aplicação completa no Codespaces

Na raiz do projeto, execute `npm run dev:stack`. O comando inicia PostgreSQL por Docker, cria segredos locais e uma conta aleatória de desenvolvimento, aplica as migrações e inicia a API e o frontend. As credenciais iniciais aparecem no terminal e também ficam em `backend/.local-admin-credentials.json`, ignorado pelo Git. Não compartilhe esse arquivo nem use a conta fora do ambiente de desenvolvimento.

Abra a porta encaminhada **Application (3000)** na aba **Ports** do Codespaces. A API é acessada pelo proxy local do Vite; não encaminhe a porta 4000. Para parar os servidores, pressione `Ctrl+C`; o banco persiste entre reinícios. Para pará-lo também, execute `docker compose --env-file backend/.env -f backend/compose.dev.yml down`.

`npm start` inicia somente o frontend e exige uma API disponível na porta 4000.

## Available Scripts

In the project directory, you can run:

### `npm start`

We've already run this for you in the `Codespaces: server` terminal window below. If you need to stop the server for any reason you can just run `npm start` again to bring it back online.

Runs the app in the development mode.\
Open [http://localhost:3000/](http://localhost:3000/) in the built-in Simple Browser (`Cmd/Ctrl + Shift + P > Simple Browser: Show`) to view your running application.

The page will reload automatically when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

## Learn More

You can learn more in the [Vite documentation](https://vitejs.dev/guide/).

To learn Vitest, a Vite-native testing framework, go to [Vitest documentation](https://vitest.dev/guide/)

To learn React, check out the [React documentation](https://reactjs.org/).

## Organização do código

O frontend mantém a interface, o estado de interação e as regras de transformação de dados separados:

```text
src/
├── @types/       # contratos compartilhados
├── components/   # componentes reutilizáveis de interface
├── context/      # estado global da sessão
├── data/         # conjunto de dados de demonstração
├── hooks/        # estado e orquestração de fluxos da interface
├── pages/        # composição de telas por funcionalidade
├── services/     # filtros e cálculos de domínio
└── utils/        # formatação e exportação

backend/src/
├── config/       # ambiente, banco de dados e criptografia
├── controllers/  # adaptadores HTTP
├── middleware/   # autenticação, autorização e erros
├── services/     # regras de domínio
├── types/        # extensões de tipos do Express
├── routes.ts
└── server.ts
```

O contexto em `src/context/AuthContext.tsx` restaura a sessão HttpOnly da API; `src/pages/Login.tsx` autentica por e-mail e senha sem guardar tokens no navegador. `src/services/api.ts` centraliza as chamadas HTTP e o tratamento de erros. Os filtros do cadastro ficam em `src/hooks/useCensusFilters.ts`. O gerador usa `src/hooks/useReportBuilder.ts` para coordenar o estado e `src/services/reportService.ts` para filtrar, agregar e mapear os dados. As transformações de relatório são independentes do React e têm testes próprios.

### Code Splitting

This section has moved here: [https://sambitsahoo.com/blog/vite-code-splitting-that-works.html](https://sambitsahoo.com/blog/vite-code-splitting-that-works.html)

### Analyzing the Bundle Size

This section has moved here: [https://github.com/btd/rollup-plugin-visualizer#rollup-plugin-visualizer](https://github.com/btd/rollup-plugin-visualizer#rollup-plugin-visualizer)

### Making a Progressive Web App

This section has moved here: [https://dev.to/hamdankhan364/simplifying-progressive-web-app-pwa-development-with-vite-a-beginners-guide-38cf](https://dev.to/hamdankhan364/simplifying-progressive-web-app-pwa-development-with-vite-a-beginners-guide-38cf)

### Advanced Configuration

This section has moved here: [https://vitejs.dev/guide/build.html#advanced-base-options](https://vitejs.dev/guide/build.html#advanced-base-options)

### Deployment

This section has moved here: [https://vitejs.dev/guide/build.html](https://vitejs.dev/guide/build.html)

### Troubleshooting

This section has moved here: [https://vitejs.dev/guide/troubleshooting.html](https://vitejs.dev/guide/troubleshooting.html)

## Gerador de relatórios

O módulo **Relatórios** é acessado pela navegação lateral e reaproveita o contrato `DashboardData` e os dados de `DATA` usados pelos painéis:

- O tipo **Visão geral · dashboard** gera uma prévia consolidada com KPIs, cinco gráficos (beneficiários por tipo, vencimentos por grupo, situação cadastral, cadastros por data e principais cargos) e dados tabulares para exportar em CSV, Excel e PDF.
- `src/pages/ReportBuilder.tsx`: composição da interface do gerador.
- `src/hooks/useReportBuilder.ts`: estado do gerador e atualização da prévia.
- `src/services/reportService.ts`: filtros, métricas e mapeamento dos dados para linhas exportáveis. A prévia e a impressão mostram todas as linhas recebidas para o relatório.
- `src/utils/reportExport.ts`: CSV tabular, Excel com aba de resumo e detalhes, e PDF paisagem paginado com filtros, indicadores, cabeçalho de continuação, rodapé e contagem exata de linhas.
- `src/components/ReportFilterBar.tsx`: intervalo de datas, status, cargo e entidade.
- `src/components/ReportPreview.tsx`: cartões, gráficos SVG, tabela, estados de carregamento/vazio e impressão.
- `src/components/ReportExportButtons.tsx` e `src/utils/reportExport.ts`: CSV protegido contra fórmulas de planilha, Excel e impressão/PDF pelo navegador.
- `src/@types/reports.ts`: tipos compartilhados para filtros, formatos, métricas e linhas.

Os relatórios comuns usam a competência mais recente retornada pelo painel (na massa de demonstração, Mar/2026), sem vínculo pessoa a pessoa; filtros cadastrais não são aplicados a atributos financeiros que não existem. O perfil Gestor/Operador/Auditoria apenas escolhe métricas iniciais e não concede permissões. Os relatórios cadastrais exportam CPF mascarado; impressão/PDF usa a pré-visualização e os recursos nativos do navegador.

## Modo de demonstração, API e proxy

- O painel exige sessão válida via `GET /api/auth/session`; contas entram por `POST /api/auth/login` e encerram a sessão por `POST /api/auth/logout`. Após autenticar, a interface usa os dados de demonstração locais de `src/data/mockData.ts`, identificados como tal no topo. Não coloque dados pessoais reais nessa massa local nem publique a demonstração como ambiente de produção.
- Os endpoints de dados reais continuam protegidos. O backend confere a conta provisionada na tabela `User` via `POST /api/auth/login`, define JWT em cookie `HttpOnly`, `SameSite=Strict` e `Secure` em produção, valida sessão em `GET /api/auth/session` e encerra em `POST /api/auth/logout`. A remoção do login visual não desativa a autenticação nem o controle de acesso do backend.
- Senhas são verificadas por scrypt (N=16384, r=8, p=1, salt aleatório de 16 bytes, chave de 64 bytes); não há senha padrão nem cadastro público. O sistema que provisiona contas deve usar `provisionLocalUser` em `backend/src/services/accountProvisioning.ts` ou gerar exatamente o hash no formato retornado por `hashPassword` em `backend/src/config/password.ts`; guardar somente o hash na coluna `User.passwordHash`. A coluna `oidcSub` pode ficar nula para contas locais. Senhas devem ter 12–128 caracteres.
- Em bancos novos, `prisma migrate deploy` aplica a migração inicial `20261016000000_initial_schema` e, em seguida, a migração de autenticação `20261016120000_local_password_auth`. Se o banco já contém o schema legado e ainda não possui histórico Prisma, marque somente a migração inicial como aplicada antes de executar `prisma migrate deploy`: `npm exec prisma migrate resolve -- --applied 20261016000000_initial_schema` dentro de `backend`. Use `backend/.env.example` como modelo: substitua `db.example.internal`, `USER` e `PASSWORD` na `DATABASE_URL` pelo endereço e credenciais reais do banco. Defina `AUTH_JWT_SECRET` como 32 bytes aleatórios hexadecimais (64 caracteres), além de `PII_ENCRYPTION_KEY` e `PII_LOOKUP_HMAC_KEY` via gestor de segredos; nunca use valores de exemplo em produção. `CORS_ORIGINS` precisa listar a origem pública exata do frontend.
- O backend Express está em `backend/src/server.ts`; as rotas privadas são protegidas por `authenticate` e `requireRoles`, e o login tem limite de tentativas por IP. Para iniciar localmente, configure `backend/.env` e execute `npm run dev` dentro de `backend`.
- Em desenvolvimento, Vite encaminha `/api` para `http://localhost:4000`; configure `VITE_API_PROXY_TARGET` para outro destino quando necessário. Em produção, `deploy/nginx.conf` encaminha `/api/` ao serviço `rpps-api:4000` e serve a SPA no mesmo domínio.
- O gerador oferece CSV e Excel, e gera PDF localmente com jsPDF; a impressão do navegador permanece disponível. Sessão local usa cookie, enquanto OIDC bearer-token é mantido opcional para integrações que configurem issuer, audience e JWKS.

### Massa sintética para desenvolvimento local

- `npm --prefix backend run db:seed-synthetic` insere 10.000 pessoas fictícias, registros de censo e linhas de folha no banco local `rpps_dev`. É aditivo e idempotente: preserva registros existentes e não duplica os IDs determinísticos `DEMO-SYNTH-*`.
- A carga contém 6.000 ativos, 2.000 aposentados e 2.000 pensionistas, com situações cadastrais variadas, valores financeiros sintéticos e competência de agosto/2026. Os dados são identificáveis no filtro **Fonte** como `Dados sintéticos (teste)`.
- O comando recusa execução fora de `localhost`/`127.0.0.1`/`::1`, em outro banco que não `rpps_dev` ou com `NODE_ENV=production`. Os CPFs gerados são inválidos pelo dígito verificador e não representam CPFs reais.
- Para solicitar outro volume (entre 1 e 100.000), defina `SYNTHETIC_RECORD_COUNT` antes do comando. O tamanho padrão é 10.000.

## PWA e uso offline

- O app instalável usa `public/manifest.webmanifest`, os ícones existentes e o Service Worker próprio `public/service-worker.js`; não depende de plugin adicional. O build pré-cacheia o shell, os ícones e os bundles JS/CSS/fontes/imagens enumerados em `offline-assets.json`. Scripts, estilos, imagens e fontes usam Cache-First. Navegações retornam ao shell salvo sem rede ou a `public/offline.html` se o shell não estiver disponível.
- Leituras de `GET /api/dashboard/data` e `GET /api/reports/census-records` usam Network-First e cache de fallback separado pelo ID do usuário. Esses endpoints contêm registros pessoais; o snapshot completo já é mantido em IndexedDB para o modo offline conforme o escopo aprovado. Rotas de autenticação e a exportação administrativa descriptografada nunca são cacheadas. Logout bem-sucedido remove snapshot, rascunhos/cofre e cache de API do usuário; se houver fila local, a interface pede confirmação porque alterações pendentes serão perdidas.
- `src/services/offlineStore.ts` usa IndexedDB (`censo-offline`) para manter a identidade da última sessão validada, o snapshot do painel e rascunhos criptografados por usuário. Sem conexão, usuários autenticados anteriormente podem consultar o snapshot em modo somente leitura e criar/editar registros ativos em **Segurados**; reconectar envia os rascunhos à rota protegida `POST /api/personnel/insured-import`.
- Antes de guardar dados pessoais offline, crie um cofre neste dispositivo com uma frase secreta de pelo menos 12 caracteres. PBKDF2-SHA-256 (310.000 iterações) deriva uma chave AES-256-GCM; somente sal e verificador cifrado ficam no IndexedDB, a chave fica apenas em memória enquanto o cofre está desbloqueado. A frase secreta não é armazenada nem enviada ao servidor. Sem a frase secreta os rascunhos não podem ser recuperados; apagar dados do navegador ou o armazenamento do dispositivo também os apaga. Código malicioso executado na mesma origem enquanto o cofre está desbloqueado pode acessar dados em memória.
- Rascunhos sincronizados continuam como cópias locais cifradas até exclusão manual na lista do cofre ou logout. Excluir uma cópia local não apaga o registro no servidor. Bloquear o cofre oculta o conteúdo descriptografado, mas não apaga rascunhos. Senhas e cookies de sessão nunca são copiados para o IndexedDB.
- Os rascunhos pessoais usam a fila de `src/services/offlineSync.ts`; as rotas de autenticação continuam proibidas. Operações são reenviadas em ordem ao reconectar; falhas de rede/servidor recebem novas tentativas com espera crescente, HTTP 409/412 requer revisão, 401 fica bloqueado até autenticação e erros de validação precisam de correção ou exclusão local. A API grava pessoa, registro do censo e competência de folha em uma transação, e o upsert por ID externo/CPF permite reenvio seguro do registro. `Idempotency-Key` não substitui essa idempotência do domínio.
- Para testar a experiência offline, gere uma build e sirva-a por HTTPS ou `localhost` (`npm run build` e `npm run preview`); depois use DevTools → Application → Service Workers → Offline. O botão de instalação só aparece em navegadores que emitem `beforeinstallprompt`; no iOS, use a opção “Adicionar à Tela de Início” do navegador.
- O indicador de conectividade mostra estado online/offline, sincronização e contagens da fila. No celular, o menu lateral usa drawer acionado pelo botão de menu, filtros abrem em bottom sheet e a listagem cadastral vira cards sanfonados; as demais tabelas permanecem roláveis horizontalmente.

## Analytics e exportação administrativa

- O dashboard autenticado consulta `GET /api/dashboard/data` com período e regime; os registros do censo e a folha são filtrados no servidor e os indicadores são recalculados a cada alteração. A competência usada é a mais recente dentro do intervalo. A contagem da população por categoria representa a posição atual, não um histórico temporal.
- `backend/src/services/analytics.ts` calcula a situação cadastral e percentuais, composição da população, folha, contribuições e projeções com `Decimal` e arredondamento financeiro `ROUND_HALF_UP` para duas casas. A projeção anualiza a competência multiplicando-a por 12, sem crescimento, inflação ou mudança de participantes.
- O schema contém data de nascimento cifrada, tempo contributivo, regime e fonte para os novos registros importados; métricas demográficas são calculadas sobre os registros preenchidos e ficam indisponíveis quando faltam dados. O legado ainda pode não ter esses campos.
- Nomes, CPFs e matrículas são descriptografados apenas no backend com AES-256-GCM e a chave de ambiente `PII_ENCRYPTION_KEY`; a resposta habitual do dashboard contém valores mascarados. A exportação completa em `GET /api/analytics/decrypted-export` exige a role `ADMIN`, não é armazenada em cache e registra ator, horário, filtros e quantidades exportadas sem registrar PII. Senhas e chaves nunca são enviadas ao navegador.
- A exportação completa pede confirmação e gera CSV, XLSX (abas Resumo, Recenseados, Segurados e Benefícios) ou PDF. O período seleciona registros do censo e a competência mais recente da folha; a aba de segurados é uma posição cadastral atual, sem histórico temporal. Os arquivos baixados contêm PII descriptografada e devem ser armazenados apenas em local autorizado.
- O módulo administrativo está em `src/components/DecryptedAnalyticsExport.tsx` e `src/utils/analyticsExport.ts`; os arquivos locais comuns de relatório continuam mascarando CPF e não concedem permissões. Os perfis exibidos no gerador de relatórios são apenas predefinições visuais, não controles de autorização.
- O schema também guarda o identificador externo, regime previdenciário, fonte, data de nascimento cifrada e tempo contributivo, e associa o período de referência à folha. `npm --prefix backend run import:insured -- <arquivo-json>` importa um registro ativo validado de forma transacional/idempotente; a idade fornecida é ignorada e calculada pela data de nascimento. O importador mapeia a competência da folha para o último mês do período e não inventa contribuição patronal (grava zero quando ela não foi fornecida). Não versionar arquivos de entrada com PII.
- O teste de carga nativo da API pode ser executado com `LOAD_TEST_CONCURRENCY=50 LOAD_TEST_DURATION_SECONDS=60 npm --prefix backend run load:test`. Por padrão ele usa apenas as credenciais locais e `http://127.0.0.1:4000/api`; para outros ambientes, a URL e credenciais precisam ser fornecidas explicitamente. O relatório mede throughput, erros e p50/p95/p99 da rota do dashboard.

## Dashboard previdenciário

- A visão geral usa os dados de folha e censo do sistema; não os apresenta como vendas. O filtro de cargo cruza com folha/censo de ativos, e os filtros de período e categoria são enviados à API.
- A média por vínculo é `proventos da competência / vínculos com folha na competência`. A folha acumulada anual soma apenas as competências presentes no banco; crescimento anual é `(total do ano atual - total do ano anterior) / total do ano anterior × 100` e não é exibido como comparável sem dois anos com dados. A participação da categoria é `proventos da categoria / proventos totais da competência × 100`.
- O backend fornece `payroll_history` por competência sem anualizar valores nem completar meses ausentes. O dashboard mostra “Sem dados” em períodos vazios. Como o banco atual tem uma única competência de folha, não há evolução mensal comparável ou crescimento ano a ano.
- A base não possui campos geográficos de cidade, UF ou código IBGE. O mapa municipal foi adiado até confirmar o município e adicionar/fornecer a localização associada às linhas.
