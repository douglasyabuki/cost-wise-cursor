import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { useState } from "react";

import { DeepSweLeaderboardChart } from "./components/charts/deep-swe-leaderboard-chart";
import { DeepSweService } from "./services/deep-swe";
import type { DeepSweVersion } from "./types-and-constants/deep-swe";

const queryClient = new QueryClient();

export const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Component />
    </QueryClientProvider>
  );
};

const Component = () => {
  const [version, setVersion] = useState<DeepSweVersion>("v1.1");

  const {
    data: leaderboard,
    error,
    isPending,
    isFetching,
  } = useQuery(DeepSweService.getLeaderboard(version));

  if (isPending) {
    return <p>Loading leaderboard…</p>;
  }

  if (error) {
    return (
      <p>
        {error instanceof Error
          ? error.message
          : "Could not load the leaderboard"}
      </p>
    );
  }

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <main className="mx-auto flex h-auto w-screen max-w-7xl flex-1 items-start justify-center p-12">
        <div className="container">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h1 className="text-2xl font-semibold">DeepSWE leaderboard</h1>

              <p className="text-muted-foreground">
                Compare model performance and efficiency.
              </p>
            </div>

            {isFetching && (
              <span className="text-muted-foreground text-sm">Updating…</span>
            )}
          </div>

          <DeepSweLeaderboardChart
            leaderboard={leaderboard}
            onVersionChange={setVersion}
            version={version}
          />
        </div>
      </main>
    </div>
  );
};
