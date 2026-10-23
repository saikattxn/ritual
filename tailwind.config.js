/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        sage: {
          50: '#f3f6f1', 100: '#e4ebe0', 200: '#c9d7c2', 300: '#a8bf9e',
          400: '#86a47b', 500: '#6a8a5f', 600: '#536f4a', 700: '#42583c',
          800: '#364732', 900: '#2d3b2b',
        },
        cream: { 50: '#fdfbf7', 100: '#faf6ee', 200: '#f3ecdd', 300: '#e9dec7' },
        clay: { 100: '#f6e7dc', 300: '#e2b89a', 500: '#c4835c', 600: '#a96a45', 700: '#8a5536' },
        ink: { 400: '#8a877f', 500: '#6b6860', 700: '#3f3d38', 900: '#24231f' },
      },
      fontFamily: {
        serif: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"DM Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(45,59,43,0.04), 0 4px 16px rgba(45,59,43,0.06)',
        lift: '0 2px 4px rgba(45,59,43,0.06), 0 12px 32px rgba(45,59,43,0.10)',
      },
      borderRadius: { '2xl': '1.25rem', '3xl': '1.75rem' },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(6px)' }, '100%': { opacity: 1, transform: 'none' } },
        pop: { '0%': { transform: 'scale(0.85)' }, '60%': { transform: 'scale(1.08)' }, '100%': { transform: 'scale(1)' } },
      },
      animation: { 'fade-up': 'fade-up .35s ease-out both', pop: 'pop .25s ease-out' },
    },
  },
  plugins: [],
};
