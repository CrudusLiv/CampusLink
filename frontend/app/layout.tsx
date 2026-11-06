import type { Metadata } from "next";
import { geistMono, geistSans } from "@/lib/fonts";
import AskSupportDraftScope from "./AskSupportDraftScope";
import { VolunteerViewProvider } from "@/components/dashboard/VolunteerViewContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "CampusLink",
  description: "Peer-to-peer university support platform: ask for help, volunteer, and schedule support sessions.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <VolunteerViewProvider>
          <AskSupportDraftScope />
          {children}
        </VolunteerViewProvider>
      </body>
    </html>
  );
}
