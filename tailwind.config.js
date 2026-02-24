export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "'Avenir Next'", "ui-sans-serif", "system-ui"]
      },
      colors: {
        eco: {
          50: "#ecf8f4",
          100: "#d5f0e8",
          500: "#1f8a67",
          700: "#136e52"
        }
      },
      boxShadow: {
        glass: "0 14px 34px rgba(8, 24, 28, 0.14)",
        floating: "0 20px 42px rgba(9, 20, 24, 0.18)"
      },
      backdropBlur: {
        xxl: "28px"
      }
    }
  },
  plugins: []
};
