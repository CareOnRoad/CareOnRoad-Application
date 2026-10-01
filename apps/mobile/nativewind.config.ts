import type { Config } from 'tailwindcss';

/**
 * NativeWind config cho CareOnRoad mobile.
 *
 * Design principles (giữ nhất quán với backend):
 *  - Primary action: brand-blue (#1974f7)
 *  - Background chính: navy (#16202f) cho dark hero, white cho content area
 *  - Success: green (#145413) + mint (#a9ffad) cho highlight
 *  - Destructive / alerts: brand-red (#ed3f3a) / red-500
 *  - Warning: amber-500 (cảnh báo thân thiện)
 *  - Neutrals: tailwind slate/gray (foreground, muted-foreground, border, ...)
 *
 * NativeWind compile các className xuất hiện trong code. Vì một số class được
 * sinh ra linh động (tone variants, opacity modifiers), ta khai báo safelist
 * để đảm bảo chúng không bị strip trong production bundle.
 */

export default {
  content: ['./src/**/*.{ts,tsx}', './app/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Brand palette
        navy: '#16202f',
        green: '#145413',
        mint: '#a9ffad',
        'brand-blue': '#1974f7',
        'brand-red': '#ed3f3a',
        // Semantic (tương thích class `bg-primary`, `text-foreground`, ...)
        primary: '#1974f7',
        'primary-foreground': '#ffffff',
        destructive: '#ed3f3a',
        'destructive-foreground': '#ffffff',
        foreground: '#16202f',
        background: '#ffffff',
        muted: '#f1f5f9',
        'muted-foreground': '#64748b',
        secondary: '#f1f5f9',
        'secondary-foreground': '#16202f',
        card: '#ffffff',
        'card-foreground': '#16202f',
        border: '#e2e8f0',
        input: '#e2e8f0',
        ring: '#1974f7',
      },
      borderRadius: {
        xs: '8px',
        sm: '12px',
        md: '16px',
        lg: '20px',
        xl: '24px',
        '2xl': '32px',
        '3xl': '40px',
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
      },
    },
  },
  safelist: [
    // === Brand semantic colors ===
    'bg-primary',
    'text-primary',
    'bg-primary-foreground',
    'text-primary-foreground',
    'bg-destructive',
    'text-destructive',
    'text-destructive-foreground',
    'border-destructive',
    'bg-destructive/10',

    // === Red palette (alerts / errors) ===
    'bg-red-500',
    'bg-red-500/15',
    'bg-red-500/10',
    'text-red-500',
    'text-red-400',
    'text-red-400/80',
    'border-red-500/40',
    'border-red-500/30',

    // === Amber palette (warnings) ===
    'bg-amber-500/15',
    'bg-amber-500/10',
    'text-amber-500',
    'text-amber-600',
    'text-amber-400',
    'text-amber-400/80',
    'text-amber-700',
    'text-amber-700/80',
    'border-amber-500/40',
    'border-amber-500/30',

    // === Green palette (success / mint) ===
    'bg-green',
    'bg-green/15',
    'bg-green/10',
    'text-green',
    'bg-mint',
    'bg-mint/20',
    'text-mint',
    'border-mint/30',

    // === Navy (hero / dark header) ===
    'bg-navy',
    'bg-navy/10',
    'text-navy',
    'border-navy/20',

    // === Surfaces ===
    'bg-card',
    'text-card-foreground',
    'bg-background',
    'text-foreground',
    'text-muted-foreground',
    'bg-muted',
    'bg-secondary',
    'text-secondary-foreground',
    'border-border',
    'border-input',
    'ring-primary/30',
    'ring-primary/20',
    'ring-white/20',

    // === Overlays ===
    'bg-white/5',
    'bg-white/10',
    'bg-white/15',
    'bg-white/20',
    'bg-black/30',
    'bg-black/40',
    'bg-black/50',
    'bg-navy/30',
    'bg-navy/40',
    'bg-navy/50',

    // === Variant opacities ===
    'bg-primary/5',
    'bg-primary/10',
    'bg-primary/15',
    'bg-primary/20',
    'bg-green/20',
    'bg-destructive/5',
    'bg-destructive/15',
    'bg-amber-500/20',
    'bg-amber-500/40',
    'bg-secondary/30',
    'bg-secondary/40',

    // === Translation utilities (toggle switch) ===
    'translate-x-0.5',
    'translate-x-5',

    // === Active state for clickable list rows ===
    'active:bg-secondary/40',
    'active:bg-secondary/30',
    'active:opacity-60',
  ],
} satisfies Config;
