/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#000000",
        foreground: "#ffffff",
        card: {
          DEFAULT: "#09090b",
          foreground: "#f4f4f5",
          border: "#27272a",
        },
        primary: {
          DEFAULT: "#3b82f6",
          hover: "#2563eb",
          foreground: "#ffffff",
        },
      },
    },
  },
  plugins: [],
};
