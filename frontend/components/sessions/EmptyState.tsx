import s from './sessions.module.css';

export function EmptyState() {
  return (
    <div className={s.empty}>
      <svg className={s.emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
      </svg>
      <h3 className={s.emptyTitle}>No upcoming support sessions</h3>
      <p className={s.emptyText}>
        Your sessions will appear here.
        Volunteers: accept a request from the Support Board to get started.
      </p>
    </div>
  );
}
