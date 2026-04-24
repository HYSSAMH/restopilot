# Graphiques — specs (à brancher sur Recharts)

> Toutes les couleurs viennent de `tokens.css`. Aucune teinte nouvelle ne doit être introduite côté charts.

## Règles communes
- **Font** : `Inter`, 11.5px, color `text-muted` pour labels/axes.
- **Chiffres** : `JetBrains Mono`, `tabular-nums` pour tooltips et axes.
- **Grid** : `stroke: var(--border); stroke-dasharray: 2 3; vertical: false`.
- **Axes** : `tickLine: false; axisLine: false; tick: { fill: var(--text-muted), fontSize: 11 }`.
- **Tooltip** : bg white, `elev-3`, radius 8, padding 8 12, border `1px solid var(--border)`.
- **Legend** : bottom, `iconSize: 8`, `iconType: "circle"`, font 12 fw-500.
- **Animation** : `animationDuration={280}`, `animationEasing="ease-out"`.

---

## Palette séries
```
series1: #6366F1 (accent)
series2: #10B981 (success)
series3: #F59E0B (warning)
series4: #3B82F6 (cat-blue)
series5: #8B5CF6 (cat-violet)
series6: #EC4899 (cat-pink)
series7: #06B6D4 (cat-cyan)
series8: #F97316 (cat-orange)
```

---

## BarChart (historique achats, CA mensuel, masse salariale)
- `barCategoryGap: "20%"`, `barSize: 24`, `radius={[6, 6, 0, 0]}`.
- Fill : `accent` par défaut ; sur hover bar `accent-hover`.
- Y axis : format `€` ou `k€` selon magnitude (> 10 000 → k).

## LineChart (CA 7j, prix produit 12 mois)
- `strokeWidth: 2`, `dot={{ r: 3, strokeWidth: 2 }}`, `activeDot={{ r: 5 }}`.
- `type="monotone"`.
- Dégradé possible sous la ligne : `<linearGradient>` `accent` à 18% opacity → 0%.

## AreaChart (réservations, affluence)
- `stroke: accent; fillOpacity: 0.18; fill: url(#gradientAccent)`.
- Stacked si multi-séries.

## ScatterChart (BCG matrice produits marge × rotation)
- `shape="circle"`, rayon proportionnel au CA.
- Couleur par quadrant (haut/droite = accent, bas/gauche = danger).
- Ligne médiane `stroke: border-strong; stroke-dasharray: 4 4`.

## PieChart (répartition fournisseurs, catégories dépenses)
- `innerRadius: 60%`, `outerRadius: 85%` (donut).
- `paddingAngle: 2`.
- Légende à droite avec `%` mono.
- Palette `series1..8` dans l'ordre.

## Heatmap (analyse prix)
Pas natif Recharts — construire en SVG manuel : grid 12 × N, cell 40×24 radius 3, couleur :
- baisse forte (>5%) : `success` alpha 0.8
- baisse légère : `success-soft`
- stable : `bg-subtle`
- hausse légère : `warning-soft`
- hausse forte : `danger` alpha 0.8
