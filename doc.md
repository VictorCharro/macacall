# MacaCall — Documentação do projeto

> **Este arquivo deve ser atualizado sempre que houver uma mudança relevante** (nova
> feature, mudança de schema, decisão de arquitetura, correção de bug não-óbvia).
> É o primeiro lugar pra ler ao abrir uma sessão nova neste projeto — antes de
> explorar o código, leia isto pra entender o que já existe e por quê.

## O que é

Clone do Discord (voz, vídeo, texto, cargos) pra uso pessoal do dono do projeto e
amigos. "Bando" = servidor. "Macaco" = usuário/membro.

## Stack

- **Next.js 16** (App Router, Server Components + Server Actions, Turbopack)
- **Supabase**: Postgres + RLS (toda regra de acesso vive no banco, não só no
  código) + Realtime (chat, presença) + Storage (fotos de bando)
- **LiveKit**: voz, vídeo, compartilhamento de tela
- **Tailwind CSS v4** (tokens de cor via `@theme` em `src/app/globals.css`,
  paleta dark "jungle/amber")
- **lucide-react** pros ícones (não usar emoji solto em UI nova — o app migrou
  de emoji pra ícones de verdade)
- Deploy: Vercel, projeto `macacall`. Supabase project_id: `geuvkhkqektkkihquvii`

## Convenções de trabalho

- **Commitar e pushar direto pra `master`** ao terminar uma tarefa — sem PR, sem
  pedir confirmação, a menos que a mudança seja arriscada/destrutiva. Isso é
  instrução permanente do dono do projeto.
- Antes de commitar: `npm install` (o repo é sempre limpo com `rm -rf
  node_modules .next` no fim), `npx eslint src`, `npx tsc --noEmit -p .`
  (ignorar o erro pré-existente de `LayoutProps`), `npx next build`.
- **Sempre fazer `git fetch origin master` + `git rebase origin/master` antes
  de pushar.** Mais de uma sessão/ferramenta mexe neste repo às vezes — já
  aconteceu de duas sessões reverterem o trabalho uma da outra sem perceber.
  Se aparecer um commit que você não reconhece, investigue antes de presumir
  que é seu.
- Migrações de banco via Supabase MCP (`apply_migration`), nunca à mão.
- Ao adicionar RLS que depende de outra tabela, lembrar que grants
  (`GRANT ... TO authenticated`) são uma camada **separada** de RLS — os dois
  precisam existir. Fonte recorrente de bugs neste projeto.

## Estrutura de rotas

```
/                              landing
/login, /signup                auth por email
/join/[code]                   preview de convite + guest sign-in (signInAnonymously)
/bandos                        home "Amigos" (DMs, pedidos de amizade, presença)
/bandos/[id]                   redireciona pro primeiro canal
/bandos/[id]/[channelId]       canal de texto ou de voz (call docked + chat embaixo)
/bandos/dm/[conversationId]    DM 1:1 ou em grupo
```

`src/app/bandos/layout.tsx` monta o "app shell" (rail de servidores + o resto).
**Importante:** essa raiz usa `fixed inset-0` (não `h-screen flex-1`) — ver
seção "Bugs resolvidos" abaixo antes de mexer nisso.

`src/app/bandos/[id]/layout.tsx` monta sidebar de canais + sidebar de membros +
busca cargos/permissões do usuário atual pra esse bando.

## Autenticação

- Email/senha normal, **ou** convidado (`guestSignIn` em `actions/auth.ts` →
  `supabase.auth.signInAnonymously()`, sem precisar de email).
- Convite de bando: `/join/[code]` → se já logado, entra direto
  (`joinBandoNoRevalidate`, que existe separado de `joinBandoByCode` porque
  `revalidatePath` não pode ser chamado durante o render de uma Server
  Component, só dentro de uma Server Action de verdade).

## Sistema de cargos e permissões (feature grande, adicionada recentemente)

Ver `src/lib/permissions.ts` pro bitmask e `src/app/actions/roles.ts` pras
ações. Resumo:

- Bitmask de 11 permissões (`MANAGE_BANDO`, `MANAGE_ROLES`, `MANAGE_CHANNELS`,
  `MANAGE_MESSAGES`, `KICK_MEMBERS`, `BAN_MEMBERS`, `CREATE_INVITE`,
  `MENTION_EVERYONE`, `CONNECT`, `SPEAK`, `STREAM`) — os bits estão
  documentados também no topo da migration `add_roles_permissions_system`,
  **os dois lugares precisam ficar em sincronia se um bit for adicionado**.
- Cada cargo tem `permissions_allow` + `permissions_deny` (bigint). **Deny
  sempre vence** sobre allow de outro cargo — é a regra real do Discord.
- `@everyone` é criado automaticamente (trigger `bandos_create_default_role`)
  pra todo bando novo, `position = 0`, não pode ser deletado nem reposicionado
  (mas as permissões dele podem ser editadas).
- Dono do bando faz bypass total em tudo (calculado em `bando_permissions()` /
  `channel_permissions()` no Postgres) — **inclusive nas checagens de
  hierarquia**, senão um dono sem cargo custom (posição 0) ficaria bloqueado
  de mexer em membros que também estão na posição 0.
- Funções Postgres relevantes: `bando_permissions`, `channel_permissions`,
  `has_bando_permission`, `has_channel_permission`, `highest_role_position`.
  **No client, só chamar as versões `has_*` (retornam boolean)** — as que
  retornam o bitmask cru não são seguras de transportar como número JS pro
  caso do dono (o valor de bypass excede `Number.MAX_SAFE_INTEGER`).
- UI: "Gerenciar cargos" no menu do nome do bando (`RoleManagementModal`) e
  atribuição de cargo + kick/ban no popup de perfil de membro
  (`MembersSidebar`). Cor do cargo mais alto do usuário aparece no nome, no
  chat e na lista de membros (`BandoRolesProvider`).
