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

- Bitmask de 13 permissões (`MANAGE_BANDO`, `MANAGE_ROLES`, `MANAGE_CHANNELS`,
  `MANAGE_MESSAGES`, `KICK_MEMBERS`, `BAN_MEMBERS`, `CREATE_INVITE`,
  `MENTION_EVERYONE`, `CONNECT`, `SPEAK`, `STREAM`, `MUTE_MEMBERS`,
  `MOVE_MEMBERS`) — os bits estão documentados também no topo da migration
  `add_roles_permissions_system` (as duas últimas foram adicionadas depois,
  só em código — bitmask é só um número, não precisa migration pra crescer,
  mas **os dois lugares precisam ficar em sincronia se um bit for
  adicionado**).
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
- **Overrides por canal**: botão direito num canal → "Permissões"
  (`ChannelPermissionsModal`). Só expõe as permissões que fazem sentido
  escopadas a um canal (`CHANNEL_PERMISSION_KEYS` em `lib/permissions.ts`) —
  poderes server-wide (banir, gerenciar bando/cargos) ficam de fora, igual no
  Discord. Um override que fica sem nenhum bit é apagado, pro canal voltar a
  herdar limpo do cargo.
- **Não tem cache de permissão calculada** — não é necessário no tamanho atual
  dos bandos (poucos membros), calcular na leitura é barato.

## Chamadas de voz/vídeo (LiveKit)

- `CallProvider` é o contexto global de chamada (mic/deafen/câmera/tela,
  `joinCall(roomId, roomName, href)`), funciona tanto pra canal de voz de
  bando quanto pra chamada de DM (generalizado, não é bando-only).
