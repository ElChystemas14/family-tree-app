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
import { hasLivingPersons } from "@/lib/family-tree/csv";
import type { Person } from "@/types/family-tree";
import type { CsvFileKind } from "@/lib/family-tree/csv";

type Props = {
  open: boolean;
  persons: Person[];
  onClose: () => void;
  onExportJson: () => void;
  onExportCsv: (kind: CsvFileKind) => void;
};

export function ExportDialog({
  open,
  persons,
  onClose,
  onExportJson,
  onExportCsv,
}: Props) {
  const tExport = useTranslations("exportDialog");
  if (!open) return null;
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tExport("title")}</DialogTitle>
          <DialogDescription>{tExport("description")}</DialogDescription>
        </DialogHeader>
        {hasLivingPersons(persons) && (
          <p
            role="note"
            className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs leading-5"
          >
            {tExport("privacy")}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onExportJson}>
            {tExport("json")}
          </Button>
          <Button variant="outline" onClick={() => onExportCsv("personas")}>
            personas.csv
          </Button>
          <Button variant="outline" onClick={() => onExportCsv("uniones")}>
            uniones.csv
          </Button>
          <Button variant="outline" onClick={() => onExportCsv("relaciones")}>
            relaciones.csv
          </Button>
        </div>
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            {tExport("close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
