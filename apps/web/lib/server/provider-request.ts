type Secret = { webhookAuth?: string; headerName?: string; headerValue?: string; username?: string; password?: string; jwt?: string; accessToken?: string };
type ActionLike = {
  provider: "n8n" | "home_assistant";
  target: { webhookPath?: string; method?: string; domain?: string; service?: string; selection?: { entityId?: string[]; deviceId?: string[]; areaId?: string[] } };
  payload?: Record<string, unknown>;
  responseSourceId?: string;
};

export function providerActionRequest(baseUrl: string, action: ActionLike, secret: Secret, context: Record<string, unknown>) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (action.provider === "n8n") {
    const path = action.target.webhookPath ?? "";
    if (!path.startsWith("/webhook/") || path.startsWith("/webhook-test/")) throw new Error("Nur Production-Webhooks sind erlaubt");
    if (secret.webhookAuth === "header" && secret.headerName && secret.headerValue) headers[secret.headerName] = secret.headerValue;
    if (secret.webhookAuth === "basic") headers.Authorization = `Basic ${Buffer.from(`${secret.username ?? ""}:${secret.password ?? ""}`).toString("base64")}`;
    if (secret.webhookAuth === "jwt" && secret.jwt) headers.Authorization = `Bearer ${secret.jwt}`;
    return { url: `${baseUrl}${path}`, method: action.target.method ?? "POST", headers, body: { ...(action.payload ?? {}), player: context } };
  }
  const domain = action.target.domain ?? "", service = action.target.service ?? "";
  if (!/^[a-z0-9_]+$/.test(domain) || !/^[a-z0-9_]+$/.test(service)) throw new Error("Ungültiger Home-Assistant-Service");
  headers.Authorization = `Bearer ${secret.accessToken ?? ""}`;
  const selection = action.target.selection ?? {};
  return {
    url: `${baseUrl}/api/services/${domain}/${service}${action.responseSourceId ? "?return_response" : ""}`,
    method: "POST",
    headers,
    body: { ...(action.payload ?? {}), ...(selection.entityId?.length ? { entity_id: selection.entityId } : {}), ...(selection.deviceId?.length ? { device_id: selection.deviceId } : {}), ...(selection.areaId?.length ? { area_id: selection.areaId } : {}) },
  };
}

export function homeAssistantSourceRequest(baseUrl: string, source: { resource: string; entityIds?: string[]; entityId?: string; calendarId?: string; start?: string; end?: string }) {
  let path = "/api/states";
  if (source.resource === "states" && source.entityIds?.length === 1) path += `/${encodeURIComponent(source.entityIds[0])}`;
  if (source.resource === "history") path = `/api/history/period/${encodeURIComponent(source.start ?? new Date(Date.now()-3600000).toISOString())}?minimal_response&filter_entity_id=${encodeURIComponent((source.entityIds ?? []).join(","))}${source.end ? `&end_time=${encodeURIComponent(source.end)}` : ""}`;
  if (source.resource === "logbook") path = `/api/logbook/${encodeURIComponent(source.start ?? new Date(Date.now()-3600000).toISOString())}${source.entityId ? `?entity=${encodeURIComponent(source.entityId)}` : ""}`;
  if (source.resource === "calendars") path = "/api/calendars";
  if (source.resource === "calendar_events") path = `/api/calendars/${encodeURIComponent(source.calendarId ?? "")}?start=${encodeURIComponent(source.start ?? new Date().toISOString())}&end=${encodeURIComponent(source.end ?? new Date(Date.now()+86400000).toISOString())}`;
  if (source.resource === "camera") path = `/api/camera_proxy/${encodeURIComponent(source.entityId ?? "")}`;
  return `${baseUrl}${path}`;
}

export function oauthRefreshForm(refreshToken: string, clientId: string) {
  return new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId });
}
