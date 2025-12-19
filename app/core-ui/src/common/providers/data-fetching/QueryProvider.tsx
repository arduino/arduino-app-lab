import { Config } from '@cloud-editor-mono/common';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface QueryClientProviderProps {
  children?: React.ReactNode;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      networkMode: String(Config.APP_NAME).includes('App Lab') // TODO: do a more robust check
        ? 'always'
        : 'online',
    },
    mutations: {
      networkMode: String(Config.APP_NAME).includes('App Lab') // TODO: do a more robust check
        ? 'always'
        : 'online',
    },
  },
});

const QueryProvider: React.FC<QueryClientProviderProps> = (
  props: QueryClientProviderProps,
) => {
  const { children } = props;

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

export default QueryProvider;
