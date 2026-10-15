import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AskSupportDraftScope from "./AskSupportDraftScope";
import { VolunteerViewProvider } from "@/components/dashboard/VolunteerViewContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
