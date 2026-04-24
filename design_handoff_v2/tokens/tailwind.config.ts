import type { Config } from 'tailwindcss';

/**
 * RestoPilot — Tailwind preset
 * Stack: Next.js 16 App Router + Supabase + TailwindCSS
 *
 * Usage in the target app:
 *   import preset from './design_handoff_v2/tokens/tailwind.config';
 *   export default { presets: [preset], content: [...] };
 *
 * Tokens match tokens.css 1:1. If you change a value here, change it there too.
 */
const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [], // host app fills this in
  theme: {
    extend: {
      colors: {
        bg:            'var(--bg)',
        'bg-subtle':   'var(--bg-subtle)',
        surface:       'var(--surface)',
        'surface-hover': 'var(--surface-hover)',
        border:        'var(--border)',
        'border-strong': 'var(--border-strong)',
        text:          'var(--text)',
        'text-muted':  'var(--text-muted)',
        'text-subtle': 'var(--text-subtle)',
        accent: {
          DEFAULT: 'var(--accent)',
          hover:   'var(--accent-hover)',
          active:  'var(--accent-active)',
          soft:    'var(--accent-soft)',
          softer:  'var(--accent-softer)',
        },
        success:       { DEFAULT: 'var(--success)', soft: 'var(--success-soft)' },
        warning:       { DEFAULT: 'var(--warning)', soft: 'var(--warning-soft)' },
        danger:        { DEFAULT: 'var(--danger)',  soft: 'var(--danger-soft)' },
        info:          { DEFAULT: 'var(--info)',    soft: 'var(--info-soft)' },
        cat: {
          blue:   '#3B82F6', red:    '#EF4444', orange: '#F97316',
          green:  '#10B981', cyan:   '#06B6D4', violet: '#8B5CF6',
          pink:   '#EC4899', amber:  '#F59E0B',
        },
      },
      fontFamily: {
        sans:    ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono:    ['JetBrains Mono', 'SF Mono', 'Menlo', 'Consolas', 'monospace'],
        display: ['Playfair Display', 'Georgia', 'serif'],
      },
      fontSize: {
        xs:   ['11px', { lineHeight: '14px', letterSpacing: '0.04em' }],
        sm:   ['12px', { lineHeight: '16px' }],
        base: ['13px', { lineHeight: '18px' }],
        md:   ['14px', { lineHeight: '20px' }],
        lg:   ['16px', { lineHeight: '22px' }],
        xl:   ['18px', { lineHeight: '24px', letterSpacing: '-0.01em' }],
        '2xl':['22px', { lineHeight: '28px', letterSpacing: '-0.01em' }],
        '3xl':['28px', { lineHeight: '32px', letterSpacing: '-0.02em' }],
        '4xl':['36px', { lineHeight: '40px', letterSpacing: '-0.02em' }],
      },
      fontWeight: {
        normal:   '400', medium: '500', emphasis: '550',
        semibold: '600', strong: '650', bold:     '700',
      },
      spacing: {
        '1': '4px',  '2': '8px',  '3': '12px', '4': '16px', '5': '20px',
        '6': '24px', '8': '32px', '10': '40px','12': '48px','16': '64px',
      },
      borderRadius: {
        xs: '4px', sm: '6px', md: '8px', lg: '10px', xl: '12px',
        '2xl': '14px', '3xl': '20px',
      },
      boxShadow: {
        'elev-1': '0 1px 2px rgba(15, 23, 42, 0.04)',
        'elev-2': '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
        'elev-3': '0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 4px rgba(15, 23, 42, 0.04)',
        'elev-4': '0 12px 28px -8px rgba(15, 23, 42, 0.14), 0 4px 8px rgba(15, 23, 42, 0.06)',
        'elev-5': '0 24px 60px -12px rgba(15, 23, 42, 0.25)',
        ring:     '0 0 0 3px var(--accent-soft)',
      },
      transitionTimingFunction: {
        out:    'cubic-bezier(0.22, 1, 0.36, 1)',
        'in-out':'cubic-bezier(0.65, 0, 0.35, 1)',
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        instant: '80ms', fast: '150ms', base: '200ms',
        slow: '280ms', slower: '420ms',
      },
      zIndex: {
        dropdown:'20', sticky:'30', sidebar:'40', overlay:'80',
        drawer:  '90', modal: '100',toast:  '110',tooltip:'120',
      },
      keyframes: {
        fadeIn:   { '0%':{ opacity:'0' }, '100%':{ opacity:'1' } },
        slideUp:  { '0%':{ opacity:'0', transform:'translateY(6px)' }, '100%':{ opacity:'1', transform:'translateY(0)' } },
        drawerIn: { '0%':{ transform:'translateX(100%)' }, '100%':{ transform:'translateX(0)' } },
        pulseDot: { '0%,100%':{ opacity:'1' }, '50%':{ opacity:'0.4' } },
      },
      animation: {
        'fade-in':   'fadeIn   200ms cubic-bezier(0.22, 1, 0.36, 1)',
        'slide-up':  'slideUp  280ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'drawer-in': 'drawerIn 280ms cubic-bezier(0.22, 1, 0.36, 1)',
        'pulse-dot': 'pulseDot 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
