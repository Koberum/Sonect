import { Suspense, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface SectionTab {
  id: string;
  labelKey: string;
  badge?: number;
  content: ReactNode;
}

export interface SectionTabsProps {
  tabs: SectionTab[];
  label: string;
  value: string;
  onValueChange: (value: string) => void;
}

export function SectionContentSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
    </div>
  );
}

export function SectionTabs({
  tabs,
  label,
  value,
  onValueChange,
}: SectionTabsProps) {
  const { t } = useTranslation();

  return (
    <Tabs value={value} onValueChange={onValueChange} className="gap-0">
      <TabsList
        aria-label={label}
        variant="line"
        className="no-scrollbar mb-6 h-9 w-full justify-start gap-1 overflow-x-auto rounded-none border-b bg-transparent p-0"
      >
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className="text-muted-foreground hover:text-foreground data-[state=active]:text-foreground h-full flex-none justify-start gap-1.5 rounded-none px-3 text-sm font-medium shadow-none after:-bottom-px!"
          >
            {t(tab.labelKey)}
            {typeof tab.badge === "number" && tab.badge > 0 ? (
              <span className="text-muted-foreground text-xs tabular-nums">
                {tab.badge}
              </span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id}>
          <Suspense fallback={<SectionContentSkeleton />}>
            {tab.content}
          </Suspense>
        </TabsContent>
      ))}
    </Tabs>
  );
}
