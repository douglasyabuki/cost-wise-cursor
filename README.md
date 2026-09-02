# Cost Wise Cursor

This application helps Cursor users compare AI models by coding performance and cost efficiency.

The app combines DeepSWE and FrontierCode benchmark results with Cursor's model
catalog and pricing documentation. This makes it easier to answer questions
such as:

- Which high-performing models are available in Cursor?
- How does each model perform across benchmark versions and reasoning efforts?
- How does performance change with reasoning effort?
- Which Cursor models require Max Mode on legacy plans?
- Which models provide the best balance of score and benchmark resource use?

Cost Wise Cursor is an independent comparison tool. It is not affiliated with Cursor,
Datacurve, or any model provider.

## Data sources

### DeepSWE

[DeepSWE](https://deepswe.datacurve.ai/) is a software-engineering benchmark
from Datacurve. It evaluates coding agents on original, long-running engineering
tasks across multiple repositories and languages.

Cost Wise Cursor uses the DeepSWE leaderboard data for:

- Pass@1 performance scores and confidence intervals
- Average cost per completed benchmark task
- Average output-token usage
- Average agent steps
- Model configurations and reasoning-effort levels
- Benchmark versions such as `v1` and `v1.1`

DeepSWE runs models through a common agent harness so its results are useful for
relative comparisons. The reported task cost is specific to the benchmark and
should not be treated as a forecast of the cost of every Cursor request.

Leaderboard data:

- [DeepSWE v1.1 live leaderboard JSON](https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json)
- [DeepSWE v1 live leaderboard JSON](https://deepswe.datacurve.ai/artifacts/v1/leaderboard-live.json)

### FrontierCode

[FrontierCode](https://cognition.com/) is Cognition's coding-agent benchmark.
Cost Wise Cursor loads its official leaderboard document from:

- [FrontierCode leaderboard JSON](https://cognition.com/data/frontiercode-leaderboard/data.json)

The app requests this document through the same-origin browser route
`/frontier-code/data/frontiercode-leaderboard/data.json`. In development,
`vite.config.ts` proxies `/frontier-code/*` to `https://cognition.com/*`. In
production, `vercel.json` rewrites the same browser-facing path to
`https://cognition.com/data/frontiercode-leaderboard/data.json`. The service
always uses the local route and never fetches Cognition directly from the
browser.

The FrontierCode dashboard fetches both `v1.1` and `v1` once, then selects the
version and subset locally. Its controls include `Main (100)` and
`Extended (150)`, Best or All effort levels, and Score or Cost Efficiency
ranking.

FrontierCode fields are mapped as follows:

| FrontierCode field | Dashboard meaning     |
| ------------------ | --------------------- |
| `new_score`        | FrontierCode score    |
| `correct`          | Pass rate             |
| `cost`             | Benchmark cost in USD |
| `flagged_rate`     | Optional flagged rate |

FrontierCode scores and DeepSWE Pass@1 scores are different benchmark
measures. They should be compared within their own dashboard, not treated as
the same metric.

### Cursor models and pricing

[Cursor's Models & Pricing documentation](https://cursor.com/docs/models-and-pricing)
describes the models available through Cursor, their token prices, usage pools,
and relevant access notes.

Cost Wise Cursor uses this documentation for:

- Cursor model names and providers
- Input-token prices per million tokens
- Cache-write and cache-read prices per million tokens
- Output-token prices per million tokens
- Cursor Models and Other Models availability
- Notes about legacy Max Mode and other pricing conditions

Cursor pricing is not a single flat model price. Input, cached input, cache
writes, and output can have different rates. Cursor also separates some models
into different usage pools. Refer to the official documentation before making a
billing decision.

## How the data is combined

Each benchmark and Cursor use different naming formats. For example:

| DeepSWE            | Cursor             |
| ------------------ | ------------------ |
| `gpt-5-6-luna`     | `GPT-5.6 Luna`     |
| `claude-opus-5`    | `Claude Opus 5`    |
| `gemini-3-7-flash` | `Gemini 3.7 Flash` |

The matching pipeline for either benchmark:

1. Fetches the selected benchmark data through its same-origin route.
2. Fetches and parses Cursor's model-pricing documentation.
3. Normalizes capitalization, punctuation, spacing, and version separators.
4. Tries an exact normalized match.
5. Applies explicit aliases for known naming differences.
6. Tries a token-order match while preserving model-version order.
7. Rejects ambiguous matches instead of guessing.

This produces leaderboard rows with optional Cursor metadata. Unmatched models
remain available in the general leaderboard but are excluded by Cursor-only
filters.

## Filters and visualizations

### Benchmark tabs and filters

DeepSWE and FrontierCode are separate top-level tabs, with DeepSWE selected by
default. Each tab keeps its own benchmark description, version controls,
configuration filters, source status, comparison chart, and ranking. Changing
a version, subset, model, or reasoning-effort level updates both visualizations
in that tab.

DeepSWE has `v1` and `v1.1` version controls. FrontierCode has the same version
controls plus `Main (100)` and `Extended (150)` subset controls.

The configuration menu supports individual models and reasoning-effort levels,
plus these Cursor-specific presets:

- **Cursor models** — matched models whose base configuration is not marked as
  requiring legacy Max Mode.
- **Cursor models [MAX included]** — all matched Cursor models, including models
  marked as requiring legacy Max Mode.

These filters reflect notes parsed from Cursor's documentation. They do not
inspect your Cursor account, plan, or local settings.

### DeepSWE efficiency chart

The efficiency chart plots DeepSWE score against one of these metrics:

- Average cost per task
- Average output tokens
- Average agent steps

Configurations belonging to the same model are connected. Hovering or pinning
a configuration highlights its model family and shows its exact axis values.
Changing the benchmark version resets chart focus while preserving the selected
efficiency metric.

### FrontierCode comparison chart

The FrontierCode chart plots `new_score × 100` on the vertical axis as
**FrontierCode score** and benchmark cost on the horizontal axis. Higher scores
appear farther up, and lower costs appear on the right. The `most efficient ↗`
cue identifies the upper-right direction. Reasoning-effort configurations
belonging to the same model remain connected.

### Performance ranking chart

The performance ranking chart uses the same filtered configurations and benchmark
version as the efficiency chart.

The configuration-detail control provides two views:

- **Best** — shows the highest available reasoning-effort configuration for
  each selected model. Pass@1 breaks ties at the same effort level.
- **All effort levels** — shows every selected configuration.

The ranking-metric control determines how those configurations are ordered:

- **Performance** — orders configurations by Pass@1.
- **Cost efficiency** — orders configurations by Pass@1 percentage points per
  DeepSWE benchmark dollar.

Cost efficiency is calculated as:

```text
(Pass@1 × 100) ÷ average DeepSWE task cost
```

For example, a configuration with 80% Pass@1 and an average benchmark cost of
$2 scores 40 Pass@1 points per dollar. Configurations without usable cost data
appear last when this ranking is selected.

Each row shows Pass@1, its confidence interval, average benchmark cost, cost
efficiency, average output tokens, and average agent steps. The ranking has no
separate model or benchmark-version filter, which keeps both visualizations in
sync.

The cost-efficiency score uses DeepSWE's observed benchmark cost. It is not an
estimate of the cost of running the model in Cursor.

FrontierCode's ranking supports Score and Cost Efficiency ordering. It does not
show confidence intervals because the source does not provide confidence bounds.
Its Best view selects the configuration with the highest `new_score` for each
model, using reasoning effort as a tie-breaker. FrontierCode ranking rows show
FrontierCode score, pass rate, average benchmark cost, cost efficiency,
reasoning effort, harness, and flagged rate when available.

## Tech stack

- [Vite](https://vite.dev/) and React
- TypeScript
- [TanStack Query](https://tanstack.com/query/latest) for fetching, caching, and
  request cancellation
- [Recharts](https://recharts.org/) for the efficiency chart
- [shadcn/ui](https://ui.shadcn.com/) components
- Tailwind CSS
- Vercel for deployment

## Running locally

Requirements:

- A recent Node.js LTS release
- npm, pnpm, yarn, or another compatible package manager

Using npm:

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

Then preview it locally:

```bash
npm run preview
```

## Proxies and deployment

The application fetches data from domains that differ from the app's origin.
Direct browser requests can be blocked by CORS, so the app uses same-origin
proxy routes:

| Local route        | Upstream source                  |
| ------------------ | -------------------------------- |
| `/cursor-docs/*`   | `https://cursor.com/*`           |
| `/deep-swe/*`      | `https://deepswe.datacurve.ai/*` |
| `/frontier-code/*` | `https://cognition.com/*`        |

Vite's `server.proxy` only applies to the development server. A production
deployment needs equivalent Vercel rewrites or serverless proxy endpoints.

The Vite development proxy for FrontierCode maps `/frontier-code` to
`https://cognition.com` and strips the local prefix. The Vercel production
rewrite maps `/frontier-code/data/frontiercode-leaderboard/data.json` to
`https://cognition.com/data/frontiercode-leaderboard/data.json`.

Keep the browser-facing paths stable so the service layer works in both local
development and production.

## Data freshness and limitations

- Cursor's pricing page is documentation, not a versioned public pricing API.
  Its headings, tables, notes, and URLs can change.
- DeepSWE leaderboard files can add models, configurations, fields, or benchmark
  versions.
- Model matching is conservative. A newly renamed model can remain unmatched
  until its normalization or alias is updated.
- DeepSWE performance and cost are measured with its benchmark harness, not
  Cursor's agent implementation.
- DeepSWE average task cost describes benchmark runs. Actual Cursor usage varies
  with prompt size, cached tokens, generated output, tools, reasoning effort,
  context length, plan rules, and pricing changes.
- Cursor's per-token prices are reference metadata and should not be interpreted
  as the cost DeepSWE observed during its benchmark runs.
- FrontierCode score and pass-rate values come from Cognition's published
  benchmark data and can change when the upstream document changes.
- Max Mode labels are informational. Always check the current Cursor docs and
  your account settings before assuming a model or mode is available.

The UI reports each data source independently. If one source fails, the status
control identifies it and allows a separate retry.

## Project goal

Cost Wise Cursor does not try to declare one model universally best. Its goal
is to make the trade-offs visible so you can filter Cursor-compatible models
and pick the level of performance, cost, and agent usage that fits your work.

## Attribution

All benchmark results and methodology belong to
[Datacurve/DeepSWE](https://deepswe.datacurve.ai/). Model availability, pricing,
and plan details belong to
[Cursor](https://cursor.com/docs/models-and-pricing). Model names and trademarks
belong to their respective owners. FrontierCode data and methodology belong to
[Cognition](https://cognition.com/).
