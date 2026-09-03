import { useQuery } from "@tanstack/react-query";
import {
  CheckIcon,
  CircleCheck,
  CircleXIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useState } from "react";

import { DeepSweLeaderboardDashboard } from "@/components/dashboard/deep-swe-leaderboard-dashboard";
import { FrontierCodeLeaderboardDashboard } from "@/components/dashboard/frontier-code-leaderboard-dashboard";
import { LogoMark } from "@/components/logo-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CursorService } from "@/services/cursor";
import { DeepSweService } from "@/services/deep-swe";
import { FrontierCodeService } from "@/services/frontier-code";
import type { DeepSweVersion } from "@/types-and-constants/deep-swe";
import type {
  FrontierCodeSubset,
  FrontierCodeVersion,
} from "@/types-and-constants/frontier-code";

interface DataSourceStatusProps {
  error: unknown;
  isPending: boolean;
  label: string;
  onRetry: () => void;
}

type BenchmarkId = "deep-swe" | "frontier-code";

const benchmarkOptions = [
  {
    id: "deep-swe",
    label: "DeepSWE",
    description:
      "Original, long-horizon engineering tasks across diverse repositories, verified by software behavior.",
    logo: "deep-swe",
  },
  {
    id: "frontier-code",
    label: "FrontierCode",
    description:
      "A mergeability benchmark: would a maintainer actually merge the change?",
    logo: "frontier",
  },
] as const;

/**
 * Returns a readable error message.
 *
 * @param error - Error returned by a query.
 * @returns A readable error message.
 */
const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Could not load data";

/**
 * Displays the state of an individual data source.
 *
 * @param props - Data source query state.
 * @returns A status element for the data source.
 */
const DataSourceStatus = ({
  error,
  isPending,
  label,
  onRetry,
}: DataSourceStatusProps) => {
  const hasError = error != null;

  if (isPending) {
    return (
      <Badge
        aria-label={`${label}: Loading`}
        className="h-8 gap-2 rounded-full px-3"
        role="status"
        variant="secondary"
      >
        <Spinner aria-hidden="true" />
        <span>{label}</span>
      </Badge>
    );
  }

  if (hasError) {
    const errorMessage = getErrorMessage(error);

    return (
      <Button
        aria-label={`${label}: ${errorMessage}. Retry`}
        className="border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10 hover:text-destructive h-8 gap-2 rounded-full px-3 shadow-none"
        onClick={onRetry}
        size="sm"
        title={`${errorMessage}. Click to retry.`}
        type="button"
        variant="outline"
      >
        <CircleXIcon aria-hidden="true" />
        <span>{label}</span>
        <span aria-hidden="true" className="bg-destructive/30 h-4 w-px" />
        <RotateCcwIcon aria-hidden="true" />
      </Button>
    );
  }

  return (
    <Badge
      aria-label={`${label}: Ready`}
      className="h-8 gap-2 rounded-full px-3"
      role="status"
      variant="secondary"
    >
      <CircleCheck aria-hidden="true" className="text-[var(--color-success)]" />
      <span>{label}</span>
    </Badge>
  );
};

/**
 * Displays the benchmark dashboards and their independent data-source states.
 *
 * DeepSWE is the default benchmark. Query results remain cached while the user
 * switches benchmarks, versions, or FrontierCode subsets.
 *
 * @returns The main application content.
 */
