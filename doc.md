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
- **App desktop (Windows)**: pasta `desktop/` — shell Electron fino em cima
  do site já deployado (não roda o Next.js local). Ver seção própria
  abaixo.

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

## Performance de navegação

- `src/app/bandos/[id]/loading.tsx` — esqueleto instantâneo enquanto o
  layout do bando (6+ queries) e a página do canal (mais 3-4) ainda estão
  buscando dados. Sem isso, trocar de servidor deixava a tela travada/em
  branco até tudo resolver. Convenção nativa do Next — qualquer navegação
  pra dentro dessa rota já usa esse arquivo automaticamente, não precisa
  de Suspense manual em nenhum componente.
- **`getCachedUser()`** (`lib/supabase/server.ts`) — `supabase.auth.getUser()`
  faz um round-trip real pro servidor de auth do Supabase pra revalidar a
  sessão (não é só decodificar o cookie), então chamar duas vezes na mesma
  navegação (uma no layout, outra na página do canal) pagava esse custo
  duas vezes. Envolvido em `cache()` do React, que deduplica automaticamente
  chamadas com os mesmos argumentos dentro do mesmo request/render — layout
  e página continuam cada um chamando `getCachedUser()` normalmente, só que
  a segunda chamada não gera uma nova requisição de rede. **Usar
  `getCachedUser()` em vez de `createClient().auth.getUser()` em qualquer
  Server Component/Server Action nova que precise do usuário atual.**
- Nos dois lugares (`bandos/[id]/layout.tsx` e
  `bandos/[id]/[channelId]/page.tsx`) as queries que não dependem umas das
  outras foram agrupadas em `Promise.all` em vez de rodarem em série —
  a página do canal, por exemplo, buscava canal → bando → membros um atrás
  do outro sem motivo, sendo que nenhum dos três depende do resultado dos
  outros.
- **Mesmo tratamento no lado "Amigos/DMs"** (rota irmã de `[id]`, não
  coberta pelo `loading.tsx` dele): `bandos/layout.tsx` (rail de
  servidores, layout raiz de tudo dentro de `/bandos`),
  `bandos/page.tsx` (home "Amigos") e `bandos/dm/[conversationId]/page.tsx`
  (uma conversa) ganharam `getCachedUser()` + `Promise.all` nas queries
  independentes, e dois `loading.tsx` novos (`bandos/loading.tsx` pra home
  de Amigos, `bandos/dm/[conversationId]/loading.tsx` pra uma DM aberta).
  `bandos/dm/[conversationId]/page.tsx` era o pior caso: 8 queries **todas
  em série**, nenhuma dependendo da anterior (só de `user.id`/
  `conversationId`, ambos já conhecidos de cara) — só `reactions`
  (depende de `messageIds`, que só existe depois de `messages` voltar) e
  `dmEntries` (depende de `dmRows`) realmente precisam esperar algo.

## Avatares (foto de perfil real vs. gerado)

- Todo avatar no app cai num de dois casos: **gerado** (Dicebear "thumbs",
  seed = `profiles.avatar_seed`, um UUID/id estável desde o cadastro) ou
  **foto de verdade** (`profiles.avatar_url`, upload via "Editar perfil").
  A regra de qual mostrar está centralizada em **`src/lib/avatar.ts`**
  (`avatarUrl(seed, url)` — usa `url` se existir, senão monta a URL do
  Dicebear a partir de `seed`) e é a **única** função que monta URL de
  avatar no app inteiro — nenhum componente deve montar a URL do Dicebear
  na mão de novo.
- Upload: botão "Editar perfil" no popout do próprio usuário
  (`UserPanel` → `ProfilePopout` → `EditProfileModal`). Ações em
  `app/actions/profile.ts`: `uploadAvatar` (valida imagem/5MB, sobe pro
  bucket `avatars` no Storage em `{userId}/avatar-{timestamp}.{ext}`,
  atualiza `profiles.avatar_url`) e `removeAvatar` (limpa a coluna, volta
  a cair no gerado). Mesmo padrão de upload que `updateBandoPhoto`
  (`app/actions/bandos.ts`) — arquivo escondido + clique programático,
  ver `BandoMenu.tsx` pro precedente.
