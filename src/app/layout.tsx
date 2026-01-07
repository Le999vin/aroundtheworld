import type { Metadata } from "next";
import { DM_Serif_Display, Sora } from "next/font/google";
import "@/styles/globals.css";

const sora = Sora({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const dmSerif = DM_Serif_Display({
  variable: "--font-title",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Global Travel Atlas",
  description:
    "Immersive travel planning with a 3D globe, live weather, and curated places.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body className={`${sora.variable} ${dmSerif.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
