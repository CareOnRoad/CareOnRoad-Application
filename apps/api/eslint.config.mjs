// import js from "@eslint/js";
// import tseslint from "typescript-eslint";

// export default [
//   {
//     ignores: [".next/**", "coverage/**", "dist/**", "build/**", "node_modules/**", "next-env.d.ts"]
//   },
//   js.configs.recommended,
//   ...tseslint.configs.recommended,
//   {
//     files: ["**/*.{ts,tsx}"],
//     languageOptions: {
//       parserOptions: {
//         projectService: true,
//         tsconfigRootDir: import.meta.dirname
//       }
//     }
//   }
// ];

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";

export default [
  {
    ignores: [".next/**", ".tmp/**", "coverage/**", "dist/**", "build/**", "node_modules/**", "next-env.d.ts"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    // Khai báo trực tiếp plugin Next.js theo chuẩn Flat Config mới
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  }
];
