import type { LucideIcon } from "lucide-react";

export type ModuleKpi = {
  label: string;
  value: number | string;
  unit: string;
  icon: LucideIcon;
  tone: "blue" | "green" | "amber" | "purple" | "red" | "slate";
};

export type ModuleQuickAction = {
  label: string;
  icon: LucideIcon;
  tone: string;
  onClick: () => void;
  disabled?: boolean;
};

export type ModuleFilterSelect = {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
};

export type ModuleColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
};

export type ModuleActivityItem = {
  id: string;
  time: string;
  label: string;
  icon: LucideIcon;
  tone: string;
};
