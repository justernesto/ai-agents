import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ops Copilot | AI Agents",
  description:
    "Ernesto Cardenas’s IT operations assistant prototype for triaging support issues with reference runbooks and human review.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