- **`avatar_url` precisa ser selecionado em toda query que já busca
  `avatar_seed`**, e passado como prop irmã em todo componente que recebe
  `avatarSeed` — são ~20 arquivos entre `app/` e `components/` (self no
  layout de bando/Amigos/DM, `MembersSidebar`, `ChatChannel`/`DmChat` e
  tudo que herda o mapa de `members` deles — `ThreadPanel`,
  `PinnedMessagesModal`, `DmPinnedMessagesModal` —, `FriendRow`/
  `ActiveNowPanel`/`FriendsSidebar`, `DmProfilePanel`,
  `AddDmParticipantModal`, `ServerSettingsModal` (banidos),
  `getUserProfile` em `actions/profiles.ts` que serve o `UserProfileModal`
  genérico "clicar num nome/avatar em qualquer lugar"). Esquecer um
  desses de novo é o jeito mais fácil de reintroduzir esse bug — se
  alguém trocar a foto e ela não aparecer em algum lugar específico, é
  quase sempre uma query faltando `avatar_url` no select.
- Bucket `avatars` no Supabase Storage: público pra leitura, mas
  INSERT/UPDATE/DELETE só no próprio path (`(storage.foldername(name))[1]
  = auth.uid()::text`) — mesmo padrão de `bando-photos`, só que por
  usuário em vez de por dono de bando.
- **Dois lugares ficaram de fora da primeira leva de propagação porque
  não vêm de uma query Supabase direta com `avatar_seed`, e sim de
  participantes LiveKit** (identificados só por `identity` = user id) —
  apareciam como o emoji 🐵 fixo em vez de avatar:
  - **Lista compacta de voz** (`ChannelSidebar.tsx`, `VoiceParticipantRow`):
    `/api/livekit/participants` agora também busca `avatar_seed`/
    `avatar_url` em `profiles` pra todo `identity` presente na sala (um
    `select .in("id", identities)` batelado, não por participante) e
    devolve junto no JSON — `BandoParticipant` ganhou os dois campos.
  - **Tile da call** (`VoiceChannelView.tsx`, componente `Tile`, usado
    tanto em canal de bando quanto em DM): não dá pra reusar o mesmo
    truque porque esse componente não sabe se está num bando ou numa DM
    (não tem uma query de `bando_members` central pra apoiar) — busca o
    avatar direto com `getUserProfile(participant.identity)` (a mesma
    action do popup de perfil clicável) num `useEffect` só quando o
    trackRef não existe (foto substitui o placeholder de câmera
    desligada).

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

- Bitmask de 14 permissões (`MANAGE_BANDO`, `MANAGE_ROLES`, `MANAGE_CHANNELS`,
  `MANAGE_MESSAGES`, `KICK_MEMBERS`, `BAN_MEMBERS`, `CREATE_INVITE`,
  `MENTION_EVERYONE`, `CONNECT`, `SPEAK`, `STREAM`, `MUTE_MEMBERS`,
  `MOVE_MEMBERS`, `DEAFEN_MEMBERS`) — os bits estão documentados também no
  topo da migration `add_roles_permissions_system` (as três últimas foram
  adicionadas depois, só em código — bitmask é só um número, não precisa
  migration pra crescer, mas **os dois lugares precisam ficar em
  sincronia se um bit for adicionado**).
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
- **Clicar num canal de voz na sidebar já conecta** (clique simples), igual
  ao Discord — o `onClick` do `Link` chama `joinCall` junto com a navegação.
  Isso *substitui* a convenção antiga ("nunca auto-conecta ao navegar"): o
  que continua valendo é que **carregar a página do canal não conecta
  sozinho** — num refresh ou link direto aparece uma barra compacta com
  "Entrar na call", também como no Discord (que te desconecta da voz no
  reload em vez de reabrir seu microfone sem você pedir).
- `joinCall` é **no-op se você já está naquela sala**. Um objeto `activeCall`
  novo refaz o fetch do token e remonta o `LiveKitRoom`, o que derrubaria e
  reconectaria a call — clicar no canal em que você já está só traz a view
  de volta.
