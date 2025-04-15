import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
// 覆盖 eslint 本身的规则配置
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
// 用 prettier 来接管修复代码

export default defineConfig([
  tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts}"], plugins: { js }, extends: ["js/recommended"], rules:{
      // ...eslintConfigPrettier,
        "prettier/prettier": "error",
        "no-case-declarations": "off",
        "no-constant-condition": "off",
        "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-explicit-any": "off"
      }
    
  },
  {
    files: ["**/*.{js,mjs,cjs,ts}"], languageOptions: {
      globals: globals.node, parser: tseslint.parser, parserOptions: {
        "ecmaVersion": "latest",
        "sourceType": "module"
      }
    },
  },
  eslintPluginPrettierRecommended
]);