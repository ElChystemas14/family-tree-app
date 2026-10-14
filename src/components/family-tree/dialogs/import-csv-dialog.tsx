"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  planCsvImport,
  type CsvFileKind,
  type CsvImportPlan,
} from "@/lib/family-tree/csv";
import type { FamilyTreeData } from "@/types/family-tree";

type Props = {
  open: boolean;
  data: FamilyTreeData;
  onClose: () => void;
  onApply: (applied: FamilyTreeData) => void;
  notify: (message: string) => void;
};

export function ImportCsvDialog({
  open,
  data,
  onClose,
  onApply,
  notify,
}: Props) {
  const tImportCsv = useTranslations("importCsv");
  const tToasts = useTranslations("toasts");
  const [csvTexts, setCsvTexts] = useState<
    Partial<Record<CsvFileKind, string>>
  >({});
  const csvPlan: CsvImportPlan | undefined = useMemo(
    () =>
      open && csvTexts.personas
        ? planCsvImport(
            {
              personasText: csvTexts.personas,
              unionesText: csvTexts.uniones,
              relacionesText: csvTexts.relaciones,
            },
            data
          )
        : undefined,
    [open, csvTexts, data]
  );
  const readCsvFile = (file: File, kind: CsvFileKind) => {
    const reader = new FileReader();
    reader.onload = () => {
      setCsvTexts((prev) => ({ ...prev, [kind]: String(reader.result ?? "") }));
    };
    reader.onerror = () => notify(tToasts("csvUnreadable"));
    reader.readAsText(file);
  };
  const close = () => {
    setCsvTexts({});
    onClose();
  };
  if (!open) return null;
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tImportCsv("title")}</DialogTitle>
          <DialogDescription>
            {tImportCsv("descriptionStart")} Plantillas:{" "}
            <a className="underline" href="/plantilla-personas.csv" download>
              {tImportCsv("templates")}
            </a>
            {", "}
            <a className="underline" href="/plantilla-uniones.csv" download>
              {tImportCsv("templatesUnions")}
            </a>
            {", "}
            <a className="underline" href="/plantilla-relaciones.csv" download>
              {tImportCsv("templatesRelations")}
            </a>
            .
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {(
            [
              ["personas", tImportCsv("personasLabel")],
              ["uniones", tImportCsv("unionesLabel")],
              ["relaciones", tImportCsv("relacionesLabel")],
            ] as Array<[CsvFileKind, string]>
          ).map(([kind, label]) => (
            <div key={kind} className="flex flex-col gap-2">
              <Label htmlFor={`csv-${kind}`}>{label}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id={`csv-${kind}`}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) readCsvFile(file, kind);
                    event.target.value = "";
                  }}
                />
                {csvTexts[kind] && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {tImportCsv("loaded")}
                  </span>
                )}
              </div>
            </div>
          ))}
          {csvPlan && (
            <div className="flex flex-col gap-2 text-sm">
              <p>
                {tImportCsv("applying", {
                  persons: csvPlan.applied.persons.length,
                  unions: csvPlan.applied.unions.length,
                  relationships: csvPlan.applied.relationships.length,
                })}
              </p>
              {csvPlan.rejected.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <p className="font-semibold">
                    {tImportCsv("rejected", {
                      count: csvPlan.rejected.length,
                    })}
                  </p>
                  <ul className="max-h-48 overflow-y-auto rounded-xl border p-3 text-xs leading-5">
                    {csvPlan.rejected.slice(0, 100).map((error, index) => (
                      <li key={index}>
                        {tImportCsv("errorLine", {
                          file: error.file,
                          line: error.line,
                          suffix: error.field ? ` · ${error.field}` : "",
                          message: error.message,
                        })}
                      </li>
                    ))}
                  </ul>
                  {csvPlan.rejected.length > 100 && (
                    <p className="text-xs text-muted-foreground">
                      {tImportCsv("more", {
                        count: csvPlan.rejected.length - 100,
                      })}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  {tImportCsv("allValid")}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={close}>
            {tImportCsv("cancel")}
          </Button>
          <Button
            onClick={() => {
              if (!csvPlan) return;
              onApply(csvPlan.applied);
              close();
            }}
            disabled={
              !csvPlan ||
              csvPlan.applied.persons.length +
                csvPlan.applied.unions.length +
                csvPlan.applied.relationships.length ===
                0
            }
          >
            {tImportCsv("apply")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
