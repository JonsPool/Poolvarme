import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    rules: {
      eqeqeq: "error",
      "func-names": ["error", "never"],
      "func-style": ["error", "declaration"],
      "no-shadow": ["error", { builtinGlobals: true }],
      "no-unused-vars": "error",
      "no-use-before-define": ["error", { functions: false }],
      "no-var": "error",
    },
  },
  {
    languageOptions: {
      globals: {
        Shelly: "readonly",
        Timer: "readonly",
        print: "readonly",
      },
    },
  },
];
