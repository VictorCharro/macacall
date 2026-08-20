/** One row from the channel_threads() RPC: a thread plus its reply count. */
export type ThreadSummary = {
  id: string;
  parent_message_id: string;
  name: string;
  reply_count: number;
};
