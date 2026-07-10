/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F8FAF8",
        foreground: "#475569",
        card: "#FFFFFF",
        border: "#E2E8F0",
        primary: "#1F8A70",
        muted: "#64748B",
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        heading: "#0F172A",
        darkGreen: "#103B33",
        accent: "#39D98A",
      },
      boxShadow: {
        premium: "0 20px 40px rgba(15,23,42,.06)",
      },
    },
  },
  plugins: [],
}
