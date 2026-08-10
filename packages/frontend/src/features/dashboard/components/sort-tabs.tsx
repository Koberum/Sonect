import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SortOption<T extends string> {
  value: T;
  label: string;
}

interface SortTabsProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: SortOption<T>[];
  className?: string;
}

export function SortTabs<T extends string>({
  value,
  onValueChange,
  options,
  className,
}: SortTabsProps<T>) {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      className={className}
    >
      <TabsList>
        {options.map((opt) => (
          <TabsTrigger key={opt.value} value={opt.value}>
            {opt.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
