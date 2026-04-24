# Motion & micro-interactions

## Tokens motion
```
--ease-out:    cubic-bezier(0.22, 1, 0.36, 1)    ← default pour 90% des cas
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)    ← transitions symétriques
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1) ← rebonds légers (modal, toggle)

--dur-instant: 80ms   ← feedback tactile (press)
--dur-fast:    150ms  ← hover, focus, color change
--dur-base:    200ms  ← modal fade, tab switch, dropdown
--dur-slow:    280ms  ← drawer slide, page enter
--dur-slower:  420ms  ← hero enter, onboarding first paint
```

## Animations clés

### 1. Page enter
```css
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.page { animation: fadeInUp 280ms var(--ease-out) both; }
```

### 2. Modal open
Backdrop : `opacity 0 → 1` en 200ms.
Modal : `opacity 0 + scale(0.96) → 1 + scale(1)` en 200ms `var(--ease-out)`.
Close : reverse en 150ms.

### 3. Drawer
Backdrop fadeIn 200ms. Panel : `translateX(100%) → 0` en 280ms `var(--ease-out)`.

### 4. Toggle
Rail bg : 200ms. Dot `left`: 200ms `var(--ease-spring)`.

### 5. Button press
`transform: translateY(1px); box-shadow: inset 0 1px 2px rgba(0,0,0,0.08)` — `var(--dur-instant)`.

### 6. Hover card
`box-shadow: elev-2 → elev-3` + `transform: translateY(-1px)` en 150ms. Retour en 200ms.

### 7. Table row hover
`background: transparent → bg-subtle` en 120ms linear.

### 8. Pulse dot (statut live)
```css
@keyframes pulseDot { 0%,100%{ opacity: 1 } 50%{ opacity: 0.4 } }
animation: pulseDot 1.5s ease-in-out infinite
```

### 9. Skeleton shimmer
```css
background: linear-gradient(90deg, var(--bg-subtle) 0%, #EEE 50%, var(--bg-subtle) 100%);
background-size: 200% 100%;
animation: shimmer 1.4s linear infinite;
@keyframes shimmer { 0%{ background-position: 200% 0 } 100%{ background-position: -200% 0 } }
```

### 10. IA import (5 steps)
Chaque étape : `pending` (gris) → `active` (accent + spinner) pendant 800ms → `done` (success + check scale-in 200ms spring). Total ~4s pour les 5 étapes.

### 11. Focus ring
Apparaît en 80ms : `box-shadow: 0 0 0 0 accent-soft → 0 0 0 3px accent-soft`.

### 12. Progress bar fill
`width: 300ms var(--ease-out)` — jamais instantané.

## Respect de prefers-reduced-motion
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
À mettre dans `globals.css`.
