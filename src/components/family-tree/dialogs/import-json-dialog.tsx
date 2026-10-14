"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ImportResult } from "@/lib/family-tree/storage";

type Props = {
  preview: ImportResult & { fileName: string };
  onCancel: () => void;
  onApply: () => void;
};

export function ImportJsonDialog({ preview, onCancel, onApply }: Props) {
  const tImportJson = useTranslations("importJson");
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tImportJson("title")}</DialogTitle>
          <DialogDescription>
            {tImportJson("description", { file: preview.fileName })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 text-sm">
          <p>
            {tImportJson("summary", {
              persons: preview.summary?.persons ?? 0,
              unions: preview.summary?.unions ?? 0,
              relationships: preview.summary?.relationships ?? 0,
            })}
          </p>
          <p className="text-muted-foreground">{tImportJson("validNote")}</p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            {tImportJson("cancel")}
          </Button>
          <Button onClick={onApply}>{tImportJson("apply")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
