# Icônes

Toutes les icônes utilisées viennent de **Lucide** (v0.544+), rendues en SVG inline.
Source dans `../src/icons.jsx` — map déjà construite. À coller dans `components/ui/Icon.tsx` côté Next.js.

## Contrat composant
```tsx
type IconName = 'search' | 'bell' | 'user-plus' | ... ;
interface IconProps {
  name: IconName;
  size?: number;    // default 16
  className?: string;
  strokeWidth?: number;  // default 2
}
```
Toutes en `stroke: currentColor; fill: none; stroke-linecap: round; stroke-linejoin: round`.

## Liste utilisée v2 (triée)
```
alert, alert-circle, alert-triangle, archive, arrow-down, arrow-left, arrow-right, arrow-up,
banknote, bar-chart, bell, bookmark, box, briefcase, building,
calendar, camera, check, check-circle, chevron-down, chevron-left, chevron-right, chevron-up,
chevrons-up-down, clipboard, clock, cog, copy, credit-card, crown,
database, download, edit, eye, eye-off, factory, file, file-text, filter, flag, folder,
gauge, grid, hash, help-circle, home, image, inbox, info,
key, layers, link, list, lock, log-out, mail, map-pin, menu, message-circle, minus, monitor, moon, more-horizontal, more-vertical,
package, pause, pencil, phone, pie-chart, play, plus, printer,
receipt, refresh, save, search, send, settings, share, shield, shopping-cart, smartphone, sparkles, star, sun,
tag, target, trash, trending-down, trending-up, truck,
upload, user, user-plus, users,
x, zap
```

## Logo RestoPilot
Pas de logo SVG fourni en v2 — le prototype utilise un placeholder typographique :
```
<div class="rp-logo">
  <span class="rp-mark">RP</span>  /* carré 28×28, bg accent, color white, radius 7, font mono 12 bold */
  <span class="rp-name">RestoPilot</span>  /* 14px fw-600 */
</div>
```
À remplacer par le SVG définitif quand dispo. Fournir `/public/logo.svg` et `/public/logo-mark.svg`.
