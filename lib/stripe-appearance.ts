import type { Appearance } from "@stripe/stripe-js";

export const publicStripeAppearance: Appearance = {
  theme: "flat",
  variables: {
    colorPrimary: "#6a2a86",
    colorBackground: "#fffaf7",
    colorText: "#35143f",
    colorDanger: "#b4233c",
    colorTextSecondary: "#5b3d63",
    colorSuccess: "#1f6f45",
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    borderRadius: "14px",
    spacingUnit: "4px",
  },
  rules: {
    ".Block": {
      backgroundColor: "#fffaf7",
      borderColor: "rgba(87, 31, 108, 0.12)",
      boxShadow: "none",
    },
    ".Input": {
      backgroundColor: "#fffaf7",
      borderColor: "rgba(87, 31, 108, 0.12)",
      boxShadow: "none",
    },
    ".Tab": {
      backgroundColor: "#fffaf7",
      borderColor: "rgba(87, 31, 108, 0.12)",
      boxShadow: "none",
    },
    ".Tab:hover": {
      color: "#35143f",
    },
    ".Tab--selected": {
      backgroundColor: "#6a2a86",
      color: "#fff8f1",
    },
    ".Label": {
      color: "#5b3d63",
      fontWeight: "600",
    },
  },
};
