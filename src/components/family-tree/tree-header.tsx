"use client";

import { useTranslations } from "next-intl";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import {
  CircleHelp,
  Download,
  FileUp,
  LogIn,
  LogOut,
  Network,
  Upload,
} from "lucide-react";

type Props = {
  supabaseEnabled: boolean;
  personsCount: number;
  unionsCount: number;
  user: User | null;
  activeTreeName?: string;
  syncing: boolean;
  onExport: () => void;
  onJsonClick: () => void;
  onCsvOpen: () => void;
  onCreate: () => void;
  onHelp: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onTreesOpen: () => void;
};

export function TreeHeader({
  supabaseEnabled,
  personsCount,
  unionsCount,
  user,
  activeTreeName,
  syncing,
  onExport,
  onJsonClick,
  onCsvOpen,
  onCreate,
  onHelp,
  onLogin,
  onLogout,
  onTreesOpen,
}: Props) {
  const tHeader = useTranslations("header");
  const tAuth = useTranslations("auth");
  const tTrees = useTranslations("trees");
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b bg-card px-5">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
          H
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight">
            {tHeader("appName")}
          </p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {tHeader("subtitle")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
          <span>{tHeader("persons", { count: personsCount })}</span>
          <span>{tHeader("unions", { count: unionsCount })}</span>
          <Button size="sm" variant="outline" onClick={onExport}>
            {tHeader("export")}
          </Button>
          <Button size="sm" variant="outline" onClick={onJsonClick}>
            {tHeader("importJson")}
          </Button>
          <Button size="sm" variant="outline" onClick={onCsvOpen}>
            {tHeader("importCsv")}
          </Button>
          <Button size="sm" onClick={onCreate}>
            {tHeader("create")}
          </Button>
          {supabaseEnabled &&
            (user ? (
              <>
                <span className="max-w-40 truncate">{user.email}</span>
                <Button size="sm" variant="outline" onClick={onLogout}>
                  {tAuth("signOut")}
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={onLogin}>
                {tAuth("signIn")}
              </Button>
            ))}
          {supabaseEnabled && user && (
            <Button size="sm" variant="outline" onClick={onTreesOpen}>
              {activeTreeName ?? tTrees("title")}
              {syncing ? " …" : ""}
            </Button>
          )}
        </div>
        <Button size="sm" className="sm:hidden" onClick={onCreate}>
          {tHeader("createShort")}
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="sm:hidden"
          onClick={onExport}
          aria-label={tHeader("exportLabel")}
        >
          <Download className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="sm:hidden"
          onClick={onJsonClick}
          aria-label={tHeader("importJsonLabel")}
        >
          <Upload className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="sm:hidden"
          onClick={onCsvOpen}
          aria-label={tHeader("importCsvLabel")}
        >
          <FileUp className="size-4" />
        </Button>
        {supabaseEnabled &&
          (user ? (
            <Button
              size="icon"
              variant="outline"
              className="sm:hidden"
              onClick={onLogout}
              aria-label={tAuth("signOut")}
            >
              <LogOut className="size-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              variant="outline"
              className="sm:hidden"
              onClick={onLogin}
              aria-label={tAuth("signIn")}
            >
              <LogIn className="size-4" />
            </Button>
          ))}
        {supabaseEnabled && user && (
          <Button
            size="icon"
            variant="outline"
            className="sm:hidden"
            onClick={onTreesOpen}
            aria-label={tTrees("open")}
          >
            <Network className="size-4" />
          </Button>
        )}
        <Button
          size="icon"
          variant="outline"
          onClick={onHelp}
          aria-label={tHeader("helpLabel")}
        >
          <CircleHelp className="size-4" />
        </Button>
      </div>
    </header>
  );
}
