import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = { title: "display · Dashboard Studio", description: "Lokale Dashboards sicher erstellen und ausliefern" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body>{children}</body></html>;
}
