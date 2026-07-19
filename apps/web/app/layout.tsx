import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "display · Dashboard Studio",
  description: "Self-hosted Dashboards erstellen, veröffentlichen und sicher auf Web- und Android-Displays anzeigen.",
  applicationName: "display",
  openGraph: { title: "display · Dashboard Studio", description: "Self-hosted Dashboards für Web und Android", siteName: "display", type: "website" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body>{children}</body></html>;
}
