import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const config = [
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      // This app relies on effects to load async data into local state.
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default config;
