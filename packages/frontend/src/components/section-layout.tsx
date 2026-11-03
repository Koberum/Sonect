import { Outlet, useLocation } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { SectionTabs, type SectionTab } from "@/components/section-tabs";
import { SectionToolbar } from "@/components/section-toolbar";
import { cn } from "@/lib/utils";

export interface SectionLayoutProps {
  title: string;
  description?: string;
  tabs: SectionTab[];
  className?: string;
}

export function SectionLayout({
  title,
  description,
  tabs,
  className,
}: SectionLayoutProps) {
  const { pathname } = useLocation();
  const isDetail = !tabs.some((tab) => tab.href === pathname);

  return (
    <div className={cn(className)}>
      <SectionToolbar />
      {!isDetail ? (
        <>
          <PageHeader title={title} description={description} />
          <SectionTabs tabs={tabs} label={title} />
        </>
      ) : null}
      <Outlet />
    </div>
  );
}
