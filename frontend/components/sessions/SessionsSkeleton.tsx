import s from './sessions.module.css';

export function SessionsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div aria-busy="true">
      <span className={s.srOnly} role="status">Loading your support sessions…</span>
      <ul className={s.list} aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className={s.skeletonCard}>
            <span className={s.skeletonCircle} />
            <span className={s.skeletonLines}>
              <span className={s.skeletonLine} />
              <span className={`${s.skeletonLine} ${s.skeletonLineShort}`} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
