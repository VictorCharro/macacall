// Discord-style permission bitmask. Mirrors the bit values documented at the
// top of the `add_roles_permissions_system` migration — keep both in sync.
export const PERMISSIONS = {
  MANAGE_BANDO: 1 << 0,
  MANAGE_ROLES: 1 << 1,
  MANAGE_CHANNELS: 1 << 2,
  MANAGE_MESSAGES: 1 << 3,
  KICK_MEMBERS: 1 << 4,
  BAN_MEMBERS: 1 << 5,
  CREATE_INVITE: 1 << 6,
  MENTION_EVERYONE: 1 << 7,
  CONNECT: 1 << 8,
  SPEAK: 1 << 9,
  STREAM: 1 << 10,
  MUTE_MEMBERS: 1 << 11,
  MOVE_MEMBERS: 1 << 12,
  DEAFEN_MEMBERS: 1 << 13,
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export const PERMISSION_LABELS: Record<PermissionKey, { label: string; description: string }> = {
  MANAGE_BANDO: {
    label: "Gerenciar bando",
    description: "Renomear o bando, trocar a foto e outras configurações gerais.",
  },
  MANAGE_ROLES: {
    label: "Gerenciar cargos",
    description: "Criar, editar, excluir e atribuir cargos abaixo do seu.",
  },
  MANAGE_CHANNELS: {
    label: "Gerenciar canais",
    description: "Criar, editar e excluir canais de texto e voz.",
  },
  MANAGE_MESSAGES: {
    label: "Gerenciar mensagens",
    description: "Fixar e apagar mensagens de outras pessoas.",
  },
  KICK_MEMBERS: {
    label: "Expulsar membros",
    description: "Remover membros do bando (eles podem entrar de novo com um convite).",
  },
  BAN_MEMBERS: {
    label: "Banir membros",
    description: "Remover membros e impedir que voltem a entrar.",
  },
  CREATE_INVITE: {
    label: "Criar convite",
    description: "Ver e compartilhar o link de convite do bando.",
  },
  MENTION_EVERYONE: {
    label: "Mencionar @everyone",
    description: "Notificar todo mundo do bando numa mensagem.",
  },
  CONNECT: {
    label: "Conectar",
    description: "Entrar em canais de voz.",
  },
  SPEAK: {
    label: "Falar",
    description: "Usar o microfone em canais de voz.",
  },
  STREAM: {
    label: "Compartilhar tela",
    description: "Compartilhar tela ou câmera em canais de voz.",
  },
  MUTE_MEMBERS: {
    label: "Silenciar membros",
    description: "Permite mutar o microfone de outros membros em canais de voz.",
  },
  MOVE_MEMBERS: {
    label: "Mover membros",
    description: "Permite mover membros entre canais de voz aos quais têm acesso.",
  },
  DEAFEN_MEMBERS: {
    label: "Ensurdecer membros",
    description: "Permite impedir que outros membros ouçam o canal de voz.",
  },
};

export const ALL_PERMISSION_KEYS = Object.keys(PERMISSIONS) as PermissionKey[];

/**
 * Permissions that can be overridden per channel. Server-wide powers
 * (managing the bando, roles, kicking, banning) deliberately aren't here —
 * they have no meaning scoped to a single channel, same as in Discord.
 */
export const CHANNEL_PERMISSION_KEYS: PermissionKey[] = [
  "MANAGE_CHANNELS",
  "MANAGE_MESSAGES",
  "CREATE_INVITE",
  "MENTION_EVERYONE",
  "CONNECT",
  "SPEAK",
  "STREAM",
  "MUTE_MEMBERS",
  "MOVE_MEMBERS",
  "DEAFEN_MEMBERS",
];

type MaskInput = number | bigint | string;

export function hasPermission(mask: MaskInput, key: PermissionKey): boolean {
  return (BigInt(mask) & BigInt(PERMISSIONS[key])) !== BigInt(0);
}

export function combinePermissions(
  baseAllow: MaskInput,
  baseDeny: MaskInput,
): bigint {
  return BigInt(baseAllow) & ~BigInt(baseDeny);
}

/** allow/deny/inherit as shown per-permission in the role editor UI. */
export type PermissionState = "allow" | "deny" | "inherit";

export function stateForKey(
  allowMask: MaskInput,
  denyMask: MaskInput,
  key: PermissionKey,
): PermissionState {
  const bit = BigInt(PERMISSIONS[key]);
  if ((BigInt(denyMask) & bit) !== BigInt(0)) return "deny";
  if ((BigInt(allowMask) & bit) !== BigInt(0)) return "allow";
  return "inherit";
}

export function setState(
  allowMask: bigint,
  denyMask: bigint,
  key: PermissionKey,
  state: PermissionState,
): { allow: bigint; deny: bigint } {
  const bit = BigInt(PERMISSIONS[key]);
  let allow = allowMask & ~bit;
  let deny = denyMask & ~bit;
  if (state === "allow") allow |= bit;
  if (state === "deny") deny |= bit;
  return { allow, deny };
}
