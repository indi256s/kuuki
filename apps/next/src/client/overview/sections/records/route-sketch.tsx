export function RouteSketch({ equator = false }: { equator?: boolean }) {
  return <svg className="ov3-record-sketch" viewBox="0 0 240 80" aria-hidden="true">{equator && <path d="M0 40H240" stroke="var(--mark-ghost)" strokeDasharray="4 4" />}<path d="M12 65Q120 -30 228 20" fill="none" stroke="var(--accent)" strokeWidth="2" /><circle cx="12" cy="65" r="4" fill="var(--accent)" /><circle cx="228" cy="20" r="4" fill="var(--accent)" /></svg>
}
