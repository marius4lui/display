import { NextRequest, NextResponse } from "next/server";
import { ownedDisplay } from "../../../../../lib/server/display";
import { apiError } from "../../../../../lib/server/http";
import { publicUrl } from "../../../../../lib/server/public-url";
import type { DashboardDocument } from "../../../../../lib/dashboard";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const found = await ownedDisplay(request, (await params).id); if (found.error) return found.error;
  const { data: draft } = await found.context.database.from("display_drafts").select("document").eq("display_id", found.display.id).maybeSingle();
  const document = draft?.document as DashboardDocument | undefined;
  if (document?.schemaVersion === 5) {
    const ids = [...new Set([...(document.actions ?? []).map((action) => action.integrationId), ...document.dataSources.filter((source) => source.type === "home_assistant" || source.type === "n8n" || source.type === "immich").map((source) => source.integrationId)])];
    const { data: integrations } = ids.length ? await found.context.database.from("integrations").select("id,provider,status").in("id", ids) : { data: [] };
    const available = new Map((integrations ?? []).map((item) => [item.id, item]));
    for (const action of document.actions ?? []) {
      const integration = available.get(action.integrationId);
      if (!integration || integration.status !== "active" || integration.provider !== action.provider) return apiError("INVALID_ACTION_INTEGRATION", `Integration für Aktion „${action.name}“ ist nicht aktiv`, 409);
      if (action.provider === "n8n" && (!action.target.webhookPath?.startsWith("/webhook/") || action.target.webhookPath.startsWith("/webhook-test/"))) return apiError("INVALID_WEBHOOK", "Nur veröffentlichte Production-Webhooks sind erlaubt", 409);
      if (action.provider === "n8n" && action.operation !== "n8n_webhook") return apiError("UNSUPPORTED_ACTION", "n8n unterstützt nur Production-Webhooks", 409);
      if (action.provider === "home_assistant" && (action.operation !== "home_assistant_service" || !action.target.domain || !action.target.service)) return apiError("UNSUPPORTED_ACTION", "Home Assistant unterstützt nur gültige Services/Actions", 409);
      if (action.responseSourceId && !document.dataSources.some((source) => source.type === "action_response" && source.id === action.responseSourceId && source.actionId === action.id)) return apiError("INVALID_RESPONSE_SOURCE", "Webhook-Antwortdatenquelle ist ungültig", 409);
    }
    for (const source of document.dataSources) if (source.type === "home_assistant" || source.type === "n8n" || source.type === "immich") {
      const integration = available.get(source.integrationId);
      if (!integration || integration.status !== "active" || integration.provider !== source.type) return apiError("INVALID_SOURCE_INTEGRATION", `Integration für Datenquelle „${source.name}“ ist nicht aktiv`, 409);
    }
    for (const page of document.pages) for (const widget of page.widgets) if (widget.type === "button" && !document.actions.some((action) => action.id === widget.actionId)) return apiError("INVALID_BUTTON_ACTION", `Button „${widget.title}“ verweist auf keine Aktion`, 409);
  }
  const { data, error } = await found.context.database.rpc("publish_display", { target_display: found.display.id });
  return error ? apiError("PUBLISH_FAILED", error.message, 409) : NextResponse.json({ version: data, displayUrl: publicUrl(request, `/d/${found.display.public_id}`) }, { status: 201 });
}
