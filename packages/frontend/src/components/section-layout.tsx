import { Outlet, useLocation } from "react-router-dom";
import { SectionTabs, type SectionTab } from "@/components/section-tabs";
import { SectionToolbar } from "@/components/section-toolbar";
import { cn } from "@/lib/utils";

export interface SectionLayoutProps {
  title: string;
  tabs: SectionTab[];
  className?: string;
}

export function SectionLayout({ title, tabs, className }: SectionLayoutProps) {
  const { pathname } = useLocation();
  const isDetail = !tabs.some((tab) => tab.href === pathname);

  return (
    <div className={cn(className)}>
      <SectionToolbar />
      {!isDetail ? (
        <>
          <h1 className="sr-only">{title}</h1>
          <SectionTabs tabs={tabs} label={title} />
        </>
      ) : null}
      <Outlet />
    </div>
  );
}
