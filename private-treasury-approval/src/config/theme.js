const breakpoints = ["640px", "768px", "992px"];

const baseTheme = {
  fonts: {
    default:
      '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
    code: 'ui-monospace,Menlo,Monaco,"Cascadia Mono","Segoe UI Mono","Roboto Mono",monospace',
  },
  fontSizes: {
    heading: "3.2rem",
    mobileHeading: "2.4rem",
    title: "1.8rem",
    large: "1.4rem",
    text: "1rem",
    small: "0.9rem",
  },
  mediaQueries: {
    small: `@media screen and (max-width: ${breakpoints[0]})`,
    medium: `@media screen and (min-width: ${breakpoints[1]})`,
    large: `@media screen and (min-width: ${breakpoints[2]})`,
  },
  shadows: {
    default: "0px 16px 50px rgba(0, 0, 0, 0.16)",
  },
};

export const light = {
  colors: {
    background: {
      default: "#EEF2FF",
      content: "#FFFFFF",
      alternative: "#F5F7FF",
    },
    text: {
      default: "#0F172A",
      muted: "#475569",
      inverse: "#FFFFFF",
    },
    primary: {
      default: "#1E29F6",
      hover: "#1520C7",
      inverse: "#FFFFFF",
    },
    secondary: {
      default10: "rgba(30, 41, 246, 0.08)",
    },
    card: {
      default: "rgba(255, 255, 255, 0.96)",
    },
    border: {
      default: "rgba(15, 23, 42, 0.12)",
    },
    error: {
      default: "#DC2626",
      default10: "rgba(220, 38, 38, 0.12)",
    },
    success: {
      default: "#15803D",
      default10: "rgba(21, 128, 61, 0.12)",
    },
    warning: {
      default: "#B45309",
      default10: "rgba(180, 83, 9, 0.12)",
    },
  },
  ...baseTheme,
};
