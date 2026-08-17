import * as React from "react";

import { cn } from "@/lib/utils";

function WizardStep({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="wizard-step"
      className={cn(
        "flex flex-col items-center gap-6 py-8 text-center",
        className,
      )}
      {...props}
    />
  );
}

function WizardStepHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="wizard-step-header"
      className={cn("flex flex-col items-center gap-2 text-center", className)}
      {...props}
    />
  );
}

function WizardStepTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="wizard-step-title"
      className={cn("text-xl font-semibold", className)}
      {...props}
    />
  );
}

function WizardStepDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="wizard-step-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

function WizardStepContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="wizard-step-content"
      className={cn("w-full space-y-4", className)}
      {...props}
    />
  );
}

function WizardStepField({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="wizard-step-field"
      className={cn("space-y-2", className)}
      {...props}
    />
  );
}

function WizardStepActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="wizard-step-actions"
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  );
}

export {
  WizardStep,
  WizardStepHeader,
  WizardStepTitle,
  WizardStepDescription,
  WizardStepContent,
  WizardStepField,
  WizardStepActions,
};
