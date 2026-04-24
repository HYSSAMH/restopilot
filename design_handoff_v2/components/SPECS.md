# Composants — specs exhaustives

> Tous les composants sont implémentables à partir des tokens (`tokens/tokens.css`) et de la config Tailwind (`tokens/tailwind.config.ts`).
> Référence code dans `../src/` — pattern CSS vanilla à convertir en Tailwind classes.

## Conventions globales
- **Focus ring** : `outline: none; box-shadow: 0 0 0 3px var(--accent-soft);` sur tout contrôle interactif.
- **Transitions** : `transition: all 150ms cubic-bezier(0.22, 1, 0.36, 1)` par défaut.
- **Disabled** : opacity 0.5 + cursor not-allowed, pointer-events optionnel.
- **Loading** : spinner 14px à la place de l'icône principale du bouton ou skeleton ligne.

---

## 1. Boutons

### Variantes
| Classe | Usage | Bg | Color | Border |
|---|---|---|---|---|
| `.btn.primary`   | CTA principal | `accent` | white | none |
| `.btn`           | Secondary    | white | text | 1px border |
| `.btn.ghost`     | Tertiary     | transparent | text-muted | none |
| `.btn.danger`    | Destructif   | white | danger | 1px danger |
| `.btn.icon-btn`  | Icon-only    | transparent | text-muted | none, 28×28px rounded-sm |

### Tailles
- `.btn` : `height: 32px; padding: 0 14px; font-size: 12.5px; font-weight: 600; radius: 7px; gap: 6px`
- `.btn.sm` : 28px h, 0 10px pad, 12px font
- `.btn.lg` : 40px h, 0 20px pad, 14px font

### États
- hover primary : `bg: accent-hover`
- hover secondary : `bg: bg-subtle`, `border: border-strong`
- active : `transform: translateY(1px)`, shadow inset
- focus : ring
- disabled : opacity 0.5
- loading : spinner 14px + label (keep width stable)

---

## 2. Inputs

### Text / Number / Password
```
height: 36px
padding: 0 12px
border: 1px solid var(--border)
radius: 7px
font-size: 13px
bg: white

:focus → border-color: accent, box-shadow: ring
:disabled → bg: bg-subtle, color: text-muted
[aria-invalid="true"] → border-color: danger, box-shadow: 0 0 0 3px var(--danger-soft)
```

### Textarea — idem avec `min-height: 80px; padding: 10px 12px; resize: vertical`.

### Select — idem + chevron SVG inline dans `background-image` (voir `.or-select` dans styles.css).

### Search input — wrapper `.or-search` : bg `bg-subtle`, pas de border, focus → bg white + border accent + ring. Icône `search` à gauche, bouton clear `×` à droite si valeur.

### Date / Number avec unité — mono font, align right.

### Label — `font-size: 11.5px; font-weight: 600; color: text; margin-bottom: 5px;`
### Hint (aide) — `font-size: 11px; color: text-muted; margin-top: 2px;`
### Error — idem hint mais `color: danger` avec icône alert 11px.

---

## 3. Checkbox / Radio / Toggle

### Checkbox & Radio
- `accent-color: var(--accent)`, taille 15px.
- Label cliquable, gap 8px avec le contrôle.

### Toggle
Composant custom (voir `.pr-toggle`) :
- `width: 40px; height: 22px; border-radius: 12px; background: border`
- dot : `width: 16px; height: 16px; top: 3px; left: 3px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.2)`
- `.on` : bg → accent, dot `left: 21px`
- Transition `background 200ms out` sur le rail, `left 200ms out` sur la dot.
- Variante `.sm` : 34×18, dot 13×13.

---

## 4. Tables

### Structure
```
.table {
  background: white
  border: 1px solid var(--border)
  border-radius: 10px
  overflow: hidden
}
.table-head {
  display: grid  (grid-template-columns défini par page)
  gap: 14px
  padding: 12px 16px
  background: bg-subtle
  border-bottom: 1px solid var(--border)
  font-size: 10.5px
  font-weight: 650
  color: text-muted
  text-transform: uppercase
  letter-spacing: 0.04em
}
.table-row {
  display: grid (same columns)
  padding: 14px 16px
  border-bottom: 1px solid var(--border)
  align-items: center
  cursor: pointer
  transition: background 120ms
}
.table-row:hover { background: bg-subtle }
.table-row.active { background: accent-soft }
.table-row:last-child { border-bottom: 0 }
```

