import localFont from "next/font/local";

export const geistSans = localFont({
  src: "../public/fonts/geist-regular.ttf",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const geistMono = localFont({
  src: "../public/fonts/geist-mono-regular.ttf",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const spaceGrotesk = localFont({
  src: [
    { path: "../public/fonts/space-grotesk-300.ttf", weight: "300", style: "normal" },
    { path: "../public/fonts/space-grotesk-400.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/space-grotesk-500.ttf", weight: "500", style: "normal" },
  ],
  variable: "--font-display",
});
