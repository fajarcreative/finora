---
name: Modern Financial Balance
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#3d4a42'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#6d7a72'
  outline-variant: '#bccac0'
  surface-tint: '#006c4a'
  primary: '#006948'
  on-primary: '#ffffff'
  primary-container: '#00855d'
  on-primary-container: '#f5fff7'
  inverse-primary: '#68dba9'
  secondary: '#ba0035'
  on-secondary: '#ffffff'
  secondary-container: '#e21e49'
  on-secondary-container: '#fffbff'
  tertiary: '#006194'
  on-tertiary: '#ffffff'
  tertiary-container: '#007bb9'
  on-tertiary-container: '#fdfcff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#85f8c4'
  primary-fixed-dim: '#68dba9'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#005137'
  secondary-fixed: '#ffdada'
  secondary-fixed-dim: '#ffb3b6'
  on-secondary-fixed: '#40000c'
  on-secondary-fixed-variant: '#920028'
  tertiary-fixed: '#cce5ff'
  tertiary-fixed-dim: '#93ccff'
  on-tertiary-fixed: '#001d31'
  on-tertiary-fixed-variant: '#004b73'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  numeric-hero:
    fontFamily: Plus Jakarta Sans
    fontSize: 34px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.03em
  numeric-table:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system is tailored for an intuitive personal finance and wealth-tracking platform designed to empower individuals with mindful budgeting, expense monitoring, and fiscal growth.

### Target Audience & Personality
The platform speaks to modern professionals, mindful savers, and independent creators who require immediate clarity over daily cash flows along with analytical depth. The visual narrative is serene, precise, disciplined, and encouraging. It dispels financial anxiety through composed spacing, surgical typography, and definitive color coding that removes guesswork.

### Design Style: Modern Financial Precision
The aesthetic blends **Modern Functionalism** with **Analytical Tactility**:
- Crisp, calm neutral slate backdrops reduce visual noise, allowing critical numeric metrics and trends to command attention.
- Clean linear borders with subtle diffuse ambient shadows provide gentle separation between accounts, cards, and daily ledger feeds without visual clutter.
- Purposeful chromatic signaling anchors the experience: an organic, trustworthy forest emerald denotes inflows and positive liquidity, while a disciplined rose-crimson signals outflows and budgetary alerts.

## Colors

The palette delivers unambiguous financial hierarchy, high legibility under varying lighting conditions, and strict adherence to accessibility standards (WCAG AAA for text, AA for interactive graphics).

### Roles & Palettes
- **Primary (`#059669` - Emerald / Growth):** Reserved for income, cash inflows, positive delta indicators, total wealth balances, and primary confirmations.
- **Secondary (`#E11D48` - Rose / Debits):** Systematically applied to expenses, outgoing transfers, negative trends, debt obligations, and high-priority budget overruns.
- **Tertiary (`#0284C7` - Slate Blue / Analytics):** Used for analytical insights, investment projections, linked accounts, export actions, and interactive charts.
- **Neutral Primary (`#0F172A` - Deep Slate):** Grounded text, strong numbers, tabular headers, and critical micro-copy.
- **Backgrounds & Canvas:**
  - Base Canvas: `#F8FAFC` (Slate 50)
  - Surface Containers / Cards: `#FFFFFF` (Pure White)
  - Elevated Popovers & Drawers: `#FFFFFF`
  - Subtle Structural Borders: `#E2E8F0` (Slate 200)
  - Ghost & Disabled States: `#94A3B8` (Slate 400)

## Typography

The type system is powered by **Plus Jakarta Sans**, marrying geometric clarity with sculpted terminals that keep dense financial figures crisp and legible.

### Typographic Principles
- **Tabular Figures:** Always apply `font-variant-numeric: tabular-nums` to transaction lists, currency symbols, and statistical tables to prevent shifting baselines across variable sums.
- **Hierarchy:** Balance values use `numeric-hero` with high contrast against the neutral slate canvas. Section groupings depend on `headline-sm` with muted uppercase `label-sm` subtitles for context.
- **Mobile Readability:** Display headers scale dynamically on compact screens to maintain high visual impact without truncating long balance amounts.

## Layout & Spacing

The layout model emphasizes readability, scannability, and thumb-friendly interaction patterns.

### Grid & Adaptation
- **Mobile (Phone):** 4-column fluid layout with `margin-mobile` (16px) margins and `gutter-mobile` (12px) gutters. Financial records utilize full-width list items with internal compact padding.
- **Tablet:** 8-column layout with 24px margins. Divides viewports into split-pane master/detail views (e.g., account list on the left, daily transactions on the right).
- **Desktop:** 12-column fixed-max layout (max-width: 1200px) centered with 32px margins. Dashboard cards snap into 4-column or 6-column arrangements.

