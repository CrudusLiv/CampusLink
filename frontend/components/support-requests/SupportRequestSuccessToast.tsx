import styles from "@/app/support-requests/support-requests.module.css";

export default function SupportRequestSuccessToast({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className={styles.successToast} role="status" aria-live="polite">
      <span className={styles.successToastCheck} aria-hidden="true">✓</span>
      <span>{description ? <><strong>{title}</strong> {description}</> : title}</span>
    </div>
  );
}
