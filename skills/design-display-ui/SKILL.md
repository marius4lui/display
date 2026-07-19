---
name: design-display-ui
description: Create, redesign, validate, or repair declarative Custom UI JSON for the display dashboard project. Use when a user asks for a polished dashboard, kiosk, smart-home panel, monitoring screen, information display, AI-generated display UI, or changes to a display customUi document.
---

# Design display UI

Create expressive layouts using the project's safe declarative UI format. Never emit HTML, CSS, JavaScript, JSX, or unknown component types.

## Workflow

1. Inspect the target dashboard document or ask for its pages, data source IDs, JSON response shapes, action IDs, display size, and desired visual direction.
2. Read [references/schema.md](references/schema.md) before generating or editing JSON.
3. Preserve real page IDs, source IDs, paths, and action IDs exactly. Do not invent bindings unless clearly marked as placeholders.
4. Design for the target aspect ratio. Prefer a clear hierarchy, restrained color palette, strong contrast, useful whitespace, and glanceable values.
5. Emit a complete `customUi` object unless the user explicitly requests a fragment.
6. Check every node recursively against the reference: supported type, allowed fields, maximum depth 20, maximum 500 nodes, and safe image URLs.
7. If repository access is available, place the object in `DashboardDocument.customUi`, keep `schemaVersion: 6`, and run the project typecheck/tests.

## Design rules

- Use `column`, `row`, `grid`, and `card` for structure.
- Use `value` with `sourceId` and `path` for live data.
- Use `button` with an existing `actionId` for actions.
- Keep primary values readable from a distance; use roughly 30–64 px for key metrics on 1080p displays.
- Provide a root layout for each relevant page ID.
- Use a fallback `text` when a value may be unavailable.
- Keep `enabled: true` for a finished design and `enabled: false` only for staged drafts.

Return concise notes listing any unresolved placeholder bindings after the JSON.