### Spacing Rhythm
- Standard spacing follows a geometric 4px/8px scale.
- Compact components (chips, transaction metadata, tag badges) use `space-xs` and `space-sm`.
- Card internal paddings rely on `space-md` for mobile and `space-lg` for desktop.

## Elevation & Depth

This design system avoids heavy shadows, instead using **tonal layering combined with soft, ambient, slate-tinted diffusion** and fine borders to establish hierarchy.

### Depth Hierarchy
1. **Level 0 (Base Canvas):** `#F8FAFC`. Flat, foundation layer for screens and pages.
2. **Level 1 (Card & Section Containers):** `#FFFFFF` background with a crisp border: `1px solid #E2E8F0` and subtle ambient lift: `0px 1px 3px rgba(15, 23, 42, 0.04), 0px 4px 8px rgba(15, 23, 42, 0.02)`.
3. **Level 2 (Interactive Floating Actions, Bottom Sheets, & Pickers):** `#FFFFFF` with `0px 8px 24px rgba(15, 23, 42, 0.08)`.
4. **Level 3 (Modal Dialogs & Crucial Prompts):** `#FFFFFF` with `0px 16px 36px rgba(15, 23, 42, 0.12)`.

### Border Discipline
Every elevated layer maintains an inner line definition via a 1px solid border in `#E2E8F0` or `#F1F5F9`. This guarantees separation regardless of screen calibration or brightness level.

## Shapes

The shape system adopts a **Rounded (`2`)** profile. It gives corners a warm, modern feel while preserving structural discipline for data-dense tables and financial summaries.

### Corner Radii Guidelines
- **Small UI & Indicators (`rounded`, 8px):** Category badge tags, search fields, quick filter pills, and small input fields.
- **Standard Surfaces (`rounded-lg`, 16px):** Primary ledger cards, budget goal cards, and expandable account accordions.
- **Floating Containers (`rounded-xl`, 24px):** Bottom sheets, modal dialogs, and navigation bottom bars.
- **Pills (`rounded-full`):** Category tags, status pills, and transaction action chips.

## Components

### Buttons
- **Primary (Deposit/Confirmation):** `#059669` emerald fill, white typography, `rounded` (8px), height 44px (touch target: 48px). Hover: `#047857`. Focus: ring 3px `#A7F3D0`.
- **Secondary / Action Outflow:** Border `1px solid #E11D48`, text `#E11D48`, transparent background. On tap: tint with `#FFF1F2`.
- **Ghost / Neutral:** Text `#0F172A`, transparent background, hover `#F1F5F9`.

### Badges & Category Chips
- **Income Badge:** Light emerald tint `#ECFDF5`, text `#047857`, border `1px solid #A7F3D0`, `rounded-full`, typography `label-sm`.
- **Expense Badge:** Light rose tint `#FFF1F2`, text `#BE123C`, border `1px solid #FECDD3`, `rounded-full`, typography `label-sm`.
- **Export & Utility Tags (.CSV, .XLSX, Filtered):** Light slate background `#F1F5F9`, text `#334155`, border `1px solid #CBD5E1`.

### Data Cards & Transaction Rows
- **Transaction Card Row:** Border-bottom `1px solid #F1F5F9`, padding `space-md` vertically. Left side: 40px rounded avatar with category icon. Middle: Merchant/Description with `body-md` bold, timestamp in `body-sm` muted slate. Right side: `numeric-table` aligned right, colored `#059669` (positive prefix "+") or `#E11D48` (negative prefix "-").
- **Metric Cards (KPIs):** White surface container, `rounded-lg`, 1px border `#E2E8F0`, containing category label (`label-md`), metric balance (`numeric-hero`), and sub-label with inline delta tag.

### Inputs & Numeric Keypads
- **Form Inputs:** Border `1px solid #CBD5E1`, background `#FFFFFF`, text `#0F172A`, placeholder `#94A3B8`, focus border `#059669` with 3px `#D1FAE5` halo.
- **Currency Quick-Input Display:** Borderless, centered `numeric-hero` displaying live currency symbol (`Rp`, `$`, `€`) prefixed in `#94A3B8` with numeric entries in `#0F172A`.

### Checkboxes, Radio Buttons & Segmented Controls
- **Radio / Selection:** Accent color `#059669`. Smooth ring transition on focus.
- **Segmented Time Range Switcher (Day / Week / Month / Year):** Slate `#F1F5F9` background rail, 4px inset padding, active slide indicator in `#FFFFFF` with Level 1 shadow and bold text.