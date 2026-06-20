/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: '#1A1A2E',
        secondary: '#1A1D24',
        accent: '#16C784',
        accentRed: '#EA3943',
        background: '#0F1115',
        gold: '#FFD700',
        goldText: '#F5B300',
      }
    },
  },
  plugins: [],
}

