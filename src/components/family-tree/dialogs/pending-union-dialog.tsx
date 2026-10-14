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

type Props = {
  sourceName: string;
  targetName: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function PendingUnionDialog({
  sourceName,
  targetName,
  onCancel,
  onConfirm,
}: Props) {
  const tUnion = useTranslations("unionDialog");
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tUnion("title")}</DialogTitle>
          <DialogDescription>
            {tUnion("description", { a: sourceName, b: targetName })}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            {tUnion("cancel")}
          </Button>
          <Button onClick={onConfirm}>{tUnion("confirm")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