### Tri
- Colonne triable : cursor pointer, chevron 10px à droite du label.
- Icônes : `chevrons-up-down` inactif, `chevron-up` ascending, `chevron-down` descending.

### Sélection
- Checkbox 15px en 1ère colonne (36px de large), `accent-color: accent`.

### Pagination
- Footer table, bg `bg-subtle`, height 44px, padding 0 16px.
- Texte gauche `12 sur 287` mono, boutons pagination droite (← 1 2 3 ... →).

---

## 5. Cards

### Standard
```
background: white
border: 1px solid var(--border)
border-radius: 10px
padding: 16px
```

### KPI Card
Structure :
1. Label (11px, uppercase, tracking 0.04em, text-muted, fw 600)
2. Value (22–28px, mono, strong, tracking -0.02em)
3. Sub (12px, text-muted) OU delta pill + sparkline inline

### Stat Card (su-kpi)
Plus compact, voir `.su-kpi` : label, val (22px mono 700), sub (11px muted).

### Empty card — placeholder + icône + CTA centré, voir `.or-empty`.

---

## 6. Modals / Drawers / Popovers

### Modal (te-modal, bud-modal)
```
position: fixed; center via translate(-50%, -50%)
width: variable (520px form, 1320px heavy editor)
max-width: 94vw; max-height: 90vh
background: white
border-radius: 14px
box-shadow: elev-5
z-index: 100
animation: fadeIn 200ms ease
```
Backdrop : `position: fixed; inset: 0; background: rgba(15,15,20,0.4); z-index: 90; animation: fadeIn 200ms`.
Structure : `head` (18–20px padding, border-bottom) · `body` (scroll) · `foot` (border-top, actions alignées droite).

### Drawer (or-drawer)
```
position: fixed; top 0 right 0 bottom 0
width: 520–560px; max-width 100vw
background: bg
box-shadow: -24px 0 48px -16px rgba(0,0,0,0.18)
animation: drawerSlide 280ms cubic-bezier(0.22, 1, 0.36, 1)
  (from: translateX(100%); to: translateX(0))
z-index: 100
```
Head : `16px padding; border-bottom; background: white` — back button + title + primary action inline.

### Popover
Tooltip-like, white bg, `elev-3`, radius 8, padding 8 12, fontSize 12. Arrow optionnelle.

---

## 7. Badges / Pills / Status dots

### Pill base
```
display: inline-flex; align-items: center; gap: 5px
padding: 3px 9px; border-radius: 12px
font-size: 11px; font-weight: 600
white-space: nowrap
```

### Status pills (commandes)
- `.draft` — bg-subtle / text-muted
- `.sent` — info-soft / info
- `.confirmed` — accent-soft / accent
- `.preparing / .shipped` — warning-soft / warning
- `.delivered` — #DBEAFE / #1E40AF
- `.received` — success-soft / success
- `.dispute` — danger-soft / danger
- `.cancelled` — bg-subtle / text-subtle + line-through

### Dot indicator
`width: 5px; height: 5px; border-radius: 50%; background: currentColor`
Variante `.pulse` : animation `pulseDot 1.5s ease-in-out infinite` (opacity 1 → 0.4 → 1).

### Permission chip (.te-perm-chip)
Chip gris `bg-subtle / text-muted` ; `.admin` → `accent-soft / accent / fw-650`.

### Custom role badge
`bg: accent-soft; color: accent; padding: 2px 6px; border-radius: 10px; font-size: 9.5px; font-weight: 650; text-transform: uppercase; letter-spacing: 0.04em`.

---

## 8. Tabs / Breadcrumbs / Pagination

