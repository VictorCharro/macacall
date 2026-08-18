export type Profile = {
  id: string;
  username: string;
  avatar_seed: string;
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
