# Design System Guidelines

This document details the visual rules, typography, and styling tokens for the FlientSec platform to maintain consistent design quality.

---

## 1. Locked Color Palette

All components must adhere strictly to these 5 colors:

- **Primary Dark Green:** `#12372A` (dominant backgrounds, header text)
- **Primary Teal/Green Accent:** `#2D8C74` (pills, active links, primary CTA buttons)
- **Soft Background Gray-Green:** `#F7F9F8` (main page background segments)
- **Dark Charcoal Text:** `#111827` (headings and high-contrast labels)
- **Muted Slate Gray:** `#6B7280` (body descriptions and subtext)

*Status Indicators:* Red (`#EF4444`) and Amber (`#F59E0B`) are reserved strictly for security compliance states (PASS/FAIL/WARN).

---

## 2. Typography Sizing Scale

- **Eyebrow Tags:** `text-xs` (12px) to `text-sm` (13px), `font-semibold` (600), uppercase, wide letter-spacing (`tracking-widest`).
- **Main Section Titles:** `text-4xl md:text-5xl lg:text-6xl` (52-60px), `font-extrabold` (800) or `font-black` (900).
- **Paragraphs / Section Subheadings:** `text-lg` to `text-xl` (20px), `font-normal` (400), leading-relaxed.
- **Body Text:** `text-base` to `text-lg` (17-18px) to establish authority and readability.

---

## 3. Borders, Shadows, and Padding

- **Border Radius:**
  - Cards & mockups: `rounded-xl` (12px).
  - Buttons & input actions: `rounded-lg` (10px).
  - Badge chips & tags: `rounded-full`.
- **Borders:** Subtle gray (`slate-200`), never darker than `slate-300`.
- **Shadows:** Extremely soft (`shadow-sm` or custom `shadow-[0_20px_40px_rgba(15,23,42,.04)]`). Avoid oversized floating styles.
- **Card Padding:** Consistent inner padding (`p-6` or `p-8`).

---

## 4. Spacing & Density

- **Section Spacing:** Generous padding of `py-28` (112px) on desktop, `py-20` (80px) on tablet, and `py-16` (64px) on mobile.
- **Grid Gaps:** Unified gap of `gap-10` (40px) or `gap-12` (48px) for consistent whitespace gutters.
- **Consistent Visual Density:** Avoid extremely sparse viewports followed by dense tables. Balance information depth across sections.
- **Container Boundaries:** Main content container width capped at `max-w-7xl`, and centered header text containers restricted to `max-w-3xl`.
