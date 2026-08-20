import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";

import { CursorService } from "./services/cursor";

const queryClient = new QueryClient();

export const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Component />
    </QueryClientProvider>
  );
};

const Component = () => {
  const { data } = useQuery(CursorService.getModelPrices());

  return (
    <div className="bg-slate-950 text-white">
      <pre className="text-wrap">{JSON.stringify({ data })}</pre>
    </div>
  );
};
