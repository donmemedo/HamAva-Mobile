import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
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
  const [jar, h] = await Promise.all([cookies(), headers()]);
  const lang = jar.get("lang")?.value === "en" ? "en" : "fa";
  const nonce = h.get("x-nonce") ?? undefined; // set by proxy.ts for the CSP
  return (
    <html lang={lang} dir={lang === "fa" ? "rtl" : "ltr"} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preload" as="font" type="font/woff2" crossOrigin=""
          href={lang === "fa" ? "/fonts/vazirmatn-arabic.woff2" : "/fonts/inter-latin.woff2"} />
      </head>
      <body>
        <Providers lang={lang}>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
