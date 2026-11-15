import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));

// The same four rules the other repositories use. They arrive as plugins, so the
// findings here are the findings everywhere: a duplicate helper, an entity that
// repeats another, a component that repeats another, and code outside the
// architecture this package declares in architecture.yaml.
const followArchitecture = require("@md-code/follow-architecture");
const utilsUniqueness = require("@md-code/utils-uniqueness");
const entitiesUniqueness = require("@md-code/entities-uniqueness");
const componentUniqueness = require("@md-code/component-uniqueness");

const SOURCES = ["board/**/*.{ts,tsx}", "columns/**/*.{ts,tsx}", "rows/**/*.{ts,tsx}", "ribbon/**/*.{ts,tsx}", "surface/**/*.{ts,tsx}", "styles/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "config.ts", "index.ts", "view.tsx"];

// One scan root for every feature: the plugins compare the whole package.
const scan = { root: here, tsconfig: "tsconfig.json" };

export default [
	{ ignores: ["dist/**", "node_modules/**", "reports/**"] },
	...tseslint.configs.recommended.map((config) => ({ ...config, basePath: here, files: SOURCES })),
	{
		basePath: here,
		files: SOURCES,
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: { project: true, tsconfigRootDir: here },
		},
		plugins: {
			"md-code": followArchitecture,
			"md-code-utils": utilsUniqueness,
			"md-code-entities": entitiesUniqueness,
			"md-code-components": componentUniqueness,
		},
		rules: {
			// ── BASE ────────────────────────────────────────────────────────
			// The same floor as the other repositories: nothing implicit, nothing
			// huge, nothing deep. A rule that is not here is a rule nobody applies.
			"no-var": "error",
			"prefer-const": "error",
			"eqeqeq": ["error", "smart"],
			"no-console": "error",
			"no-debugger": "error",
			"no-duplicate-imports": "error",
			"no-implicit-coercion": "error",
			"no-param-reassign": "error",
			"no-else-return": "error",
			"no-lonely-if": "error",
			"no-nested-ternary": "error",
			"max-depth": ["error", 3],
			"max-params": ["error", 4],
			"max-lines": ["error", { max: 200, skipBlankLines: true, skipComments: true }],
			"max-lines-per-function": ["error", { max: 60, skipBlankLines: true, skipComments: true }],
			"complexity": ["error", 10],
			// ── STRICT TYPES, NO ESCAPE HATCH ───────────────────────────────
			// `any` and `unknown` are banned outright: a payload is either typed
			// or `never`, and an assertion may narrow, never launder.
			"@typescript-eslint/no-explicit-any": "error",
			"@typescript-eslint/no-unsafe-assignment": "error",
			"@typescript-eslint/no-unsafe-argument": "error",
			"@typescript-eslint/no-unsafe-call": "error",
			"@typescript-eslint/no-unsafe-member-access": "error",
			"@typescript-eslint/no-unsafe-return": "error",
			"@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
			"@typescript-eslint/no-restricted-types": [
				"error",
				{
					types: {
						unknown: { message: "Unknown is banned: type the payload or use never.", fixWith: "never" },
					},
				},
			],
			// No `any`, in any spelling. An explicit `any` is a decision nobody
			// reviewed; an implicit one is a bug the compiler could not tell us about.
			"@typescript-eslint/no-explicit-any": "error",
			"@typescript-eslint/no-unsafe-assignment": "off",
			"@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
			"@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
			"@typescript-eslint/explicit-module-boundary-types": "error",

			"md-code/follow-architecture": [
				"error",
				{ config: "architecture.yaml", ignoreDirs: ["node_modules", "dist", "reports"], exportPath: "reports/architecture-report.md" },
			],
			"md-code-utils/utils-uniqueness": [
				"error",
				{ ...scan, utilsFolder: ["board", "columns", "rows", "ribbon", "surface", "styles", "components"], exportPath: "reports/utils-catalog.json" },
			],
			"md-code-entities/entities-uniqueness": [
				"error",
				{ ...scan, roots: ["board", "columns", "rows", "ribbon", "surface", "styles", "components"], exportPath: "reports/entities-catalog.json", exclude: [] },
			],
			"md-code-components/component-uniqueness": [
				"error",
				{ ...scan, componentsFolder: ["board", "columns", "rows", "ribbon", "surface", "styles", "components"], exportPath: "reports/component-catalog.json" },
			],
		},
	},
];
