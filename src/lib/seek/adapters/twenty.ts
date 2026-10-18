// Shared helpers for Twenty rows: composite fields arrive as objects, and an
// org name sits either in the card name ("Role @ Company") or a relation.

export const link = (v: { primaryLinkUrl?: string } | null | undefined): string | null =>
  v?.primaryLinkUrl?.trim() || null;

export const markdown = (v: { markdown?: string } | null | undefined): string | null =>
  v?.markdown?.trim() || null;

export function splitName(name: string): { title: string; org: string | null } {
  const at = name.lastIndexOf(" @ ");
  return at === -1
    ? { title: name, org: null }
    : { title: name.slice(0, at).trim(), org: name.slice(at + 3).trim() || null };
}

export const recordUrl = (object: string, id: string): string =>
  `https://sales.databayt.org/object/${object}/${id}`;
