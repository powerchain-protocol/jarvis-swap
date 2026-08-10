export default function Loading() {
  return (
    <div className="page-width" aria-live="polite" aria-busy="true">
      <div className="page-header"><div><div className="skeleton skeleton-title" /><div className="skeleton skeleton-copy" /></div></div>
      <div className="card skeleton-panel" />
    </div>
  );
}
