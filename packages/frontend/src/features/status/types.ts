export type StatusTone = "error" | "warning" | "activity";

export type StatusAction =
  | {
      kind: "navigate";
      labelKey: string;
      to: string;
      state?: { tab?: string };
    }
  | { kind: "sync"; labelKey: string };

export interface StatusItem {
  id: string;
  tone: StatusTone;
  titleKey: string;
  description?: string;
  descriptionKey?: string;
  progress?: number | null;
  animated?: boolean;
  action?: StatusAction;
}
