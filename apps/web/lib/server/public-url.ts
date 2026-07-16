const configuredOrigin = () => {
  const value = process.env.PUBLIC_APP_URL?.trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("PUBLIC_APP_URL must be an absolute http(s) URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("PUBLIC_APP_URL must use http or https");
  if (url.username || url.password || url.search || url.hash) throw new Error("PUBLIC_APP_URL must contain only an origin and optional path");
  return url;
};

export function publicUrl(request: Request, path: string): string {
  const base = configuredOrigin() ?? new URL(request.url);
  const basePath = base.pathname.replace(/\/$/, "");
  const relativePath = path.replace(/^\//, "");
  return new URL(`${basePath}/${relativePath}`, base.origin).toString();
}