- Canal de voz mostra o vídeo/grid **acima** do chat de texto, não troca um
  pelo outro (decisão explícita — ver commit "dock voice call above text
  chat").
- Entrar num canal de voz exige clique explícito — nunca auto-conecta ao
  navegar pra página do canal.
- **Moderação de voz (mutar/mover membros)**: `POST /api/livekit/moderate`
  ({action: "mute"|"unmute"|"move", channelId, targetUserId,
  destinationChannelId?}), checado no servidor via `has_channel_permission`
  (`MUTE_MEMBERS`/`MOVE_MEMBERS`). Como o LiveKit não tem um "mover
  participante de sala" nativo, "mover" é só um **sinal**: o servidor marca
  atributos (`movedToChannelId`/`movedToChannelName`) no participante alvo
  via `RoomServiceClient.updateParticipant`, e é o **próprio cliente do
  alvo** que reage a isso (ouvindo `ParticipantEvent.AttributesChanged` no
  seu próprio `localParticipant`, dentro de `CallDeviceSync` em
  `CallProvider.tsx`) chamando `joinCall` pro canal novo. Mesmo mecanismo pro
  mute forçado: `mutePublishedTrack` mais o atributo `forceMuted`.
- **`forceMuted` (mutado por moderador) é diferente de automudo** — o ícone
  de mic mudo é **cinza** quando a própria pessoa se mutou e **vermelho**
  só quando alguém com `MUTE_MEMBERS` mutou ela. Isso é enforcement "soft":
  o servidor muta o track e sinaliza via atributo, o cliente do usuário
  mutado desabilita o próprio botão de mic enquanto `forceMuted` for true,
  mas nada no LiveKit impede tecnicamente esse cliente de tentar
  republicar o áudio por fora da UI — é suficiente pro caso de uso real
  (amigos, não uma plataforma hostil), mas não é um mute a nível de SFU
  inquebrável como o "Server Mute" de verdade do Discord.
- **Bug corrigido: mute de moderador parecia não fazer nada.** No
  `/api/livekit/moderate`, o `mutePublishedTrack` (que muta o track já
  publicado) e o `updateParticipant` (que seta o atributo `forceMuted`,
  usado pra tudo — ícone, e o próprio cliente do alvo desabilitar o mic)
  estavam no mesmo bloco `try`. Se o alvo ainda não tinha publicado um
  track de mic no momento do mute (super comum — LiveKit não publica
  instantaneamente ao entrar), `mutePublishedTrack` lançava, o `catch`
  externo abortava a rota inteira, e o atributo **nunca era setado** — daí
  nem o áudio mudava nem o ícone ficava vermelho. Fix: o
  `mutePublishedTrack` agora tem seu próprio `try/catch` (best-effort), e
  o `updateParticipant` do atributo roda sempre, independente. Também
  faltava o `unmute` chamar `mutePublishedTrack(..., false)` — sem isso
  só o atributo era limpo, o track continuava mutado no servidor.
- **Bug corrigido: o próprio usuário não via seu ícone de mic mudo na
  lista compacta de participantes** (`ChannelSidebar.tsx`). Essa lista
  vem só do poll de 4s de `BandoParticipantsProvider`/
  `/api/livekit/participants`, que depende do LiveKit já ter observado o
  track (des)publicado no servidor — sempre atrasado, às vezes nem
  reflete a tempo. Fix: `VoiceParticipantRow` agora recebe `isSelf`
  (comparando `participant.identity` com o `selfUserId`, passado desde
  `layout.tsx`/`user.id`) e, pra própria linha, usa o estado ao vivo de
  `useCall()` (`micEnabled`/`deafened`/`forceMuted`) em vez do dado do
  poll. Além disso, o menu de moderação agora chama
  `useRefreshBandoParticipants()` depois de um mute/move bem-sucedido,
  pra não depender do próximo tick do poll pra refletir na tela do
  moderador, e checa `res.ok` (antes falhava silenciosamente, sem
  feedback nenhum se a permissão fosse negada ou a chamada LiveKit
  desse erro).
- **Causa raiz real do mute não "pegar" (confirmado via runtime logs da
  Vercel: a rota `/api/livekit/moderate` sempre respondia 200, então os
  dois bugs acima não eram o problema de verdade)**: o `LocalParticipant`
  do `livekit-client` reconcilia sozinho, a cada `ParticipantInfo` que
  recebe do servidor, o estado de mute de cada track publicado contra o
  que ele acha que é o estado local (`LocalParticipant.updateInfo`, ver
  `node_modules/livekit-client`) — se `mutePublishedTrack` muta o track
  no servidor mas a publicação local continua achando que não está
  mutada (porque só reagíamos ao atributo `forceMuted` via
  `setMicEnabled(false)`, que só desabilita o mic num efeito React
  *depois*), o SDK detecta esse "descompasso" e manda `sendMuteTrack`
  de volta pro servidor com o estado local (desmutado) — desfazendo o
  mute forçado quase instantaneamente. Fix: `CallDeviceSync` agora muta a
  publicação do microfone diretamente (
  `localParticipant.getTrackPublication(Track.Source.Microphone)?.mute()`)
  assim que vê `forceMuted: "true"`, em vez de só desabilitar via estado
  React — aí a reconciliação do SDK já concorda com o servidor e não some
  o mute. Lição: qualquer mute/estado imposto pelo servidor num
  participante LiveKit tem que ser refletido na *publicação* local
  também, não só num atributo ou numa flag de UI — senão o SDK "corrige"
  sozinho.
- **Regra final de cor do ícone de mic mudo — CORRIGIDA de novo**: só
  fica vermelho quando `forceMuted` (alguém com `MUTE_MEMBERS` mutou a
  pessoa). Tudo que é escolha da própria pessoa — automudo comum **e**
  ensurdecer (que também automuta o mic) — fica cinza. Uma tentativa
  anterior tratava `deafened` como "estado importante" e pintava de
  vermelho mesmo sendo automudo; usuário corrigiu explicitamente: só
  vermelho quando ALGUÉM (moderador) muta, nunca por ação própria.
  Aplicado em `UserPanel.tsx` (botão de mic E de ensurdecer — o de
  ensurdecer nunca foi vermelho, sempre foi só um toggle "ativo", sem
  conceito de "ensurdecer forçado"), `VoiceChannelView.tsx` (botão de
  mic da call e badge de cada tile) e `ChannelSidebar.tsx`.
- **Quando ensurdecido, os dois ícones aparecem juntos** (mic mudo +
  fone ensurdecido), igual à lista de membros em canal de voz do Discord
  de verdade — antes `VoiceParticipantRow` (`ChannelSidebar.tsx`) e o
  badge do `Tile` (`VoiceChannelView.tsx`) mostravam só UM ícone por vez
  (`deafened ? VolumeX : forceMuted ? MicOff : micMuted && MicOff`,
  mutuamente exclusivo) — agora, quando `deafened`, renderiza `MicOff` +
  `VolumeX` juntos, ambos na cor determinada só por `forceMuted`.
- **Nota**: `forceMuted` é um atributo LiveKit preso à sessão/conexão
  atual do participante — persiste até alguém explicitamente
  "Desmutar membro" (ou o participante desconectar da call). Se um
  ícone ficar vermelho sem explicação aparente, o mais provável é que
  alguém (inclusive a própria pessoa, testando a moderação em si mesma)
  se auto-mutou via o menu de moderação e nunca desfez. Confirmado via
  runtime logs da Vercel numa sessão real: 4 chamadas a
  `/api/livekit/moderate` de teste às 21:33-21:34 e nenhuma depois — o
  ícone continuou vermelho por mais de uma hora simplesmente porque
  ninguém clicou "Desmutar membro" depois daqueles testes, não por bug.
- **Bug real encontrado nessa mesma investigação**: faltava a metade
  "desmutar" do fix da reconciliação do SDK (ver duas notas acima). Ao
  mutar a publicação do mic diretamente (`.mute()`) em reação a
  `forceMuted: "true"`, nada revertia isso quando `forceMuted` voltava
  pra `"false"` — o efeito que sincroniza a publicação com `micEnabled`
  só roda quando `micEnabled` muda, e ele não muda nesse caso (o usuário
  continua "desejando" o mic desligado). Sem reverter, a publicação
  ficava mutada pra sempre e a reconciliação do SDK ia ficar
  "corrigindo" o servidor de volta pra mutado a cada updateInfo, mesmo
  depois de um unmute de moderador legítimo. Fix: `CallDeviceSync` guarda
  o `forceMuted` anterior num ref e, na transição true→false, chama
  `setMicrophoneEnabled(micEnabled)` de novo pra ressincronizar a
  publicação local com o que o usuário realmente quer (o áudio continua
  desligado até ele mesmo reativar — só o travamento do moderador é que
  some).

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
5. **`ON CONFLICT` não funciona com índice único parcial**: os índices de
   unicidade de `channel_permission_overrides` são parciais (`where role_id is
   not null` / `where user_id is not null`, já que as duas colunas são
   nullable). O Postgres não consegue inferir isso num `ON CONFLICT`, então
   `.upsert()` do Supabase falha com "no unique or exclusion constraint
   matching". `setChannelOverride` faz select-depois-update/insert por isso —
   não trocar por upsert.
6. **RLS de INSERT com `.select()`**: `insert(...).select()` no Supabase
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

- Editar perfil (bio + cor do banner), menu de contexto nas DMs 1:1 da
  sidebar, e UI de permissões por canal.
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