- **Não implementado ainda:** tela pra editar overrides por canal (a tabela
  `channel_permission_overrides` e as actions `setChannelOverride` /
  `removeChannelOverride` já existem, só falta a UI chamando isso). Também não
  tem cache de permissão calculada — não é necessário no tamanho atual dos
  bandos (poucos membros), calcular na leitura é barato.

## Chamadas de voz/vídeo (LiveKit)

- `CallProvider` é o contexto global de chamada (mic/deafen/câmera/tela,
  `joinCall(roomId, roomName, href)`), funciona tanto pra canal de voz de
  bando quanto pra chamada de DM (generalizado, não é bando-only).
- Canal de voz mostra o vídeo/grid **acima** do chat de texto, não troca um
  pelo outro (decisão explícita — ver commit "dock voice call above text
  chat").
- Entrar num canal de voz exige clique explícito — nunca auto-conecta ao
  navegar pra página do canal.

## Realtime

- Chat, reações, presença: tudo via Supabase Realtime.
- **Sempre usar `createRealtimeClient()`** (`lib/supabase/realtimeClient.ts`)
  em vez do client normal antes de `.channel().subscribe()` — ele espera
  `supabase.realtime.setAuth()` primeiro. Sem isso, a RLS do socket realtime
  não pega o JWT certo e a subscription falha silenciosamente (bug que já
  apareceu mais de uma vez neste projeto).

## Bugs estruturais já resolvidos (não reintroduzir)

1. **Flexbox `min-height: auto` trap**: qualquer container com `flex-1` que
   também precisa de `overflow-y-auto` no filho **precisa de `min-h-0`**,
   senão ele cresce pro tamanho do conteúdo em vez de encolher pro espaço
   disponível. Afeta toda cadeia de painéis com scroll (chat, lista de
   canais, lista de membros, etc.).
2. **`body` sem altura definida**: `body` só tem `min-h-full` (proposital,
   pras páginas de auth poderem rolar normalmente). Por isso o app shell de
   `/bandos` usa `fixed inset-0` em vez de `h-screen flex-1` — com `flex-1`
   dentro de um `body` de altura indefinida, o navegador ignora o
   `height:100vh` e calcula pelo conteúdo, fazendo a página inteira rolar em
   vez do painel certo.
3. **`overflow-y` implícito força `overflow-x`**: dar `overflow-y-auto` a um
   elemento sem especificar `overflow-x` faz o navegador tratar o eixo X como
   `auto` também — qualquer filho `position: absolute` que estoure a largura
   (tooltip, menu de contexto) vira scroll horizontal indesejado. Corrigido
   com `overflow-x-hidden` explícito + tooltips/menus via portal
   (`ContextMenuPortal`) em vez de `absolute` dentro do container que rola.
4. **Scroll chaining**: mesmo com o container certo, sem
   `overscroll-behavior` o scroll "vaza" pro elemento pai ao bater no topo/fim
   da lista. Toda área com scroll próprio usa `overscroll-y-contain` (classe
   `scroll-hover` em `globals.css` já inclui isso junto com a scrollbar fina
   estilo Discord que só aparece no hover).
5. **RLS de INSERT com `.select()`**: `insert(...).select()` no Supabase
   exige passar pela policy de SELECT também (por causa do `RETURNING`). Se a
   policy de SELECT só libera quem já é participante de algo que está sendo
   criado na mesma query, o próprio criador não consegue ver a linha que
   acabou de criar. (Aconteceu com `dm_conversations`.)

## Onde encontrar cada coisa

| Área | Arquivo(s) principais |
|---|---|
| Auth (login/signup/guest) | `app/actions/auth.ts` |
| Bandos (criar/entrar/editar) | `app/actions/bandos.ts` |
| Canais | `app/actions/channels.ts`, `components/ChannelSidebar.tsx` |
| Mensagens + reações | `app/actions/messages.ts`, `app/actions/reactions.ts`, `components/ChatChannel.tsx` |
| Cargos/permissões | `lib/permissions.ts`, `app/actions/roles.ts`, `components/RoleManagementModal.tsx` |
| Amigos/DMs | `app/actions/friends.ts`, `app/actions/dms.ts`, `components/FriendsHome.tsx`, `components/DmChat.tsx` |
| Presença (online/ausente/etc) | `components/PresenceProvider.tsx`, `lib/presence.ts` |
| Chamadas | `components/CallProvider.tsx`, `components/VoiceChannelView.tsx`, `api/livekit/*` |
| Perfil do usuário (popout) | `components/ProfilePopout.tsx` |

## Histórico resumido (mais recente primeiro)

- Sistema de cargos e permissões estilo Discord (hierarquia, overrides por
  canal no backend, cor por cargo).
- Correção estrutural de scroll (a página inteira rolava em vez do painel;
  causa raiz era `body` sem altura definida + scroll chaining).
- Reskin visual pra paleta dark "jungle/amber" + ícones lucide-react
  (substituindo o tema claro/creme original com emoji).
- Popout de perfil (avatar, banner, balão de status estilo "pensamento",
  status de presença).
- Menu de contexto (botão direito) em amigos: DM, chamada, convidar pra
  bando, desfazer amizade, bloquear.
- Reconstrução da UI de call (grid de participantes, chat, telas) +
  categorias/tópicos de canal + reações + badge de não lida.
- Home "Amigos" completa: pedidos de amizade, DMs (incl. grupo), presença
  real via Supabase Realtime Presence.

---

_Atualize este arquivo como parte de qualquer tarefa que mude arquitetura,
schema, ou padrões do projeto — não deixe pra depois._
