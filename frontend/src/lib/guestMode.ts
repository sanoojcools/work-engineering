import { useCompany } from "../company";

/** True when this browser has no key that resolves to a real tenant.
 * keyClientId is CompanyProvider's own result of POST /org/whoami against
 * whatever key is stored (or the fake default) -- null covers both "no key
 * pasted" and "a key was pasted but it's invalid/expired", which is the
 * right guest test: a stranger and a signed-out colleague should see the
 * same read-only walk, not a crash. */
export function useIsGuest(): boolean {
  const { keyClientId } = useCompany();
  return keyClientId === null;
}
