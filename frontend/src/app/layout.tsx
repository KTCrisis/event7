import { Outfit } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata = {
  title: "event7",
  description: "Universal Schema Registry Governance",
  icons: {
    icon: "/icon.svg",
  },
  verification: {
    google: "OAfm_sY25xeFXc0L18o7hhqy_uAJnPQwRlZDRiuaLdA",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${outfit.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/@asyncapi/react-component@3.0.2/styles/default.min.css"
        />
      </head>
      <body className={outfit.className}>
        {children}
        <Script
          src="https://unpkg.com/@asyncapi/react-component@3.0.2/browser/standalone/index.js"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}