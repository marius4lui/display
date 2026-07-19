import type { SVGProps } from "react";
import type { WidgetType } from "../../lib/dashboard";

type IconName =
  | "widgets" | "pages" | "layers" | "data" | "project" | "search"
  | "plus" | "duplicate" | "trash" | "up" | "down" | "settings"
  | "preview" | "edit" | "panel-left" | "panel-right" | "fit"
  | "share" | "send" | "secrets" | "copy" | "close" | "drag"
  | "chevron-left" | "chevron-right";

const paths: Record<IconName, React.ReactNode> = {
  widgets: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M17.5 14v7M14 17.5h7"/></>,
  pages: <><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v5h4M9 12h6M9 16h6"/></>,
  layers: <><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>,
  data: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/></>,
  project: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  duplicate: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></>,
  up: <path d="m6 15 6-6 6 6"/>,
  down: <path d="m6 9 6 6 6-6"/>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></>,
  preview: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.5"/></>,
  edit: <><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10zM13.5 7l3.5 3.5"/></>,
  "panel-left": <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></>,
  "panel-right": <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/></>,
  fit: <><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></>,
  share: <><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"/></>,
  send: <><path d="m3 3 19 9-19 9 3-9zM6 12h16"/></>,
  secrets: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  drag: <><circle cx="9" cy="6" r=".8" fill="currentColor"/><circle cx="15" cy="6" r=".8" fill="currentColor"/><circle cx="9" cy="12" r=".8" fill="currentColor"/><circle cx="15" cy="12" r=".8" fill="currentColor"/><circle cx="9" cy="18" r=".8" fill="currentColor"/><circle cx="15" cy="18" r=".8" fill="currentColor"/></>,
  "chevron-left": <path d="m15 18-6-6 6-6"/>,
  "chevron-right": <path d="m9 18 6-6-6-6"/>,
};

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}

const widgetPaths: Record<WidgetType, React.ReactNode> = {
  button: <><rect x="4" y="7" width="16" height="10" rx="3"/><path d="m10 10 5 2-5 2z"/></>,
  text: <><path d="M5 5h14M12 5v14M8 19h8"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m4 17 5-5 3 3 3-3 5 5"/></>,
  immich_album: <><rect x="5" y="3" width="16" height="15" rx="2"/><path d="M3 7v13a1 1 0 0 0 1 1h13M6 15l4-4 3 3 2-2 5 4"/><circle cx="15" cy="8" r="1.5"/></>,
  value: <><path d="M5 8h14M5 16h14M9 4 7 20M17 4l-2 16"/></>,
  weather: <><path d="M7 18h10a4 4 0 0 0 .4-8A6 6 0 0 0 6 11.5 3.3 3.3 0 0 0 7 18z"/></>,
  metric: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></>,
  status: <><circle cx="12" cy="12" r="8"/><path d="m8.5 12 2.3 2.3 4.8-5"/></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r=".8" fill="currentColor"/><circle cx="4" cy="12" r=".8" fill="currentColor"/><circle cx="4" cy="18" r=".8" fill="currentColor"/></>,
  chart: <><path d="M3 19h18M5 16l4-5 4 2 6-7"/></>,
  gauge: <><path d="M4 17a8 8 0 1 1 16 0M12 13l4-4M7 17h10"/></>,
};

export function WidgetIcon({ type, ...props }: { type: WidgetType } & SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{widgetPaths[type]}</svg>;
}
