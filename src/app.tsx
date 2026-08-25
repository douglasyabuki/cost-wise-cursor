import { Layout } from "@/layout/layout";
import { HomePage } from "@/pages/home";

/**
 * Provides TanStack Query to the application.
 *
 * @returns The application.
 */
export const App = () => {
  return (
    <Layout>
      <HomePage />
    </Layout>
  );
};
