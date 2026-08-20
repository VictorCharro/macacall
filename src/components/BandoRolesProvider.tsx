"use client";

import { createContext, useContext } from "react";
import type { Mentionable } from "@/lib/mentions";

type BandoRolesValue = {
  roleColorByUserId: Record<string, string | null>;
  /** Custom (non-@everyone) roles, mentionable as "@RoleName". */
  mentionableRoles: Mentionable[];
  /** Whether the current user can ping @everyone in this bando. */
  canMentionEveryone: boolean;
  /** Role ids assigned to the current user, for "does this mention me?" checks. */
  myRoleIds: string[];
};

const BandoRolesContext = createContext<BandoRolesValue>({
  roleColorByUserId: {},
  mentionableRoles: [],
  canMentionEveryone: false,
  myRoleIds: [],
});

export function useBandoRoles() {
  return useContext(BandoRolesContext);
}

export function BandoRolesProvider({
  roleColorByUserId,
  mentionableRoles,
  canMentionEveryone,
  myRoleIds,
  children,
}: {
  roleColorByUserId: Record<string, string | null>;
  mentionableRoles: Mentionable[];
  canMentionEveryone: boolean;
  myRoleIds: string[];
  children: React.ReactNode;
}) {
  return (
    <BandoRolesContext.Provider
      value={{ roleColorByUserId, mentionableRoles, canMentionEveryone, myRoleIds }}
    >
      {children}
    </BandoRolesContext.Provider>
  );
}
