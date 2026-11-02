/** Green signals are limited to new requests and accepted requests. */
export function notificationTone(type: string): "success" | "error" {
  return type === "request_pending" || type === "request_accepted" ? "success" : "error";
}
