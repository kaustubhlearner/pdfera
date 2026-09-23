import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDFera — Simple PDF Tools",
  description: "Free browser-based PDF tools.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}