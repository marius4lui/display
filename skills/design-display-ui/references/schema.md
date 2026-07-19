# display Custom UI schema v1

The dashboard uses `schemaVersion: 6` and an optional `customUi` object:

```json
{
  "version": 1,
  "enabled": true,
  "theme": {
    "background": "#070912",
    "foreground": "#f8f9ff",
    "accent": "#8b7cff",
    "fontFamily": "system"
  },
  "pages": {
    "REAL_PAGE_ID": { "type": "column", "children": [] }
  }
}
```

## Nodes

All nodes require `type`. Optional `id` helps stable editing.

- `column`, `row`, `grid`, `card`: accept `style` and `children`.
- `text`: accepts `text` and `style`.
- `value`: accepts `title`, fallback `text`, `sourceId`, `path`, `format`, `suffix`, and `style`.
- `image`: accepts HTTPS or `/api/player/` or `/assets/` `url`, optional `title`, `fit` (`cover` or `contain`), and `style`.
- `spacer`: accepts `style`.
- `button`: accepts `text`, `title`, `icon`, existing `actionId`, and `style`.

Only container nodes may have `children`. Maximum nesting depth is 20 and the whole UI may contain at most 500 nodes.

## Style

```json
{
  "background": "#15192b",
  "foreground": "#ffffff",
  "accent": "#8b7cff",
  "padding": 24,
  "gap": 16,
  "radius": 24,
  "fontSize": 34,
  "fontWeight": 700,
  "align": "center",
  "justify": "space-between",
  "columns": 3,
  "width": "50%",
  "height": "100%",
  "opacity": 0.8,
  "shadow": "soft"
}
```

`align`: `start`, `center`, `end`, `stretch`. `justify`: `start`, `center`, `end`, `space-between`. `shadow`: `none`, `soft`, `strong`. `fontFamily`: `system`, `rounded`, `mono`.

## Live value example

```json
{
  "type": "card",
  "style": { "padding": 24, "radius": 22, "background": "#15192b" },
  "children": [
    {
      "type": "value",
      "title": "Temperatur",
      "sourceId": "EXISTING_SOURCE_ID",
      "path": "current.temperature_2m",
      "format": "temperature",
      "suffix": "°C",
      "text": "—",
      "style": { "fontSize": 48, "fontWeight": 700 }
    }
  ]
}
```
