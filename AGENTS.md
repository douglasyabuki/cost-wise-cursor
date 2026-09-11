<!-- intent-skills:start -->
## Skill Loading

Before editing files for a substantial task:
- Run `npx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `npx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

# AGENTS.md

## Project purpose

Cost Wise Cursor is a Vite React app for comparing DeepSWE and FrontierCode
benchmark performance and efficiency with Cursor model availability and pricing.

## Component organization

- Reserve `src/components/ui/` exclusively for context-free shadcn components.
  Keep application-specific compositions and custom components outside it,
  even when they are reusable.
- Keep benchmark UI under `src/components/benchmarks/`:
  - `deep-swe/` and `frontier-code/` own their dashboards, efficiency-chart
    adapters, and performance rankings.
  - `filters/`, `efficiency/`, and `ranking/` contain components shared across
    benchmarks; `benchmark-changelog.tsx` sits at the benchmark root.
- Keep benchmark-specific data preparation in the consuming benchmark component
  or its domain utility. Shared filters receive prepared options and callbacks.
- Keep shared pure ranking calculations in `src/utils/performance-ranking.ts`
  and shared model colors in `src/utils/model-colors.ts`.
- Keep nesting shallow and retain benchmark prefixes in benchmark-specific
  filenames and component names.

## Conventions

- Prefer `const` arrow functions for components, hooks, event handlers, and
  utilities. Do not introduce `function` declarations for these symbols.
- Add JSDoc to every exported component, hook, utility, and public prop type.
  Document its purpose, parameters, return value, defaults, controlled and
  uncontrolled behavior, and any important accessibility requirements. Use
  `@typedef` for reusable prop objects when it improves clarity.
- Keep each JSDoc block concise and place it immediately above the declaration
  it documents. Group consecutive parameters, props, and options without blank
  comment lines between them. Include a focused example for exported utilities
  when it clarifies their behavior, and a short usage example for each hook.
- Keep component APIs small and composable. Prefer `children`, renderable
  slots, callbacks, and standard DOM props over hard-coded content.
- Preserve semantic HTML, keyboard behavior, focus management, ARIA
  relationships, disabled states, and reduced-motion behavior from the source.
- Keep state local unless the source component requires a controlled API.
  Avoid unnecessary effects and avoid duplicating derived state.
- Prefer state and event handlers in the consuming component, with shared pure
  calculations in `src/utils/`. Do not extract a custom hook merely to hide
  ranking state or combine calculations; utilities must remain free of React hooks.
- Use the `@/` alias for imports that resolve under `src/`.

## Skills guidance

- Use the frontend-design skill when planning, creating or refactoring UI.
- Follow the local shadcn rules for accessible composition, grouped items,
  overlays, forms, icons, and keyboard interaction.
- Avoid changing global shadcn theme tokens to solve a component-local styling need.

## File and naming expectations

- Use kebab-case filenames: `component-name.tsx`
- Export the public component intentionally. Keep implementation helpers
  private unless another component genuinely needs them.
- Remove dead imports, copied comments, temporary examples, and source-specific
  assumptions before finishing.

## Commands

- Install dependencies: `npm install`
- Start development: `npm run dev`
- Lint all of `src/`: `npm run lint`
- Autofix lint issues in `src/`: `npm run lint:fix`
- Build and type-check: `npm run build`

For shadcn operations, use the project-aware CLI and the local skill’s
workflow, for example `npx shadcn@latest info`, `npx shadcn@latest docs
<component>`, or `npx shadcn@latest search`. Do not use the CLI to overwrite
local components without explicit user approval.
