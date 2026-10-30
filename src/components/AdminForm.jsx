// Shared admin form primitives. Identical copies of these lived in
// AdminUsers.jsx and AdminNews.jsx (noted as known duplication in BRAIN.md
// §21); one definition keeps admin form styling consistent with the design
// system and stops the two pages from drifting apart.

export const inputCls =
  'px-3 py-2 text-sm rounded-soft bg-surface border border-text-muted/15 focus:outline-none focus:ring-2 focus:ring-primary/30 w-full';

export const labelCls = 'block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1';

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

export function ErrorNote({ message }) {
  if (!message) return null;
  return <div className="bg-error/10 text-error-dark rounded-soft p-3 text-sm">{message}</div>;
}

export function OkNote({ message }) {
  if (!message) return null;
  return <div className="bg-success/10 text-success-dark rounded-soft p-3 text-sm">{message}</div>;
}
