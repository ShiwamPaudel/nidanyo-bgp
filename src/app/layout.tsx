import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { PwaRegister } from "@/components/pwa-register";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Nidanyo — Laboratory Management",
    template: "%s · Nidanyo",
  },
  description: "Nidanyo — From Liquid to Logic. Laboratory Information & Operations Management System by Infobytes Nepal.",
  icons: { icon: "/favicon.png", apple: "/favicon.png" },
  applicationName: "Nidanyo",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Nidanyo" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#075323",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>
        <PwaRegister />
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            classNames: {
              toast: "rounded-xl border border-border shadow-card",
            },
          }}
        />
      </body>
    </html>
  );
}
