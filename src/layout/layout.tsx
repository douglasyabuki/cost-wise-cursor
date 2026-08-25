import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

interface LayoutProps {
  children?: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col overflow-x-hidden">
        <main className="mx-auto flex h-auto w-screen max-w-7xl flex-1 items-start justify-center p-12">
          {children}
        </main>
      </div>
    </QueryClientProvider>
  );
};
