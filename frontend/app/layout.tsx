import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Providers } from "./providers";
import { Shell } from "./ui";
import "./fonts.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "هم‌آوا | Hamava Mobile",
  description: "Community-powered mobile network — free SIM, no contracts, rewards for helping others.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

// runs before paint so the stored/system theme never flashes
const themeScript = `try{var t=localStorage.getItem('theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = (await cookies()).get("lang")?.value === "en" ? "en" : "fa";
  return (
    <html lang={lang} dir={lang === "fa" ? "rtl" : "ltr"} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers lang={lang}>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
