import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import html from "eslint-plugin-html";
import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    rules: {
      eqeqeq: "error",
      "no-unused-vars": "error",
      "no-shadow": ["error", { builtinGlobals: true }],
      "no-var": "error",
      "no-use-before-define": ["error", { functions: false }],
      "prefer-const": ["error", { destructuring: "all" }],
      "sort-imports": "error",
    },
  },
  {
    files: ["src/*.js"],
    rules: {
      "func-names": ["error", "never"],
      "func-style": ["error", "declaration"],
      "prefer-const": "off",
    },
    languageOptions: {
      globals: {
        atob: "readonly",
        HTTPServer: "readonly",
        Shelly: "readonly",
        Timer: "readonly",
        print: "readonly",
      },
    },
  },
  {
    files: ["*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["**/*.html"],
    plugins: { html },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  eslintConfigPrettier,
];