- **Bug já corrigido (não reintroduzir)**: a sidebar chamava
  `joinCall(bandoId, channel.id, channel.name)` contra a assinatura
  `joinCall(roomId, roomName, href)`, então conectava numa sala com o id do
  *bando*. Como `roomId` e `href` ficavam errados, duas checagens
  silenciosamente nunca batiam: `activeCall?.roomId === channelId`
  (`VoiceChannelView` mostrava "Pronto pra entrar" mesmo conectado) e
  `pathname === activeCall.href` (`VoiceConnectedBar` aparecia na própria
  página da call). Se algum desses sintomas voltar, conferir os argumentos
  de `joinCall` primeiro.
- Trocar pra um canal de **texto** enquanto está em call mantém a conexão:
  `CallProvider` mora em `app/bandos/layout.tsx`, acima do `children`, então
  o `LiveKitRoom` não desmonta ao navegar dentro de `/bandos`. A
  `VoiceConnectedBar` (sidebar) aparece justamente quando
  `connected && pathname !== activeCall.href`.
- A barra de controles da call (`VoiceChannelView.tsx`, `CallInterface`)
  tem mic, ensurdecer (`toggleDeafen`/`deafened`/`forceDeafened` de
  `useCall()`), câmera, compartilhar tela e desconectar — o botão de
  ensurdecer ficava só no `UserPanel` (sidebar) antes, sem equivalente
  dentro da própria tela de call.
- **Mover membro também dá pra fazer arrastando** (drag-and-drop), além do
  "Mover para..." no menu de contexto — `ChannelSidebar.tsx`. A linha do
  participante (`VoiceParticipantRow`) fica `draggable` quando o usuário
  tem `MOVE_MEMBERS`, e no `dragStart` guarda `{identity,
  sourceChannelId}` num MIME próprio (`MEMBER_DRAG_MIME =
  "application/x-macacall-move-member"`, namespaced de propósito pra não
  bater com outro tipo de drag do navegador). Todo `ChannelRow` de canal
  de voz vira um alvo de drop (`onDragOver`/`onDrop`), com destaque verde
  (`ring-2 ring-secondary`) enquanto arrasta por cima — igual ao
  destaque de canal "ativo"/"ao vivo", só que mais forte pra ficar óbvio
  que é um alvo de drop. Chama o mesmo endpoint que o "Mover para..." do
  menu de contexto (`moveParticipant` em `ChannelSidebar.tsx`, POST
  action="move" em `/api/livekit/moderate`) — são dois caminhos de UI
  pro mesmo mecanismo de sinal via atributo, não duas implementações.
- **Mover demorava a refletir no sidebar** (até uns 4s às vezes) —
  `refreshParticipants()` era chamado uma vez só, logo depois do POST de
  `/api/livekit/moderate` responder. Mas "mover" é só um sinal: a pessoa
  movida ainda precisa buscar um token novo e reconectar no LiveKit da
  sala nova antes do servidor refletir ela lá — isso demora mais que a
  resposta do POST, então esse primeiro refresh quase sempre pegava
  dado velho, e só o próximo tick agendado do poll (até 4s depois)
  mostrava o estado certo. Fix: `moveParticipant` em `ChannelSidebar.tsx`
  agora dispara `refreshParticipants()` mais duas vezes (800ms e 2000ms
  depois), pra pegar a janela em que a reconexão termina sem esperar o
  poll de 4s.
- **Moderação de voz (mutar/ensurdecer/mover membros)**:
  `POST /api/livekit/moderate` ({action: "mute"|"unmute"|"deafen"|
  "undeafen"|"move", channelId, targetUserId, destinationChannelId?}),
  checado no servidor via `has_channel_permission`
  (`MUTE_MEMBERS`/`DEAFEN_MEMBERS`/`MOVE_MEMBERS`, um bit por ação). Como o
  LiveKit não tem um "mover participante de sala" nativo, "mover" é só um
  **sinal**: o servidor marca atributos (`movedToChannelId`/
  `movedToChannelName`) no participante alvo via
  `RoomServiceClient.updateParticipant`, e é o **próprio cliente do alvo**
  que reage a isso (ouvindo `ParticipantEvent.AttributesChanged` no seu
  próprio `localParticipant`, dentro de `CallDeviceSync` em
  `CallProvider.tsx`) chamando `joinCall` pro canal novo. Mesmo mecanismo
  pro mute forçado: `mutePublishedTrack` mais o atributo `forceMuted`.
  "Ensurdecer" é o mesmo padrão de sinal via atributo (`forceDeafened`),
  já que forçar alguém a não ouvir só pode ser feito no cliente dela
  (setar volume 0 dos remotos é local). **Diferente do Discord de
  verdade**: aqui `mute` e `deafen` são totalmente independentes —
  ensurdecer NÃO muta o mic da pessoa junto (uma tentativa anterior fazia
  isso, copiando o comportamento real do Discord, mas foi revertida a
  pedido: aqui só `forceMuted` mexe no mic, `forceDeafened` só mexe no que
  a pessoa ouve). `toggleDeafen` (auto-ensurdecer) é bloqueado enquanto
  `forceDeafened` for true, mesma lógica de `toggleMic` travado por
  `forceMuted`.
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
  `HeadphoneOff` juntos, ambos na cor determinada só por `forceMuted`.
  O ícone de ensurdecido também trocou de `VolumeX` (alto-falante com X)
  pra `HeadphoneOff` (fone com um traço cruzando), pra ficar visualmente
  consistente com o `MicOff` do microfone em vez de duas linguagens
  visuais diferentes pro mesmo tipo de estado "mudo".
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