### Tabs (te-tabs)
```
container: display flex; gap 2px; padding 4px; background bg-subtle; border-radius 9px; width fit-content
item: padding 7px 14px; radius 6px; font-size 12.5px; font-weight 600; color text-muted
item.active: background white; color text; box-shadow elev-1
item .count: background bg-subtle; padding 1px 7px; border-radius 10px; font-size 10.5px; font-family mono
item.active .count: background accent-soft; color accent
```

### Breadcrumbs
Font 12.5px, color `text-muted`, chevron `/` ou `›` 4px horizontal margin, dernier item `color: text; font-weight: 600`.

---

## 9. Toasts / Alerts / Banners

### Toast (à créer côté dev)
```
position: fixed; bottom 24px; right 24px
background: text (dark); color: white
border-radius: 10px; padding: 12px 16px
box-shadow: elev-4
animation: slideUp 280ms, auto-dismiss 4s
z-index: 110
```

### Banner (or-banner)
```
margin: 0 18px; padding 10px 12px
border-radius: 8px
display: flex; gap: 10px; align-items: flex-start
```
Variants : `.danger` (danger-soft / danger), `.warning` (warning-soft / warning), `.info` (info-soft / info), `.muted` (bg-subtle / text-muted).

---

## 10. Tooltips
`background: #1F2937; color: white; padding: 5px 10px; border-radius: 6px; font-size: 11.5px; box-shadow: elev-3; z-index: 120`.

---

## 11. Loaders / Skeletons / Progress

### Spinner 14px
```
border: 2px solid bg-subtle; border-top: 2px solid accent; border-radius: 50%
animation: spin 600ms linear infinite
```

### Skeleton
`background: linear-gradient(90deg, bg-subtle 0%, #EEE 50%, bg-subtle 100%); background-size: 200% 100%; animation: shimmer 1.4s linear infinite`.

### Progress bar
```
track: height 6px; background: bg-subtle; border-radius: 3px
fill: height 100%; background: accent; border-radius: 3px; transition: width 300ms out
```
Variantes de fill : `.good` success, `.ok` warning, `.low` danger.

---

## 12. Empty states
Container centered (padding 60px 20px), icon 32px `opacity: 0.5`, title `14px fw-600`, sub `12px text-subtle`, CTA pill optionnel.

---

## 13. Avatars
- `.te-avatar` : 42×42 radius full, bg color, color white, font-weight 650, font-size 14px, **font-family mono**, letter-spacing -0.02em.
- `.sm` 30×30 11px ; `.lg` 68×68 22px radius 14px.
- Gradient avatar (profile) : `background: linear-gradient(135deg, #6366F1, #8B5CF6)`.

---

## 14. Sidebar / Topbar

### Sidebar (240px)
```
background: white
border-right: 1px solid var(--border)
height: 100vh
overflow-y: auto
```
Sections :
- Brand (logo + name, padding 16 20)
- Section group label (11px uppercase 0.05em tracking, text-subtle, padding 18 20 6 20)
- Nav item (padding 8 20, gap 10, font 13 fw-550, icon 16px, color text-muted)
- Nav item hover : bg bg-subtle, color text
- Nav item active : bg accent-soft, color accent, fw-600 (LEFT 3px accent bar via ::before)

### Topbar (56px)
```
height: 56px
border-bottom: 1px solid var(--border)
background: white
padding: 0 24px
display: flex; align-items: center; gap: 16px
```
Contents : breadcrumbs gauche · spacer · search global · cloche (with dot) · avatar user.

---

## 15. Dropzone (import IA)
```
border: 2px dashed var(--border)
border-radius: 12px
padding: 40px 20px
background: bg-subtle
text-align: center
transition: all 200ms out
```
`.drag-over` : `border-color: accent; background: accent-soft; transform: scale(1.01)`.
Icon 48px text-muted, title 15px fw-600, sub 12px muted, CTA pill centered.

## 16. Steps d'animation IA (5 étapes)
Pattern : liste verticale avec `icon 22px + label + spinner/check`.
Items :
1. Upload  → OCR lecture
2. OCR     → Rapprochement catalogue
3. Match   → Détection changements prix
4. Validation humaine (utilisateur)
5. Prêt    → Import complet

Animation : chaque item passe de `pending` (gris) → `active` (accent + spinner) → `done` (success + check) sur 800ms par étape.
