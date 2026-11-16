# ADR-0007: A base de conhecimento como fonte oficial e a API de leitura para o Growth System

- **Status**: Aceito
- **Data**: 2026-11-16
- **Decisores**: Ruan Braz

## Contexto

As políticas da operação (Comercial, Responsabilidades Comerciais, Mensagens, Instrutoria) e o Guia Rápido de Escrita nasceram no Google Docs e foram reproduzidos nesta base. O Growth System (repositório `overlens/growth-system`, app em `growth.overlens.io`) passou a ter um Treinamento por área (CS e Vendas) e agentes de IA que precisam dessas regras. Copiar o texto para lá criaria uma terceira versão de cada documento, e a planilha de Tetos de Negociação já mostrou o custo disso: ela contradiz a Política Comercial consolidada em dois pontos.

## Problema

Onde mora a versão oficial de cada documento, e como o Growth System e os agentes leem dela sem copiar?

## Decisão

1. **Esta base é a fonte oficial.** O Google Docs serve para discutir rascunhos; uma regra só vale depois de entrar aqui. Um assunto, um documento dono (tese atual, §10).
2. **Guias de conduta também moram aqui.** A área de Customer Success ganhou a seção `growth_system/05 - Customer Success` (porta de entrada e Encantar Novos Clientes).
3. **Áreas no frontmatter.** Campos novos, todos opcionais:
   - `areas: [vendas, cs, marketing, atendimento]`: em que áreas da operação o documento aparece;
   - `area_home: [cs]`: o documento que abre primeiro na área;
   - `kind: politica | guia | referencia`;
   - `key`, `version`, `updated`, `ack: true`: confirmação de leitura por versão. `key` é estável (não muda quando o arquivo é renomeado ou renumerado); subir `version` quando a regra muda faz todos confirmarem de novo.
4. **API de leitura com token de serviço** (`src/app/api/knowledge/*`), fora da sessão do site:
   - `GET /api/knowledge/index[?area=]`: índice sem texto; com `area`, só os documentos da área e o `home`;
   - `GET /api/knowledge/doc?id=`: um documento com o Markdown completo;
   - `POST /api/knowledge/search {q, area?, limit?, maxChars?}`: até 5 documentos escolhidos pelo mesmo roteador do chat, com as tags `<dado />` expandidas para o prompt.
   O id é o caminho do documento no site sem a barra inicial (`growth/04-operacao-comercial/35-politica-comercial`), o mesmo que os links internos da base já usam.
   Autenticação: `Authorization: Bearer <KNOWLEDGE_API_TOKEN>`, comparação em tempo constante; sem o segredo (ou com menos de 32 caracteres) a API recusa tudo.
5. **Integração por API, nunca por banco.** O Growth System não lê o Supabase desta base nem o repositório; lê a API (princípio 2 do plano TRU).

## Alternativas consideradas

- **Copiar os arquivos para o Growth System no build:** amarra o deploy dos dois repositórios e volta a ter duas cópias.
- **Ler o Supabase ou o GitHub direto:** quebra a soberania de cada produto e espalha credencial de banco.
- **Só um link para o site da base:** resolve a leitura, mas não dá aos agentes o texto nem permite a confirmação de leitura dentro do Treinamento. O link continua existindo ("Abrir no Knowledge").

## Consequências

- O segredo `KNOWLEDGE_API_TOKEN` precisa existir no Infisical dos dois projetos (`overlens-os` e `growth-system`), com o mesmo valor. No Growth System, `KNOWLEDGE_API_URL` aponta para este site.
- Mudar um documento aqui muda o Growth System no próximo deploy desta base, sem deploy de lá.
- `/api/knowledge` entra em `PUBLIC_ROUTES` do `src/proxy.ts`: a rota não usa a sessão do site e exige o token.
- Renomear ou renumerar um arquivo muda o id e quebra links salvos; a confirmação de leitura não quebra porque usa `key`.

## Critérios de sucesso

- A aba Documentação do CS e de Vendas abre na porta de entrada da área e mostra só documentos desta base.
- Nenhuma política existe como texto próprio dentro do Growth System.
- Os agentes do Growth System citam documentos desta base pelo id.
