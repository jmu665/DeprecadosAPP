/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: '#DC2626',
                secondary: '#1F1F1F',
                background: '#0A0A0A',
                surface: '#2A2A2A',
                'text-main': '#FFFFFF',
                'text-muted': '#9CA3AF',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
