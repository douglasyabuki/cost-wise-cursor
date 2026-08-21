# AGENTS.md

## Project purpose

This Vite app is a transformation workspace for shadcn React components. The
source components live in:

- `src/components/ui/` — TypeScript shadcn components.

## Conventions

- Prefer `const` arrow functions for components, hooks, event handlers, and
  utilities. Do not introduce `function` declarations for these symbols.
- Add JSDoc to every exported component, hook, utility, and public prop shape.
  Document parameters, return values, controlled/uncontrolled behavior,
  defaults, and important accessibility expectations. Use `@typedef` for
  reusable prop objects where helpful.
- Keep component APIs small and composable. Prefer `children`, renderable
  slots, callbacks, and standard DOM props over hard-coded content.
- Preserve semantic HTML, keyboard behavior, focus management, ARIA
  relationships, disabled states, and reduced-motion behavior from the source.
- Keep state local unless the source component requires a controlled API.
  Avoid unnecessary effects and avoid duplicating derived state.
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
