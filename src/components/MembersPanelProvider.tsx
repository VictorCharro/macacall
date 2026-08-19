"use client";

import { createContext, useContext, useState } from "react";

/**
 * The members panel is toggled from the chat header but rendered by the bando
 * layout, so the open/closed flag lives in a context both can reach.
 */
const MembersPanelContext = createContext<{
  membersOpen: boolean;
  toggleMembers: () => void;
}>({ membersOpen: true, toggleMembers: () => {} });

export function useMembersPanel() {
  return useContext(MembersPanelContext);
}

export function MembersPanelProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [membersOpen, setMembersOpen] = useState(true);

  return (
    <MembersPanelContext.Provider
      value={{ membersOpen, toggleMembers: () => setMembersOpen((v) => !v) }}
    >
      {children}
    </MembersPanelContext.Provider>
  );
}
