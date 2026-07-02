# App assets

These are **real, build-ready** assets generated from the web brand mark (the
"shatkona-dial" `LogoMark` in `apps/web/src/components/ui/Logo.tsx`) — not
placeholders. `app.config.ts` references them.

| File | Size | Purpose |
|---|---|---|
| `icon.png` | 1024×1024 | App icon — mark in the sunrise gradient on the linen canvas |
| `adaptive-icon.png` | 1024×1024 | Android adaptive foreground — mark on transparent, inside the ~66% safe zone (background `#ede4d0` is set in `app.config.ts`) |
| `splash.png` | 1284×2778 | Splash — mark + "MyAstro360" wordmark on linen |
| `notification-icon.png` | 96×96 | Android notification small icon — white silhouette on transparent (Android uses only the alpha channel) |

## Regenerating / replacing

The generator `apps/mobile/scripts/gen-assets.mjs` renders the SVG mark to PNG
via Chromium (Playwright). To refresh after a brand tweak:

```bash
PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  node apps/mobile/scripts/gen-assets.mjs
```

(Drop the env var to use Playwright's managed browser.) A designer can also
replace any file directly — keep the dimensions above and the linen background
(`#ede4d0`).
