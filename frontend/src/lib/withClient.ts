export function withClient(path: string, clientId?: number | null): string | null {
  if (!clientId) return null;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}client_id=${clientId}`;
}
