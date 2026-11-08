/* eslint-disable react-refresh/only-export-components */
import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/i18n/locales/en.json";

const testI18n = i18n.createInstance();

void testI18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false },
});

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

type ProviderOptions = Omit<RenderOptions, "wrapper"> & {
  queryClient?: QueryClient;
};

function Providers({
  children,
  queryClient,
}: {
  children: ReactNode;
  queryClient: QueryClient;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={testI18n}>{children}</I18nextProvider>
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  { queryClient = createTestQueryClient(), ...options }: ProviderOptions = {},
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <Providers queryClient={queryClient}>{children}</Providers>
    ),
    ...options,
  });
}
