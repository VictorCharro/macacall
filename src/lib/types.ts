export type PresenceStatus = "online" | "idle" | "dnd" | "invisible";

export type Profile = {
  id: string;
  username: string;
  avatar_seed: string;
  status: PresenceStatus;
  status_message: string | null;
  bio: string | null;
  banner_color: string | null;
  created_at: string;
};

export type Bando = {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  photo_url: string | null;
  created_at: string;
};

export type Channel = {
  id: string;
  bando_id: string;
  name: string;
  type: "voice" | "text";
  category: string | null;
  topic: string | null;
  position: number;
  created_at: string;
};

export type BandoMember = {
  bando_id: string;
  user_id: string;
  role: string;
  joined_at: string;
};

export type Role = {
  id: string;
  bando_id: string;
  name: string;
  color: string;
  icon: string | null;
  position: number;
  hoist: boolean;
  is_default: boolean;
  permissions_allow: string;
  permissions_deny: string;
  created_at: string;
};

export type MemberRole = {
  bando_id: string;
  user_id: string;
  role_id: string;
  assigned_at: string;
};

export type ChannelPermissionOverride = {
  id: string;
  channel_id: string;
  role_id: string | null;
  user_id: string | null;
  allow: string;
  deny: string;
  created_at: string;
};

export type BannedUser = {
  bando_id: string;
  user_id: string;
  banned_by: string;
  reason: string | null;
  banned_at: string;
};

export type Message = {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
  reply_to_id: string | null;
  pinned: boolean;
};

export type MessageReaction = {
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

/** Reactions for one message, already rolled up for rendering. */
export type ReactionSummary = {
  emoji: string;
  count: number;
  reacted: boolean;
};

export type ChannelRead = {
  user_id: string;
  channel_id: string;
  last_read_at: string;
};

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
  created_at: string;
  responded_at: string | null;
};

export type DmConversation = {
  id: string;
  name: string | null;
  is_group: boolean;
  created_by: string;
  created_at: string;
};

export type DmParticipant = {
  conversation_id: string;
  user_id: string;
  joined_at: string;
};

export type DmMessage = {
  id: string;
  conversation_id: string;
  user_id: string;
  content: string;
  created_at: string;
  pinned: boolean;
};
