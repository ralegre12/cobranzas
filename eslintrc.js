module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "prettier"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended", // 👈 integra Prettier
  ],
  rules: {
    "prettier/prettier": "error",
    // Opcional: bloquear console.log
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
};
