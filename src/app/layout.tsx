import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CALL — One World. One Call.",
  description:
    "CALL is a free & unlimited calling app: HD video calls, voice calls, messages and voice notes — peer-to-peer, zero budget, no limits.",
  keywords: ["CALL", "calls", "video call", "voice call", "messaging", "voice messages", "free calls"],
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0B1B40",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Pre-hydration splash neutralizer: when the admin disabled the splash
          screen (cached locally), paint the shell WHITE from the very first
          frame — no navy/blue flash before the app decides where to route.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('call.splash')==='0')document.documentElement.dataset.splashOff='1'}catch(e){}`,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>{children}</body>
    </html>
  );
}
