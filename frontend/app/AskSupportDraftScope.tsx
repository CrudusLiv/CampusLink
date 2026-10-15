"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { ASK_SUPPORT_DRAFT_KEY } from "@/lib/askSupportDraft";

function isAskSupportFlow(pathname: string) {
  return pathname === "/sessions/ask-for-support" || pathname.startsWith("/volunteer-lists");
}

export default function AskSupportDraftScope() {
  const pathname = usePathname();
  const previousPath = useRef<string | null>(null);

  useLayoutEffect(() => {
    const previous = previousPath.current;
    const insideFlow = isAskSupportFlow(pathname);

    // Clear stale form data on a fresh visit outside the flow, and whenever
    // navigation crosses between the flow and any unrelated page.
    if (previous === null ? !insideFlow : isAskSupportFlow(previous) !== insideFlow) {
      try {
        window.sessionStorage.removeItem(ASK_SUPPORT_DRAFT_KEY);
      } catch {
        // Storage may be unavailable; the page remains usable without draft persistence.
      }
    }

    previousPath.current = pathname;
  }, [pathname]);

  return null;
}
