import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://display.qhrd.online"),
  title: "display · Dashboard Studio",
  description: "Self-hosted Dashboards erstellen, veröffentlichen und sicher auf Web- und Android-Displays anzeigen.",
  applicationName: "display",
  openGraph: { title: "display · Dashboard Studio", description: "Self-hosted Dashboards für Web und Android", url: "https://display.qhrd.online", siteName: "display", type: "website" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body>{children}</body></html>;
}