export const HomePage = () => {
  const [benchmark, setBenchmark] = useState<BenchmarkId>("deep-swe");
  const [deepSweVersion, setDeepSweVersion] = useState<DeepSweVersion>("v1.1");
  const [frontierCodeVersion, setFrontierCodeVersion] =
    useState<FrontierCodeVersion>("v1.1");
  const [frontierCodeSubset, setFrontierCodeSubset] =
    useState<FrontierCodeSubset>("main");

  const deepSweQuery = useQuery(DeepSweService.getLeaderboard(deepSweVersion));
  const frontierCodeQuery = useQuery(FrontierCodeService.getLeaderboard());
  const cursorQuery = useQuery(CursorService.getModelPrices());

  return (
    <div className="container">
      <div className="mb-10 flex flex-col gap-4 border-b pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-3xl leading-tight font-semibold tracking-tight">
            Cost Wise Cursor
          </h1>
          <p className="text-muted-foreground mt-2 text-sm leading-6 sm:text-base">
            Compare models available in Cursor across coding benchmarks, with
            performance, cost efficiency, and reasoning effort side by side.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <h2
            className="text-xl leading-tight font-semibold tracking-tight"
            id="benchmark-picker-heading"
          >
            Choose a benchmark
          </h2>
          <p className="text-muted-foreground mt-1 text-sm leading-6">
            Start with the view that matches the question you want to answer.
          </p>
        </div>

        <div
          aria-labelledby="benchmark-picker-heading"
          className="flex w-auto max-w-max flex-col gap-4 md:grid md:grid-cols-2 xl:grid-cols-3"
          role="group"
        >
          {benchmarkOptions.map((option) => {
            const isSelected = benchmark === option.id;

            return (
              <Button
                aria-pressed={isSelected}
                className="h-auto min-h-32 items-start justify-between gap-4 rounded-xl px-4 py-4 text-left whitespace-normal active:not-aria-[haspopup]:!translate-y-0"
                key={option.id}
                onClick={() => setBenchmark(option.id)}
                type="button"
                variant={isSelected ? "secondary" : "outline"}
              >
                <span className="flex min-w-0 flex-1 items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="bg-muted text-foreground mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg"
                  >
                    <LogoMark
                      alt=""
                      className="size-5 object-contain"
                      name={option.logo}
                    />
                  </span>
                  <span className="flex min-w-0 flex-col items-start gap-1">
                    <span className="font-semibold">{option.label}</span>
                    <span className="text-muted-foreground text-xs leading-5 font-normal">
                      {option.description}
                    </span>
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="border-border mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border"
                >
                  {isSelected && <CheckIcon />}
                </span>
              </Button>
            );
          })}
        </div>

        {benchmark === "deep-swe" && (
          <div>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl leading-tight font-semibold tracking-tight">
                  DeepSWE leaderboard
                </h2>
                <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
                  Compare agent coding performance with observed benchmark cost,
                  token use, and reasoning effort.
                </p>
              </div>

              <div
                aria-label="DeepSWE data source status"
                className="flex flex-wrap gap-2"
              >
                <DataSourceStatus
                  error={deepSweQuery.error}
                  isPending={deepSweQuery.isPending}
                  label="DeepSWE"
                  onRetry={() => void deepSweQuery.refetch()}
                />
                <DataSourceStatus
                  error={cursorQuery.error}
                  isPending={cursorQuery.isPending}
                  label="Cursor pricing"
                  onRetry={() => void cursorQuery.refetch()}
                />
              </div>
            </div>

            {deepSweQuery.isPending && (
              <div
                className="border-border text-muted-foreground flex min-h-96 items-center justify-center border text-sm"
                role="status"
              >
                Loading DeepSWE leaderboard…
              </div>
            )}

            {deepSweQuery.isError && (
              <div
                className="border-destructive/50 bg-destructive/5 flex min-h-48 flex-col items-center justify-center gap-3 border p-6 text-center"
                role="alert"
              >
                <div>
                  <p className="font-medium">
                    Could not load the DeepSWE leaderboard
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {getErrorMessage(deepSweQuery.error)}
                  </p>
                </div>
                <Button
                  onClick={() => void deepSweQuery.refetch()}
                  type="button"
                  variant="outline"
                >
                  Try again
                </Button>
              </div>
            )}

            {deepSweQuery.isSuccess && (
              <DeepSweLeaderboardDashboard
                cursorModelPrices={cursorQuery.data}
                leaderboard={deepSweQuery.data}
                onVersionChange={setDeepSweVersion}
                version={deepSweVersion}
              />
            )}
          </div>
        )}

        {benchmark === "frontier-code" && (
          <div>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl leading-tight font-semibold tracking-tight">
                  FrontierCode dashboard
                </h2>
                <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-6">
                  Explore Cognition’s FrontierCode score and benchmark-cost
                  trade-offs.
                </p>
              </div>

              <div
                aria-label="FrontierCode data source status"
                className="flex flex-wrap gap-2"
              >
                <DataSourceStatus
                  error={frontierCodeQuery.error}
                  isPending={frontierCodeQuery.isPending}
                  label="FrontierCode"
                  onRetry={() => void frontierCodeQuery.refetch()}
                />
                <DataSourceStatus
                  error={cursorQuery.error}
                  isPending={cursorQuery.isPending}
                  label="Cursor pricing"
                  onRetry={() => void cursorQuery.refetch()}
                />
              </div>
            </div>

            {frontierCodeQuery.isPending && (
              <div
                className="border-border text-muted-foreground flex min-h-96 items-center justify-center border text-sm"
                role="status"
              >
                Loading FrontierCode leaderboard…
              </div>
            )}

            {frontierCodeQuery.isError && (
              <div
                className="border-destructive/50 bg-destructive/5 flex min-h-48 flex-col items-center justify-center gap-3 border p-6 text-center"
                role="alert"
              >
                <div>
                  <p className="font-medium">
                    Could not load the FrontierCode leaderboard
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {getErrorMessage(frontierCodeQuery.error)}
                  </p>
                </div>
                <Button
                  onClick={() => void frontierCodeQuery.refetch()}
                  type="button"
                  variant="outline"
                >
                  Try again
                </Button>
              </div>
            )}

            {frontierCodeQuery.isSuccess && (
              <FrontierCodeLeaderboardDashboard
                cursorModelPrices={cursorQuery.data}
                leaderboard={frontierCodeQuery.data}
                onSubsetChange={setFrontierCodeSubset}
                onVersionChange={setFrontierCodeVersion}
                subset={frontierCodeSubset}
                version={frontierCodeVersion}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
