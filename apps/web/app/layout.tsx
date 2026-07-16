import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "display",
  description: "display dashboard system",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}

