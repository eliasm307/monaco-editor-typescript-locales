import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Colours } from "./constants";

const inter = Inter({ subsets: ["latin"] });

const site = {
  title: "Monaco Editor Typescript Locales",

  description:
    "A demo of the monaco-editor-typescript-locales package for translating Typescript/Javascript diagnostic messages in Monaco",
};

export function generateMetadata(): Metadata {
  return {
    title: site.title,
    description: site.description,
    viewport: "initial-scale=1, width=device-width, shrink-to-fit=no, viewport-fit=cover",
    // metadataBase: new URL(PRODUCTION_SITE_URL),
    openGraph: {
      type: "website",
      // url: PRODUCTION_SITE_URL,
      siteName: site.title,
      title: site.title,
      description: site.description,
      // images: [logoFullUrl],
    },
    icons: {
      // apple: logo192x192Url,
      // icon: logo192x192Url,
      // shortcut: logo192x192Url,
      // other: { url: logo192x192Url },
    },
    twitter: {
      title: site.title,
      description: site.description,
      // images: [logoFullUrl],
    },
    themeColor: Colours.monacoPrimary,
    applicationName: site.title,
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en'>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
