/** @type {import("prettier").Config} */
const config = {
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "all",
  plugins: ["@ianvs/prettier-plugin-sort-imports", "prettier-plugin-tailwindcss"],
  importOrder: [
    "<BUILTIN_MODULES>",
    "",
    "^react",
    "^next",
    "<THIRD_PARTY_MODULES>",
    "",
    "^@udaman/(.*)$",
    "^@/(.*)$",
    "",
    "^[.]",
  ],
};

export default config;
