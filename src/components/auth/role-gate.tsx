"use client";

import type { ContributorPublic } from "@/components/root/context/contributors-public";
import { FormError } from "./form-error";
import { useCurrentRole } from "./use-current-role";

type ContributorRole = ContributorPublic["role"];

interface RoleGateProps {
  children: React.ReactNode;
  allowedRoles: ContributorRole | ContributorRole[];
  message?: string;
}

// Client-side role guard. Server Actions still gate with `requireContributor`
// (auth.ts) — this only hides UI the current role should not see.
export const RoleGate = ({
  children,
  allowedRoles,
  message = "You do not have permission to view this content.",
}: RoleGateProps) => {
  const role = useCurrentRole();
  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  if (!role || !allowed.includes(role as ContributorRole)) {
    return <FormError message={message} />;
  }

  return <>{children}</>;
};