## App desktop (Electron, Windows)

Pasta `desktop/` — repositório separado em termos de dependências
(`desktop/package.json` próprio, `npm install` ali dentro, não na raiz),
mas versionado no mesmo repo Git. **Não roda o Next.js localmente**: é só
uma janela do Electron apontando pra `https://macacall.vercel.app` (igual
o cliente desktop de verdade do Discord) — então mudar o site (`src/`) não
exige rebuildar o desktop, só muda quando `desktop/` em si muda (janela,
tray, ícone, auto-update). Detalhes completos em `desktop/README.md`
(como rodar local, gerar o instalador, processo de release).

- **Arquivos**: `main.js` (processo principal — janela, tray, single
  instance lock, minimizar-pra-tray), `preload.js` (vazio de propósito —
  o site não precisa de nenhuma API Electron-específica,
  `contextIsolation`/`nodeIntegration` ficam travados), `icon.ico`
  (cópia de `src/app/favicon.ico` — trocar os dois juntos se o ícone
  mudar).
- **Auto-update via GitHub Releases** (`electron-updater`,
  `setupAutoUpdater()` em `main.js`): checa ao abrir, baixa em segundo
  plano, pergunta se quer reiniciar. **Só funciona se toda release tiver
  os dois arquivos** que `npm run dist` gera em `desktop/dist/`: o
  instalador (`MacaCall-Setup-<versão>.exe`) e `latest.yml` (sem esse
  arquivo o `electron-updater` nunca enxerga a release nova).
- **Diálogo de update não é o `dialog.showMessageBox` nativo do
  Windows** — trocado por uma janela própria (`dialog.html` +
  `dialog-preload.js`) estilizada igual ao app, porque o nativo parecia
  uma caixa de erro do sistema, nada a ver com o resto. E "reiniciar
  agora" não deve reabrir o instalador completo (o assistente do NSIS) —
  só reiniciar direto na versão já baixada.
- **Compartilhar tela precisa de dois ajustes, não só um** — os dois já
  foram feitos, mas é fácil esquecer o segundo achando que só o primeiro
  resolve:
  1. Electron não mostra o seletor de tela/janela sozinho pra
     `getDisplayMedia()` como um Chrome normal mostra — precisa de
     `setDisplayMediaRequestHandler` própria.
  2. Mesmo com isso, `setPermissionRequestHandler` só liberando
     `"notifications"` e `"media"` **bloqueia silenciosamente** a
     permissão `"display-capture"` que o Chromium checa antes de sequer
     chamar o handler acima — falha muda, sem erro nenhum visível. As
     duas causas juntas faziam parecer que "compartilhar tela não faz
     nada" mesmo depois do primeiro fix.
