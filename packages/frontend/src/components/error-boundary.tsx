import { Component, type ErrorInfo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

function ErrorFallback() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <div>
        <h1 className="text-lg font-semibold">{t("common.loadError")}</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {t("common.errorDescription")}
        </p>
      </div>
      <Button onClick={() => window.location.reload()}>
        {t("common.retry")}
      </Button>
    </div>
  );
}

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep the details out of the UI, but leave a trail for local debugging.
    console.error(error, info.componentStack);
  }

  render(): ReactNode {
    return this.state.hasError ? <ErrorFallback /> : this.props.children;
  }
}
