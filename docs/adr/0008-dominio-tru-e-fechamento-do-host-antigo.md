# ADR-0008: Domínio tru.overlens.io e fechamento do host antigo

- **Status**: Proposto
- **Data**: 2026-11-16
- **Decisores**: Ruan Braz (com apoio do Claude Code)

## Contexto

O Brand System da Overlens ficou publicado em `overlens-os.vercel.app` e foi usado como referência por muitas pessoas de fora da empresa. A Overlens reescreveu o Brand System e decidiu fechar o acesso. O app ganhou um domínio próprio, `tru.overlens.io`, já adicionado ao projeto `overlens-os` na Vercel e com DNS configurado.

O endereço antigo continua circulando em links, favoritos e materiais de terceiros. Desligá-lo de vez faria essas pessoas encontrarem um erro, sem explicação e sem um caminho para acompanhar o que mudou.

## Problema

Como fechar o acesso pelo endereço antigo sem perder o contato de quem chega por ele, mantendo o app normal no domínio novo?

## Decisão

Vamos tratar `overlens-os.vercel.app` como **host fechado** e servir o app apenas em `https://tru.overlens.io`.

- **Gate por host no proxy** (`website/src/proxy.ts`, middleware do Next 16). A regra fica em `website/src/lib/closed-host.ts` e entra como a primeira linha do proxy, antes da sessão do Supabase. A comparação é por **host exato**: previews (`*-git-*.vercel.app`), localhost e `tru.overlens.io` seguem o fluxo de sempre. Assim a mudança no proxy fica pequena e não mexe em `PUBLIC_ROUTES`.
- **Todo caminho do host fechado vira o aviso.** Qualquer rota é reescrita (rewrite, a URL não muda) para `/aviso`. Não há login nesse host. Assets estáticos continuam fora do matcher. Rotas `/api/*` respondem 410, exceto `/api/lista-de-espera`.
- **Tela de aviso** (`website/src/app/aviso/`) no mesmo desenho da tela de login: tokens de superfície relativos ao tema, seletor de tema, componentes de formulário do app. Explica que o Brand System mudou, que o acesso está fechado, e oferece a lista de espera de um evento especial sobre as novidades. Não cita data, nome nem local do evento.
- **A lista de espera vai para o CRM do Growth System via RPC.** O CRM (outro projeto Supabase) não tem endpoint HTTP de entrada de leads. A porta oficial são as RPCs `public.crm_intake_commit` (grava o contato pela fonte manual `staging.manual_entries`, porta `formulario`) e `public.crm_list_import_rows` (põe o contato numa lista estática). A rota `/api/lista-de-espera` chama as duas, do servidor, com a chave `service_role` do CRM (`website/src/lib/crm/waitlist.ts`). Nunca escrevemos direto em `core.*`. Não criamos tabela própria neste Supabase: o lead nasce onde o time de vendas já trabalha.
- **Proteções do formulário**: validação de nome, e-mail e WhatsApp opcional (10 ou 11 dígitos), honeypot, limite simples por IP e cache curto por e-mail. A idempotência real fica no CRM, que reconhece a pessoa pelo e-mail no intake e faz upsert na lista.
- **URLs fixas apontam para o domínio novo**: `metadataBase` do layout, `HTTP-Referer` padrão do OpenRouter, user agent do robô do Micélio, README e CLAUDE.md.

## Alternativas consideradas

- **Redirecionar o host antigo para `tru.overlens.io`.** Descartado: levaria quem tinha o link direto à tela de login do app fechado, sem explicação, e divulgaria o domínio novo.
- **Remover o domínio antigo da Vercel.** Descartado pelo mesmo motivo: quem chega por um link antigo encontraria um erro, e perderíamos o contato dessa pessoa.
- **Gravar a lista numa tabela nova deste Supabase.** Descartado depois de confirmar que o CRM tem RPCs de entrada reutilizáveis. Uma tabela aqui criaria uma segunda base de leads a ser sincronizada à mão.
- **Webhook ou formulário externo (Tally etc.).** Descartado: mais uma ferramenta, e o CRM não tem webhook de entrada.

## Consequências

- Quem chega pelo endereço antigo entende o que aconteceu e pode deixar o contato. O app inteiro passa a depender do domínio novo.
- O projeto `overlens-os` passa a ter credencial `service_role` de outro projeto Supabase. Ela só é usada no servidor, só pela rota da lista de espera, e precisa estar nos três ambientes do Infisical.
- Variáveis novas no Infisical: `CRM_SUPABASE_URL`, `CRM_SUPABASE_SERVICE_ROLE_KEY`, `CRM_INTAKE_ACTOR` (e-mail que assina o cadastro; precisa ser dono da lista ou ter escopo de vendas `all`) e `CRM_WAITLIST_LIST_ID` (lista estática criada no CRM; sem ela o lead entra no CRM, mas fora da lista).
- `crm_list_import_rows` não tem uma porta "formulário"; usamos `paste`, então a atividade no CRM aparece como "Subiu por texto colado". Se o CRM ganhar uma porta própria, a rota troca o valor.
- O limite por IP é por instância serverless: protege contra repetição boba, não contra ataque distribuído. Se houver abuso, o próximo passo é o firewall da Vercel.
- O Supabase Auth deste projeto precisa ter `https://tru.overlens.io` como Site URL e `https://tru.overlens.io/**` nos Redirect URLs: o cadastro usa `signUp` sem `emailRedirectTo`, então o link de confirmação de e-mail sai com a Site URL.
- Testar o aviso fora da produção exige simular o host (cabeçalho `Host`/`x-forwarded-host`), porque previews e localhost não passam pelo gate.

## Critérios de sucesso

- Qualquer caminho de `overlens-os.vercel.app` mostra o aviso, e nenhum caminho desse host abre o app ou a tela de login.
- `tru.overlens.io`, previews e localhost funcionam como antes, com login.
- Envios do formulário aparecem no CRM como contatos e na lista da lista de espera, sem duplicar a mesma pessoa.
