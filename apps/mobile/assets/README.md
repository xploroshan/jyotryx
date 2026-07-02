# App assets

`app.config.ts` references these binary assets. Add them before the first EAS
build (they're intentionally not committed as placeholders so nobody ships a
grey square to the Play Store):

| File | Size | Purpose |
|---|---|---|
| `icon.png` | 1024×1024 | App icon |
| `adaptive-icon.png` | 1024×1024 (safe zone) | Android adaptive foreground |
| `splash.png` | 1284×2778 | Splash image (linen `#ede4d0` background) |
| `notification-icon.png` | 96×96 (white, transparent) | Android notification small icon |

Generate them from the brand mark used on web (`apps/web` `LogoMark`). Until
they exist, `npx expo prebuild` / EAS build will fail on the missing paths —
that's deliberate.
