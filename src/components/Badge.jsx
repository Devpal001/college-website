// Shared status badge for admin surfaces (news + agent).
// Tones map to semantic tokens so status meaning stays consistent app-wide
// (design system §4, §24). Keep visuals identical to the previous inline
// copies that lived in AdminNews.jsx / AdminAgent.jsx.
const TONES = {
  green: 'bg-success/10 text-success-dark',
  red: 'bg-error/10 text-error-dark',
  amber: 'bg-warning/10 text-warning-dark',
  blue: 'bg-info/10 text-info-dark',
  gray: 'bg-text-muted/10 text-text-muted',
};

export default function Badge({ tone = 'gray', children }) {
  return (
    <span
      className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}