# Forno Nero — estrutura de pedidos compartilhados

Esta pasta contém a API do Cloudflare Pages Functions e a migração inicial do D1.

## O que a estrutura prepara
- Cadastro persistente de pedidos com nome, celular, cidade, endereço, itens, pagamento e total.
- Código de pedido e token privado de acompanhamento.
- Consulta pública do status somente com código + token.
- Consulta e atualização do painel da cozinha protegidas por PIN.
- Histórico de alterações de etapa em `order_events`.

## Configuração necessária no Cloudflare (gratuita dentro das cotas)
1. Abra o painel Cloudflare e entre em **Workers & Pages → D1 SQL Database**.
2. Crie um banco chamado `forno-nero-orders`.
3. Abra o banco, vá em **Console** e execute todo o conteúdo de `migrations/0001_orders.sql`.
4. No projeto Pages **forno-nero**, abra **Settings → Functions → D1 database bindings**.
5. Adicione o binding com variável `DB` e selecione `forno-nero-orders`.
6. Em **Settings → Variables and Secrets**, crie o segredo `KITCHEN_PIN` com um PIN forte, exclusivo da cozinha. Não coloque esse PIN no código nem o compartilhe no link público.
7. Salve e faça um novo deploy do projeto.

## Rotas da API
- `POST /api/orders` — cria um pedido.
- `GET /api/orders?code=FN-...&token=...` — consulta um pedido para acompanhamento.
- `GET /api/orders` com cabeçalho `x-kitchen-pin` — lista pedidos ativos para a cozinha.
- `PATCH /api/orders` com cabeçalho `x-kitchen-pin` — atualiza a etapa de um pedido.

## Observações
- A API ainda precisa ser ligada ao formulário e ao painel do site; este commit instala a base do servidor e o esquema do banco, não ativa o fluxo de ponta a ponta.
- O WhatsApp automático e as notificações push são integrações separadas. Não há envio automático de WhatsApp nesta etapa.
- Para produção, a tela da cozinha deve solicitar o PIN e manter a sessão somente durante a sessão do navegador.
