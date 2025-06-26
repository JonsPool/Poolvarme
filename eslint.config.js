import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import html from "eslint-plugin-html";
import globals from "globals";

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
    },
  },
  {
    files: ["src/*.js"],
    rules: {
      "func-names": ["error", "never"],
      "func-style": ["error", "declaration"],
      "object-shorthand": ["error", "never"],
      "prefer-const": "off",
    },
    languageOptions: {
      globals: {
        atob: "readonly",
        console: "readonly",
        HTTPServer: "readonly",
        Shelly: "readonly",
        Timer: "readonly",
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
