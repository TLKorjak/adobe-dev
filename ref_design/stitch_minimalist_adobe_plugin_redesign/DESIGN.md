---
name: Serene Utility
colors:
  surface: '#f7f9fc'
  surface-dim: '#d8dadd'
  surface-bright: '#f7f9fc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f7'
  surface-container: '#eceef1'
  surface-container-high: '#e6e8eb'
  surface-container-highest: '#e0e3e6'
  on-surface: '#191c1e'
  on-surface-variant: '#434749'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f4'
  outline: '#747879'
  outline-variant: '#c3c7c8'
  surface-tint: '#586062'
  primary: '#181f21'
  on-primary: '#ffffff'
  primary-container: '#2d3436'
  on-primary-container: '#959c9f'
  inverse-primary: '#c1c8ca'
  secondary: '#585f64'
  on-secondary: '#ffffff'
  secondary-container: '#dae1e6'
  on-secondary-container: '#5c6468'
  tertiary: '#00212c'
  on-tertiary: '#ffffff'
  tertiary-container: '#183642'
  on-tertiary-container: '#829fae'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde4e6'
  primary-fixed-dim: '#c1c8ca'
  on-primary-fixed: '#161d1f'
  on-primary-fixed-variant: '#41484a'
  secondary-fixed: '#dce3e8'
  secondary-fixed-dim: '#c0c7cc'
  on-secondary-fixed: '#161d20'
  on-secondary-fixed-variant: '#41484c'
  tertiary-fixed: '#c9e7f7'
  tertiary-fixed-dim: '#adcbda'
  on-tertiary-fixed: '#001f2a'
  on-tertiary-fixed-variant: '#2e4b57'
  background: '#f7f9fc'
  on-background: '#191c1e'
  surface-variant: '#e0e3e6'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 12px
---

## Brand & Style

This design system is built for creative professionals who require a focused, distraction-free environment within their plugin ecosystem. The brand personality is **utilitarian, precise, and calm**. It eschews the high-intensity visuals of consumer apps in favor of a "quiet" interface that respects the user's workspace.

The style is a blend of **Minimalism** and **Modern Corporate** aesthetics. It emphasizes legibility through high-contrast typography set against soft, neutral backgrounds. By utilizing generous whitespace and subtle borders, the system achieves a sense of organization without the "heavy" visual weight typical of legacy creative tools.

## Colors

The palette is composed of "quiet colors" designed to prevent eye fatigue during long sessions.

- **Primary:** Dark Charcoal (#2D3436). Used exclusively for text and core actionable icons to ensure maximum contrast and clarity.
- **Secondary:** Muted Blue-Gray (#E1E8ED). Used for subtle borders, secondary buttons, and inactive states.
- **Tertiary:** Slate Blue (#607D8B). Used sparingly for accent states, such as focus indicators or selected menu items.
- **Surface/Neutral:** Off-White/Light Gray (#F5F7FA). The primary background color to provide a clean, expansive canvas.
- **Success/System:** Use a desaturated mint for "Confirm" actions to maintain the muted aesthetic.

## Typography

This design system uses **Inter** as the primary typeface due to its exceptional legibility at small sizes, which is critical for plugin interfaces.

- **Headlines:** Use Semi-Bold weight with tight letter spacing for a structured, professional look.
- **Body:** Standardized at 14px for general use to ensure accessibility within restricted plugin panels.
- **Monospace:** For technical logs or timecode data (as seen in creative tools), use **JetBrains Mono** to ensure alignment and clarity of numerical strings.
- **Hierarchy:** Established primarily through weight and color contrast (Primary Charcoal for headings, Tertiary Slate for secondary metadata).

## Layout & Spacing

The layout philosophy follows a **Fluid Grid** model designed to adapt to the variable widths of plugin sidebars and floating panels.

- **Rhythm:** A 4px baseline grid ensures consistent vertical alignment.
- **Margins:** Standard outer container margin is 16px to prevent content from feeling cramped against the host application UI.
- **Reflow:** Components should stack vertically by default. On wider panels, input fields and labels should adopt a side-by-side configuration using the 12px gutter for separation.
- **Density:** Maintain a "spacious" feel by avoiding tightly packed rows; every logical section should be separated by at least 24px (lg).

## Elevation & Depth

This design system avoids heavy drop shadows, opting instead for **Low-contrast outlines** and **Tonal layers**.

- **Surfaces:** Use a slight color shift (e.g., from #F5F7FA to #FFFFFF) to denote different functional areas like a log output or a settings group.
- **Borders:** Subtle 1px borders in #E1E8ED are the primary method of defining depth.
- **Active State:** When an element is raised (like a modal or a floating tooltip), use an extra-diffused ambient shadow: `0 4px 12px rgba(0, 0, 0, 0.05)`.
- **Interactivity:** On hover, surfaces should slightly lighten rather than darken, maintaining the clean, airy aesthetic.

## Shapes

The shape language is defined by **soft rounded corners** to make the tool feel approachable and modern.

- **Standard Radius:** 8px (0.5rem) for buttons, input fields, and small containers.
- **Large Radius:** 16px (1rem) for main panel containers or secondary cards.
- **Consistency:** All interactive elements must share the same radius to maintain a cohesive visual rhythm.

## Components

### Buttons
- **Primary:** Dark Charcoal background with White text. No shadow, 8px radius.
- **Secondary:** Transparent background with #E1E8ED border and Charcoal text.
- **Icon Buttons:** Use 1px thin-stroke icons (20px size) centered in a 32x32px square hit area.

### Input Fields & Selects
- **Styling:** 1px border (#E1E8ED), 8px radius, White background. 
- **Focus:** 1px border shift to Tertiary Slate (#607D8B) with a soft 2px outer glow of the same color at 10% opacity.

### Lists & Items
- **Items:** 12px padding with a subtle bottom border. Use `mono-sm` for technical data like file paths or timecodes.
- **Hover:** Apply a background tint of #F1F3F5.

### Icons
- **Style:** Thin-stroke (1.5px) line icons.
- **Usage:** Use 'Refresh' for reloading data, 'Upload' for file selection, and a 'Check' for the 'Drop Markers' (confirm) action.

### Chips & Badges
- Used for status indicators (e.g., "17 markers added"). Use a light grey background with Dark Charcoal text for a low-profile look.