export type PresenceStatus = "online" | "idle" | "dnd" | "invisible";

export type Profile = {
  id: string;
  username: string;
  avatar_seed: string;
  status: PresenceStatus;
  status_message: string | null;
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
  created_at: string;
};

export type BandoMember = {
  bando_id: string;
  user_id: string;
  role: string;
  joined_at: string;
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
