"use client";

import { createContext, useContext } from "react";

type BandoRolesValue = {
  roleColorByUserId: Record<string, string | null>;
};

const BandoRolesContext = createContext<BandoRolesValue>({
  roleColorByUserId: {},
});

export function useBandoRoles() {
  return useContext(BandoRolesContext);
}

export function BandoRolesProvider({
  roleColorByUserId,
  children,
}: {
  roleColorByUserId: Record<string, string | null>;
  children: React.ReactNode;
}) {
  return (
    <BandoRolesContext.Provider value={{ roleColorByUserId }}>
      {children}
    </BandoRolesContext.Provider>
  );
}
