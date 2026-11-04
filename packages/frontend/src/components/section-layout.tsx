import { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import {
  SectionContentSkeleton,
  SectionTabs,
  type SectionTab,
} from "@/components/section-tabs";
import { cn } from "@/lib/utils";

export interface SectionLayoutProps {
  title: string;
  /** Section root path, e.g. `/library`. Any deeper path is a detail page. */
  basePath: string;
  tabs: SectionTab[];
  className?: string;
}

type SectionLocationState = { tab?: string } | null;

export function SectionLayout({
  title,
  basePath,
  tabs,
  className,
}: SectionLayoutProps) {
  const { pathname, state } = useLocation();
  const requestedTab = (state as SectionLocationState)?.tab;
  const [activeTab, setActiveTab] = useState(() =>
    requestedTab && tabs.some((tab) => tab.id === requestedTab)
      ? requestedTab
      : tabs[0].id,
  );
  const tabIds = tabs.map((tab) => tab.id).join("|");

  useEffect(() => {
    if (requestedTab && tabIds.split("|").includes(requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab, tabIds]);

  if (pathname !== basePath) {
    return (
      <Suspense fallback={<SectionContentSkeleton />}>
        <Outlet />
      </Suspense>
    );
  }

  return (
    <div className={cn(className)}>
      <h1 className="sr-only">{title}</h1>
      <SectionTabs
        tabs={tabs}
        label={title}
        value={activeTab}
        onValueChange={setActiveTab}
      />
    </div>
  );
}
