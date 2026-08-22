import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Flags the standard "loading flag + fetch + setData" pattern used by
      // every data-table in this app (see components/*/[-]table.tsx). That
      // pattern is the documented React approach for fetch-on-mount/on-filter-
      // change and is safe here (no infinite loops, deps are correct); the
      // rule optimizes for patterns this app deliberately doesn't use (e.g.
      // a client cache library).
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
