"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { FamilyTreeData } from "@/types/family-tree";
import type { PosOverrides } from "../family-tree/storage";
import { validateFamilyTreeData } from "../family-tree/schema";
import { createSupabaseBrowserClient } from "../supabase/client";
import {
  loadActiveTreeId,
  loadSyncClock,
  mergeTrees,
  saveActiveTreeId,
  saveSyncClock,
  type RowClocks,
} from "./clock";
import {
  createTree,
  listTrees,
  pullTree,
  pushTree,
  type RemoteTreeItem,
} from "./repository";

export type TreesTranslator = (
  key: "defaultName" | "created" | "syncError",
  params?: { error?: string }
) => string;

type Options = {
  enabled: boolean;
  user: User | null;
  data: FamilyTreeData;
  posOverrides: PosOverrides;
  importData: (tree: FamilyTreeData, overrides?: PosOverrides) => void;
  notify: (message: string) => void;
  tTrees: TreesTranslator;
};

export function useCloudSync({
  enabled,
  user,
  data,
  posOverrides,
  importData,
  notify,
  tTrees,
}: Options) {
  const [trees, setTrees] = useState<RemoteTreeItem[]>([]);
  const [activeTreeId, setActiveTreeId] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<string>("owner");
  const [treeDialogOpen, setTreeDialogOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [creatingTree, setCreatingTree] = useState(false);
  const [pushToken, setPushToken] = useState(0);
  const clockRef = useRef<RowClocks>({});
  const tombstonesRef = useRef<RowClocks>({});
  const syncedOnceRef = useRef(false);
  const bootedForRef = useRef<string | null>(null);

  const syncError = useCallback(
    (error: unknown) =>
      notify(
        tTrees("syncError", {
          error: error instanceof Error ? error.message : String(error),
        })
      ),
    [notify, tTrees]
  );

  const pullIntoTree = useCallback(
    async (treeId: string) => {
      if (!user) return;
      setSyncing(true);
      try {
        const supabase = createSupabaseBrowserClient();
        const pulled = await pullTree(supabase, user.id, treeId);
        const now = new Date().toISOString();
        const { merged, clock, changed } = mergeTrees(
          data,
          {
            persons: pulled.persons,
            unions: pulled.unions,
            relationships: pulled.relationships,
          },
          { rows: clockRef.current, deleted: tombstonesRef.current },
          now
        );
        const validation = validateFamilyTreeData(merged);
        if (!validation.ok) {
          throw new Error(validation.errors[0] ?? "datos remotos no válidos");
        }
        clockRef.current = clock;
        saveSyncClock(treeId, {
          rows: clock,
          deleted: { ...tombstonesRef.current },
          pulledAt: now,
        });
        if (changed) {
          importData(merged, {
            ...pulled.posOverrides,
            ...posOverrides,
          });
        }
        syncedOnceRef.current = true;
        setPushToken((token) => token + 1);
      } catch (error) {
        syncError(error);
      } finally {
        setSyncing(false);
      }
    },
    [data, posOverrides, user, importData, syncError]
  );

  const activateTree = useCallback(
    async (treeId: string, role: string) => {
      setActiveTreeId(treeId);
      saveActiveTreeId(treeId);
      setActiveRole(role);
      syncedOnceRef.current = false;
      const stored = loadSyncClock(treeId);
      clockRef.current = stored.rows;
      tombstonesRef.current = { ...stored.deleted };
      await pullIntoTree(treeId);
    },
    [pullIntoTree]
  );

  useEffect(() => {
    if (!enabled || !user || bootedForRef.current === user.id) return;
    bootedForRef.current = user.id;
    (async () => {
      setSyncing(true);
      try {
        const supabase = createSupabaseBrowserClient();
        const list = await listTrees(supabase, user.id);
        setTrees(list);
        const saved = loadActiveTreeId();
        const pick = list.find((item) => item.id === saved) ?? list[0];
        if (!pick) {
          const name = tTrees("defaultName");
          const id = await createTree(supabase, user.id, name);
          setTrees([{ id, name, role: "owner" }]);
          await activateTree(id, "owner");
          notify(tTrees("created"));
        } else {
          await activateTree(pick.id, pick.role);
        }
      } catch (error) {
        syncError(error);
      } finally {
        setSyncing(false);
      }
    })();
  }, [enabled, user, activateTree, notify, syncError, tTrees]);

  useEffect(() => {
    if (!enabled || !user || !activeTreeId || !syncedOnceRef.current) return;
    const timer = window.setTimeout(() => {
      setSyncing(true);
      (async () => {
        try {
          const supabase = createSupabaseBrowserClient();
          const tombstones = { ...tombstonesRef.current };
          const now = await pushTree(
            supabase,
            user.id,
            activeTreeId,
            data,
            posOverrides,
            Object.keys(tombstones)
          );
          const rows: RowClocks = {};
          for (const person of data.persons) rows[person.id] = now;
          for (const union of data.unions) rows[union.id] = now;
          for (const relationship of data.relationships)
            rows[relationship.id] = now;
          clockRef.current = rows;
          tombstonesRef.current = {};
          saveSyncClock(activeTreeId, { rows, deleted: {}, pulledAt: now });
        } catch (error) {
          syncError(error);
        } finally {
          setSyncing(false);
        }
      })();
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [enabled, data, posOverrides, user, activeTreeId, pushToken, syncError]);

  const handleCreateTree = useCallback(
    async (rawName: string) => {
      if (!user || creatingTree) return;
      setCreatingTree(true);
      try {
        const supabase = createSupabaseBrowserClient();
        const name = rawName.trim() || tTrees("defaultName");
        const id = await createTree(supabase, user.id, name);
        setTrees((prev) => [...prev, { id, name, role: "owner" }]);
        await activateTree(id, "owner");
        notify(tTrees("created"));
      } catch (error) {
        syncError(error);
      } finally {
        setCreatingTree(false);
      }
    },
    [user, creatingTree, activateTree, notify, syncError, tTrees]
  );

  const handleRefreshTrees = useCallback(async () => {
    if (!user) return;
    setSyncing(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const list = await listTrees(supabase, user.id);
      setTrees(list);
      if (activeTreeId) {
        const current = list.find((item) => item.id === activeTreeId);
        if (current) {
          setActiveRole(current.role);
          await pullIntoTree(activeTreeId);
        }
      }
    } catch (error) {
      syncError(error);
    } finally {
      setSyncing(false);
    }
  }, [user, activeTreeId, pullIntoTree, syncError]);

  const handleSignOutReset = useCallback(() => {
    setTrees([]);
    setActiveTreeId(null);
    setTreeDialogOpen(false);
    syncedOnceRef.current = false;
  }, []);

  /** Registra borrados locales para que el push los borre en remoto. */
  const recordDeleted = useCallback((ids: string[], treeId: string | null) => {
    if (ids.length === 0 || !treeId) return;
    const now = new Date().toISOString();
    for (const id of ids) tombstonesRef.current[id] = now;
    const stored = loadSyncClock(treeId);
    saveSyncClock(treeId, {
      rows: { ...stored.rows, ...clockRef.current },
      deleted: { ...tombstonesRef.current },
      pulledAt: stored.pulledAt,
    });
  }, []);

  return {
    trees,
    activeTreeId,
    activeRole,
    treeDialogOpen,
    setTreeDialogOpen,
    syncing,
    creatingTree,
    switchTree: activateTree,
    createTreeNamed: handleCreateTree,
    refreshTrees: handleRefreshTrees,
    resetOnSignOut: handleSignOutReset,
    recordDeleted,
  };
}
