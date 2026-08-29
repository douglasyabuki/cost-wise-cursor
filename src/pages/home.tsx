import { useQuery } from "@tanstack/react-query";
import { CircleCheck, CircleXIcon, RotateCcwIcon } from "lucide-react";
import { useState } from "react";

import { DeepSweLeaderboardDashboard } from "@/components/dashboard/deep-swe-leaderboard-dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CursorService } from "@/services/cursor";
import { DeepSweService } from "@/services/deep-swe";
import type { DeepSweVersion } from "@/types-and-constants/deep-swe";

interface DataSourceStatusProps {
  error: unknown;
  isPending: boolean;
  label: string;
  onRetry: () => void;
}

/**
 * Returns a readable error message.
 *
 * @param error - Error returned by a query.
 * @returns A readable error message.
 */
const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : "Could not load data";
};

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
        <RotateCcwIcon aria-hidden="true" className="size-3.5" />
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
      <CircleCheck
        aria-hidden="true"
        className="text-emerald-600 dark:text-emerald-400"
      />
      <span>{label}</span>
    </Badge>
  );
};

/**
 * Displays the DeepSWE leaderboard and its data-source states.
 *
 * @returns The main application content.
 */
export const HomePage = () => {
  const [version, setVersion] = useState<DeepSweVersion>("v1.1");

  const deepSweQuery = useQuery(DeepSweService.getLeaderboard(version));
  const cursorQuery = useQuery(CursorService.getModelPrices());

  return (
    <div className="container">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">DeepSWE leaderboard</h1>

          <p className="text-muted-foreground">
            Compare model performance and efficiency.
          </p>
        </div>

        <div aria-label="Data source status" className="flex flex-wrap gap-2">
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
          onVersionChange={setVersion}
          version={version}
        />
      )}
    </div>
  );
};
