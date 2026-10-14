"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { RemoteTreeItem } from "@/lib/sync/repository";

type Props = {
  open: boolean;
  trees: RemoteTreeItem[];
  activeTreeId: string | null;
  activeName?: string;
  roleLabel: string;
  showReadOnly: boolean;
  syncing: boolean;
  busy: boolean;
  onClose: () => void;
  onSwitch: (treeId: string, role: string) => void;
  onCreate: (name: string) => void;
  onRefresh: () => void;
};

export function TreesDialog({
  open,
  trees,
  activeTreeId,
  activeName,
  roleLabel,
  showReadOnly,
  syncing,
  busy,
  onClose,
  onSwitch,
  onCreate,
  onRefresh,
}: Props) {
  const tTrees = useTranslations("trees");
  const [newTreeName, setNewTreeName] = useState("");
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
          <DialogTitle>{tTrees("title")}</DialogTitle>
          <DialogDescription>{tTrees("description")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {activeTreeId && (
            <p className="text-xs text-muted-foreground">
              {activeName} · {roleLabel}
              {showReadOnly ? ` · ${tTrees("readOnly")}` : ""}
              {syncing ? " …" : ""}
            </p>
          )}
          {trees.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tTrees("empty")}</p>
          ) : (
            <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto">
              {trees.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-xl border p-3 text-sm"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {item.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {item.role === "owner"
                        ? tTrees("roleOwner")
                        : item.role === "editor"
                          ? tTrees("roleEditor")
                          : tTrees("roleViewer")}
                    </span>
                  </span>
                  {item.id === activeTreeId ? (
                    <Badge>{tTrees("active")}</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSwitch(item.id, item.role)}
                    >
                      {tTrees("change")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Input
              value={newTreeName}
              onChange={(event) => setNewTreeName(event.target.value)}
              placeholder={tTrees("newPlaceholder")}
              aria-label={tTrees("newPlaceholder")}
              className="flex-1"
            />
            <Button
              size="sm"
              onClick={() => {
                onCreate(newTreeName);
                setNewTreeName("");
              }}
              disabled={busy || syncing}
            >
              {tTrees("create")}
            </Button>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onRefresh} disabled={syncing}>
            {tTrees("refresh")}
          </Button>
          <Button variant="outline" onClick={onClose}>
            {tTrees("cancel")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
