import { supportRequestStatusPresentation, type SupportRequestStatus } from "@/lib/support-requests/history";
import styles from "./RequestStatusBadge.module.css";

export default function RequestStatusBadge({ status }: { status: SupportRequestStatus }) {
  const presentation = supportRequestStatusPresentation(status);
  return <span className={`${styles.badge} ${styles[presentation.className]}`} data-status={status}>{presentation.label}</span>;
}
