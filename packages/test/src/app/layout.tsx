import type {Metadata} from "next";
import {Inter} from "next/font/google";
import "./globals.css";
import {Providers} from "./providers";

const inter = Inter({subsets: ["latin"]});

const site = {
  title: "Monaco Editor Typescript Locales Test Site",
  description: "",
};

export function generateMetadata(): Metadata {
  return {
    title: site.title,
    description: site.description,
    viewport: "initial-scale=1, width=device-width, shrink-to-fit=no, viewport-fit=cover",
  };
}

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang='en'>
      <body
        className={inter.className}
        style={{
          height: "100dvh",
          overflow: "hidden",
        }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
