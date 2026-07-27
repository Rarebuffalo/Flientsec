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
        background: "#F7F9F8",
        foreground: "#6B7280",
        primary: "#12372A",
        accent: "#2D8C74",
        charcoal: "#111827",
        success: "#047857",
        warning: "#B45309",
        danger: "#B91C1C",
      },
      boxShadow: {
        premium: "0 12px 30px rgba(0,0,0,0.02)",
      },
      borderRadius: {
        xl: "12px",
        lg: "10px",
      },
    },
  },
  plugins: [],
}
