"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type Props = {
  onCreate: () => void;
  onImport: () => void;
};

export function OnboardingCard({ onCreate, onImport }: Props) {
  const tOnboarding = useTranslations("onboarding");
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
      <div className="pointer-events-auto flex max-w-sm flex-col items-center gap-3 rounded-2xl border bg-card p-6 text-center shadow-lg">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
          H
        </div>
        <h2 className="text-lg font-semibold tracking-tight">
          {tOnboarding("title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {tOnboarding("description")}
        </p>
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          <Button size="sm" onClick={onCreate}>
            {tOnboarding("create")}
          </Button>
          <Button size="sm" variant="outline" onClick={onImport}>
            {tOnboarding("import")}
          </Button>
        </div>
      </div>
    </div>
  );
}
