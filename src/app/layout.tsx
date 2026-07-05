import type { Metadata } from "next";
import { Shippori_Mincho, Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { site } from "@/config/site";

const display = Shippori_Mincho({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = Zen_Kaku_Gothic_New({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: `${site.name} 和 — ${site.fullName} | Private inn & sauna in Miyazaki, Kyushu`,
  description:
    "A private countryside inn (民泊) for up to 16 guests in Miyazaki, Japan. Two whole houses, a cedar barrel sauna with cold plunge, and rice-field views. Built by an architect, rented in its entirety.",
  openGraph: {
    title: `${site.name} 和 — ${site.fullName}`,
    description:
      "Two whole houses, a barrel sauna, and the quiet of Miyazaki's rice fields. A private inn for up to 16 guests.",
    images: ["/images/sauna-exterior.jpg"],
    locale: "en_US",
    alternateLocale: "ja_JP",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        {/* Apply saved theme before first paint to avoid a flash (default: dark) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("nagomi.theme")==="light")document.documentElement.dataset.theme="light"}catch(e){}`,
          }}
        />
      </head>
      <body>
        <LanguageProvider>
          <Nav />
          <main>{children}</main>
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  );
}