- **Barra de título** (o site não tem uma própria — é um `<header>` de
  página web normal): o Electron injeta `-webkit-app-region: drag` no
  `<header>` de cada tela via `insertCSS` (não mexe no código-fonte do
  site, só em runtime — usuário de navegador normal não é afetado),
  marcando elementos interativos como `no-drag` pra continuarem
  clicáveis. Os botões nativos de minimizar/maximizar/fechar (overlay do
  Windows) ganham uma **faixa reservada de verdade** no topo da janela
  (empurra o app pra baixo por essa altura), em vez de desenhar por cima
  do conteúdo em y=0 — a primeira tentativa deixava os botões nativos
  sobrepostos na lista de membros.

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
7. **Coluna homônima "engole" a correlação num subquery de policy**: numa
   `with check`/`using` que faz subquery contra outra tabela, uma coluna
   sem prefixo (ex. `name`) resolve pro escopo mais interno primeiro. Se a
   tabela de fora (`storage.objects`) e a de dentro (`channels`) têm as
   duas uma coluna `name`, `storage.foldername(name)` dentro do subquery
   silenciosamente vira `channels.name`, não `objects.name` -- sem erro
   nenhum, só nunca dá match (`is_bando_member(null)` = false, insert
   negado). Sempre qualificar a coluna da tabela de fora explicitamente
   (`objects.name`) dentro de qualquer subquery correlacionado numa
   policy. Aconteceu na policy de upload de `message_attachments`.

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
| Avatares (gerado vs. foto real) | `lib/avatar.ts`, `app/actions/profile.ts`, `components/EditProfileModal.tsx` |
| App desktop (Windows/Electron) | `desktop/main.js`, `desktop/README.md` |

## Roadmap "Discord 2" (issues no GitHub, uma por feature grande)

Pedido do dono do projeto: reescrever a experiência pra ficar o mais fiel
possível ao Discord de verdade, cobrindo tudo que falta. Trackeado como
issues em `VictorCharro/macacall` pra não perder o fio -- confira o estado
lá (`gh issue list`) antes de assumir que algo falta ou já foi feito.

- ✅ #1 Cargos/permissões estilo Discord -- já existia antes deste roadmap
  (ver seção acima).
- ✅ #2 Edição e exclusão de mensagens -- autor edita/apaga a própria;
  quem tem `MANAGE_MESSAGES` no canal também apaga de terceiros (DM não
  tem esse conceito, só o autor). `edited_at` em `messages`/`dm_messages`,
  RLS de UPDATE/DELETE, realtime DELETE, form inline reaproveitado
  (`EditMessageForm`, exportado de `ChatChannel.tsx`) entre canal e DM.
- ✅ #3 Menções (@usuário, @cargo e @everyone) em canais e DMs.
- ✅ #4 Upload de arquivo/imagem (Supabase Storage) + emoji picker em
  canais e DMs.
- ✅ #5 Notificações push do navegador + badge de DM não lida.
- ✅ #6 Threads em canais de texto.
- ✅ #7 Modal de configurações de servidor -- lista de banidos + log de
  auditoria (kick/ban em si já existiam via moderação de cargos).
- ✅ #8 Configurações de voz/vídeo: troca de dispositivo (mic/câmera/
  saída), teste de nível de mic (mute/deafen/move de terceiros já
  existiam via `/api/livekit/moderate`).
- ⬜ #9 Responsividade mobile completa (layout hoje assume desktop).
- ✅ App desktop Windows (Electron) -- não era uma issue do roadmap
  "Discord 2", mas é a mesma ideia de fidelidade ao Discord de verdade
  (cliente nativo em vez de só navegador). Ver seção "App desktop"
  acima.

## Histórico resumido (mais recente primeiro)

- Upload de foto de perfil real (avatar deixa de ser só o gerado do
  Dicebear) via "Editar perfil", propagado pelo app inteiro.
- Performance de navegação (`loading.tsx` + queries paralelizadas em
  todas as rotas de bando e de Amigos/DMs, dedupe de `getUser()`).
- Moderação de voz completa (mutar/ensurdecer/mover membros) + ícones de
  mic/fone mudo corrigidos (self vs. forçado por moderador).
- App desktop Windows via Electron (`desktop/`): wrapper nativo em cima
  do site deployado, auto-update via GitHub Releases, tray, barra de
  título customizada, compartilhamento de tela.
- Configurações de voz/vídeo (troca de dispositivo, teste de mic),
  paleta visual trocada pra cores reais do Discord + fonte Inter.
- Threads em canais de texto, notificações push do navegador, menções
  (@usuário/@cargo/@everyone), upload de arquivo/imagem + emoji picker,
  modal de configurações de servidor (banidos + log de auditoria).
- Edição e exclusão de mensagens (canais + DMs), roadmap "Discord 2" nas
  issues do GitHub.
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
