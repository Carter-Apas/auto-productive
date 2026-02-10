import lint from "@cartercree/eslint-config/configs/typescript.js";
//change typescript to whatever you are working on
export default [
  ...lint,
  { ignores: ["dist"] },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "func-style": "off",
      "prefer-arrow/prefer-arrow-functions": "off",
      complexity: "off",
      "@typescript-eslint/naming-convention": "off",
    },
  },
  // ...rest of config
];
