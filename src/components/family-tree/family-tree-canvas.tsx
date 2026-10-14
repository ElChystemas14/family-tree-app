"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { PersonNode } from "./person-node";
import { UnionNode } from "./union-node";
import { TreeControls } from "./tree-controls";
import { PersonDetailSheet } from "./person-detail-sheet";
import { AddRelativeModal, type LinkOptions } from "./add-relative-modal";
import { EditPersonDialog } from "./dialogs/edit-person-dialog";
import { PendingUnionDialog } from "./dialogs/pending-union-dialog";
import { HelpDialog } from "./dialogs/help-dialog";
import { ImportJsonDialog } from "./dialogs/import-json-dialog";
import { ImportCsvDialog } from "./dialogs/import-csv-dialog";
import { ExportDialog } from "./dialogs/export-dialog";
import { TreesDialog } from "./dialogs/trees-dialog";
import { OnboardingCard } from "./dialogs/onboarding-card";
import { TreeHeader } from "./tree-header";
import {
  layoutFamilyToGraph,
  withGraphSelection,
} from "@/lib/family-tree/transform";
import { getParentIds, useFamilyTree } from "@/lib/family-tree/store";
import {
  buildExportFilename,
  buildExportPayload,
  loadStoredTree,
  parseImportedJson,
  saveStoredTree,
  type ImportResult,
} from "@/lib/family-tree/storage";
import { validatePersonForm } from "@/lib/family-tree/schema";
import { readStoredTheme, writeStoredTheme } from "@/lib/family-tree/theme";
import {
  PERSON_CSV_HEADERS,
  RELATIONSHIP_CSV_HEADERS,
  UNION_CSV_HEADERS,
  buildCsvFilename,
  personToCsvRow,
  relationshipToCsvRow,
  serializeCsv,
  unionToCsvRow,
  type CsvFileKind,
} from "@/lib/family-tree/csv";
import type { FamilyTreeData, LayoutMode, Person } from "@/types/family-tree";
import { useCloudSync } from "@/lib/sync/use-cloud-sync";

import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import { LoginDialog } from "@/components/auth/login-dialog";

const nodeTypes = { person: PersonNode, union: UnionNode };

// Sin entorno Supabase la app sigue 100% local (sin login ni nube).
const SUPABASE_ENABLED = isSupabaseConfigured();
type ModalState = {
  relationship?: "parent" | "spouse" | "child";
  personId?: string;
  unionId?: string;
};

function FlowInner() {
  const { fitView, getIntersectingNodes } = useReactFlow();
  const {
    data,
    posOverrides,
    layout,
    addPerson: storeAddPerson,
    connectUnion: storeConnectUnion,
    swapUnion: storeSwapUnion,
    removePerson: storeRemovePerson,
    updatePerson: storeUpdatePerson,
    moveNode,
    setLayout: setStoreLayout,
    importData: storeImportData,
  } = useFamilyTree();
  const tHeader = useTranslations("header");
  const tAuth = useTranslations("auth");
  const tTrees = useTranslations("trees");
  const tToasts = useTranslations("toasts");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Person>();
  // Oscuro en el primer render (igual que el servidor); la preferencia guardada
  // se aplica tras montar para no romper la hidratación.
  const [dark, setDark] = useState<boolean>(true);
  /* eslint-disable react-hooks/set-state-in-effect -- sincronización post-montaje
     intencionada (leer localStorage en render rompería la hidratación SSR). */
  useEffect(() => {
    const stored = readStoredTheme();
    if (stored) setDark(stored === "dark");
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  const [modal, setModal] = useState<ModalState>();
  const [createPersonOpen, setCreatePersonOpen] = useState(false);
  const [pendingUnion, setPendingUnion] = useState<{
    sourceId: string;
    targetId: string;
  }>();
  const [helpOpen, setHelpOpen] = useState(false);
  const [editing, setEditing] = useState<Person>();
  const [toast, setToast] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [importPreview, setImportPreview] = useState<
    ImportResult & { fileName: string }
  >();
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvOpen, setCsvOpen] = useState(false);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }, []);
  const [user, setUser] = useState<User | null>(null);
  const {
    trees,
    activeTreeId,
    activeRole,
    treeDialogOpen,
    setTreeDialogOpen,
    syncing,
    creatingTree,
    switchTree,
    createTreeNamed,
    refreshTrees,
    resetOnSignOut,
    recordDeleted,
  } = useCloudSync({
    enabled: SUPABASE_ENABLED,
    user,
    data,
    posOverrides,
    importData: storeImportData,
    notify,
    tTrees,
  });
  const requireEdit = useCallback(() => {
    if (user && activeRole === "viewer") {
      notify(tTrees("readOnly"));
      return false;
    }
    return true;
  }, [user, activeRole, notify, tTrees]);
  const openRelationship = useCallback(
    (
      relationship: "parent" | "spouse" | "child",
      personId?: string,
      unionId?: string
    ) => setModal({ relationship, personId, unionId }),
    []
  );
  const addPerson = useCallback(
    (
      personInput: Omit<Person, "id">,
      existingId?: string,
      opts?: LinkOptions
    ) => {
      if (!requireEdit()) return;
      const closeModal = () => {
        setModal(undefined);
        setCreatePersonOpen(false);
      };
      const result = storeAddPerson({
        personInput,
        existingId,
        relationship: modal?.relationship,
        anchorId: modal?.personId,
        unionId: opts?.unionId ?? modal?.unionId,
        singleParentOnly: opts?.singleParent,
        relType: opts?.relType,
      });
      if (!result.ok) {
        if (result.error) notify(result.error);
        return;
      }
      if (result.person) setSelected(result.person);
      closeModal();
    },
    [modal, storeAddPerson, notify, requireEdit]
  );
  const addBranch = useCallback(() => setCreatePersonOpen(true), []);
  // Arrastre en vivo: refleja cada frame en posOverrides para que la tarjeta
  // siga al cursor (sin esto solo saltaba a la posición final al soltar).
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === "position" && change.position) {
          moveNode(change.id, change.position);
        }
      }
    },
    [moveNode]
  );
  const changeLayout = useCallback(
    (value: LayoutMode) => {
      setStoreLayout(value);
      window.setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 80);
    },
    [setStoreLayout, fitView]
  );
  // Reordenar: descarta posiciones manuales y vuelve al layout automático.
  const resetPositions = useCallback(() => {
    setStoreLayout(layout);
    window.setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 80);
  }, [setStoreLayout, layout, fitView]);
  const connectPeople = useCallback(
    (sourceId: string, targetId: string) => {
      if (!requireEdit()) return;
      const result = storeConnectUnion(sourceId, targetId);
      notify(
        result.ok
          ? tToasts("connected")
          : (result.error ?? tToasts("unionError"))
      );
    },
    [storeConnectUnion, notify, tToasts, requireEdit]
  );
  // dagre solo se re-ejecuta si cambian estructura o modo (B5, AUD-MED-04);
  // seleccionar/buscar solo re-deriva resaltado (ver `[layout] dagre…` en dev).
  const layoutGraph = useMemo(
    () =>
      layoutFamilyToGraph(
        data.persons,
        data.unions,
        data.relationships,
        layout
      ),
    [data, layout]
  );
  const graph = useMemo(
    () =>
      withGraphSelection(
        layoutGraph,
        { unions: data.unions, relationships: data.relationships },
        {
          layout,
          selectedId: selected?.id,
          search,
          onPersonAction: (id, action) => openRelationship(action, id),
          onUnionChild: (id) => openRelationship("child", undefined, id),
          onUnionSwap: (id) => {
            const result = storeSwapUnion(id);
            notify(
              result.ok
                ? tToasts("swapped")
                : (result.error ?? tToasts("unionError"))
            );
          },
        }
      ),
    [
      layoutGraph,
      data.unions,
      data.relationships,
      layout,
      selected?.id,
      search,
      openRelationship,
      storeSwapUnion,
      notify,
      tToasts,
    ]
  );
  const nodes = useMemo(() => {
    // La unión no tiene posición propia: vive centrada bajo la pareja, como en
    // los árboles clásicos (así nunca queda flotando al arrastrar), y no es
    // arrastrable.
    const centers = new Map<string, { x: number; y: number }>();
    for (const node of graph.nodes) {
      if (node.type === "person") {
        const position = posOverrides[node.id] ?? node.position;
        centers.set(node.id, {
          x: position.x + 130,
          y: position.y + 58,
        });
      }
    }
    return graph.nodes.map((node) => {
      if (node.type === "union" && "partner1Id" in node.data) {
        const a = centers.get(node.data.partner1Id);
        const b = centers.get(node.data.partner2Id);
        return {
          ...node,
          draggable: false,
          position:
            a && b
              ? {
                  x: (a.x + b.x) / 2 - 11,
                  y: Math.max(a.y, b.y) + 58 + 40 - 11,
                }
              : (posOverrides[node.id] ?? node.position),
        };
      }
      return {
        ...node,
        position: posOverrides[node.id] ?? node.position,
      };
    });
  }, [graph.nodes, posOverrides]) as unknown as Node[];
  const focusLineage = useCallback(
    (personId: string) => {
      const parents = new Set(
        getParentIds(personId, data.unions, data.relationships)
      );
      const partners = new Set<string>();
      data.unions.forEach((union) => {
        if (union.partner1Id === personId) partners.add(union.partner2Id);
        else if (union.partner2Id === personId) partners.add(union.partner1Id);
      });
      const children = new Set(
        data.relationships
          .filter((rel) =>
            getParentIds(rel.childId, data.unions, data.relationships).includes(
              personId
            )
          )
          .map((rel) => rel.childId)
      );
      const ids = new Set([personId, ...parents, ...partners, ...children]);
      fitView({
        nodes: nodes.filter((node) => ids.has(node.id)),
        padding: 0.25,
        duration: 500,
      });
    },
    [data, fitView, nodes]
  );
  const saveEdit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    if (!requireEdit()) return;
    const form = new FormData(event.currentTarget);
    const validation = validatePersonForm({
      firstName: String(form.get("firstName") ?? ""),
      lastName: String(form.get("lastName") ?? ""),
      gender: editing.gender,
      birthDate: String(form.get("birthDate") ?? ""),
      deathDate: editing.deathDate,
      photoUrl: editing.photoUrl,
      bio: String(form.get("bio") ?? ""),
    });
    if (!validation.ok || !validation.value) {
      const firstError =
        validation.errors.firstName ??
        validation.errors.lastName ??
        validation.errors.birthDate ??
        validation.errors.deathDate ??
        validation.errors.bio ??
        tToasts("reviewData");
      notify(firstError);
      return;
    }
    const updated = {
      ...editing,
      firstName: validation.value.firstName,
      lastName: validation.value.lastName,
      birthDate: validation.value.birthDate,
      bio: validation.value.bio ?? "",
    };
    const updateResult = storeUpdatePerson(updated);
    if (!updateResult.ok) {
      notify(updateResult.error ?? tToasts("saveError"));
      return;
    }
    setSelected(updated);
    setEditing(undefined);
    notify(tToasts("updated"));
  };
  const [exportOpen, setExportOpen] = useState(false);
  const downloadTextFile = (text: string, filename: string, mime: string) => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
  const handleExportJson = useCallback(() => {
    try {
      const payload = buildExportPayload(data, posOverrides);
      downloadTextFile(
        JSON.stringify(payload, null, 2),
        buildExportFilename(),
        "application/json"
      );
      notify(tToasts("exported"));
    } catch {
      notify(tToasts("exportError"));
    }
  }, [data, posOverrides, notify, tToasts]);
  const handleExportCsv = useCallback(
    (kind: CsvFileKind) => {
      try {
        const text =
          kind === "personas"
            ? serializeCsv(
                [...PERSON_CSV_HEADERS],
                data.persons.map(personToCsvRow)
              )
            : kind === "uniones"
              ? serializeCsv(
                  [...UNION_CSV_HEADERS],
                  data.unions.map(unionToCsvRow)
                )
              : serializeCsv(
                  [...RELATIONSHIP_CSV_HEADERS],
                  data.relationships.map(relationshipToCsvRow)
                );
        downloadTextFile(text, buildCsvFilename(kind), "text/csv");
        notify(tToasts("csvExported", { file: kind }));
      } catch {
        notify(tToasts("csvExportError"));
      }
    },
    [data, notify, tToasts]
  );
  const handleImportFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed: unknown = JSON.parse(String(reader.result ?? ""));
          const result = parseImportedJson(parsed);
          if (!result.ok) {
            notify(
              tToasts("importInvalid", {
                error: result.errors[0] ?? "revisa el formato",
              })
            );
            return;
          }
          setImportPreview({ ...result, fileName: file.name });
        } catch {
          notify(tToasts("importUnreadable"));
        }
      };
      reader.onerror = () => notify(tToasts("importUnreadable"));
      reader.readAsText(file);
    },
    [notify, tToasts]
  );
  const applyImport = useCallback(() => {
    if (!importPreview?.data) return;
    if (!requireEdit()) return;
    const previousIds = new Set(data.persons.map((person) => person.id));
    storeImportData(importPreview.data, importPreview.data.posOverrides ?? {});
    recordDeleted(
      [...previousIds].filter(
        (id) => !importPreview.data!.persons.some((person) => person.id === id)
      ),
      activeTreeId
    );
    setSelected(undefined);
    notify(
      tToasts("imported", {
        persons: importPreview.summary?.persons ?? 0,
        unions: importPreview.summary?.unions ?? 0,
      })
    );
    setImportPreview(undefined);
    if (fileRef.current) fileRef.current.value = "";
  }, [
    importPreview,
    storeImportData,
    notify,
    tToasts,
    requireEdit,
    data,
    activeTreeId,
    recordDeleted,
  ]);
  const applyCsvImport = useCallback(
    (applied: FamilyTreeData) => {
      if (!requireEdit()) return;
      storeImportData({
        persons: [...data.persons, ...applied.persons],
        unions: [...data.unions, ...applied.unions],
        relationships: [...data.relationships, ...applied.relationships],
      });
      setSelected(undefined);
      notify(
        tToasts("csvImported", {
          persons: applied.persons.length,
          unions: applied.unions.length,
          relationships: applied.relationships.length,
        })
      );
    },
    [data, storeImportData, notify, tToasts, requireEdit]
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    writeStoredTheme(dark ? "dark" : "light");
  }, [dark]);
  /* eslint-disable react-hooks/set-state-in-effect -- hidratación post-montaje
     intencionada desde localStorage; en render rompería la hidratación SSR (AUD-MED-08). */
  useEffect(() => {
    const stored = loadStoredTree();
    if (stored.data) {
      storeImportData(stored.data, stored.data.posOverrides ?? {});
    } else if (stored.error) {
      notify(stored.error);
    }
    setHydrated(true);
  }, [storeImportData, notify]);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      const result = saveStoredTree(data, posOverrides);
      if (!result.ok && result.error) notify(result.error);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [data, posOverrides, hydrated, notify]);
  const [loginOpen, setLoginOpen] = useState(false);
  useEffect(() => {
    if (!SUPABASE_ENABLED) return;
    const supabase = createSupabaseBrowserClient();
    supabase.auth
      .getSession()
      .then(({ data }: { data: { session: Session | null } }) =>
        setUser(data.session?.user ?? null)
      );
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setUser(session?.user ?? null);
      }
    );
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  const handleSignOut = useCallback(async () => {
    try {
      await createSupabaseBrowserClient().auth.signOut();
      setUser(null);
      resetOnSignOut();
      notify(tAuth("signedOut"));
    } catch {
      notify(tAuth("signOutError"));
    }
  }, [notify, tAuth, resetOnSignOut]);
  const activeTreeName = trees.find((item) => item.id === activeTreeId)?.name;
  const roleLabel =
    activeRole === "owner"
      ? tTrees("roleOwner")
      : activeRole === "editor"
        ? tTrees("roleEditor")
        : tTrees("roleViewer");
  const pendingSource = pendingUnion
    ? data.persons.find((person) => person.id === pendingUnion.sourceId)
    : undefined;
  const pendingTarget = pendingUnion
    ? data.persons.find((person) => person.id === pendingUnion.targetId)
    : undefined;
  return (
    <main className="family-tree-flow relative flex h-dvh min-h-175 flex-col overflow-hidden bg-background">
      <TreeHeader
        supabaseEnabled={SUPABASE_ENABLED}
        personsCount={data.persons.length}
        unionsCount={data.unions.length}
        user={user}
        activeTreeName={activeTreeName}
        syncing={syncing}
        onExport={() => setExportOpen(true)}
        onJsonClick={() => fileRef.current?.click()}
        onCsvOpen={() => setCsvOpen(true)}
        onCreate={() => setCreatePersonOpen(true)}
        onHelp={() => setHelpOpen(true)}
        onLogin={() => setLoginOpen(true)}
        onLogout={handleSignOut}
        onTreesOpen={() => setTreeDialogOpen(true)}
      />
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label={tHeader("selectJsonFileLabel")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleImportFile(file);
        }}
      />
      <section className="relative min-h-0 flex-1">
        <TreeControls
          persons={data.persons}
          search={search}
          onSearch={setSearch}
          onSelectPerson={setSelected}
          onNewBranch={addBranch}
          layout={layout}
          onLayout={changeLayout}
          onCenter={() => fitView({ padding: 0.2, duration: 500 })}
          onResetPositions={resetPositions}
          dark={dark}
          onTheme={() => setDark((value) => !value)}
        />
        <ReactFlow
          nodes={nodes}
          edges={graph.edges as Edge[]}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          defaultEdgeOptions={{ type: "smoothstep" }}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          onNodeClick={(_, node) => {
            const person = data.persons.find((item) => item.id === node.id);
            if (person) setSelected(person);
          }}
          onNodeDoubleClick={(_, node) => {
            if (data.persons.some((item) => item.id === node.id))
              focusLineage(node.id);
          }}
          onPaneContextMenu={(event) => {
            event.preventDefault();
            setCreatePersonOpen(true);
          }}
          onNodeDragStop={(event, node) => {
            if (node.type !== "person") return;
            moveNode(node.id, node.position);
            // En táctil arrastrar compite con el pan: no se propone unión
            // (la pareja se crea desde el menú ⋯ → "Añadir pareja").
            const pointerType = (event as unknown as { pointerType?: string })
              .pointerType;
            const coarse =
              typeof window !== "undefined" &&
              typeof window.matchMedia === "function" &&
              window.matchMedia("(pointer: coarse)").matches;
            if (pointerType === "touch" || (!pointerType && coarse)) return;
            const target = getIntersectingNodes(node).find(
              (item) => item.type === "person" && item.id !== node.id
            );
            if (target)
              setPendingUnion({ sourceId: node.id, targetId: target.id });
          }}
          minZoom={0.2}
          maxZoom={1.5}
        >
          <Background gap={24} size={1} className="opacity-60" />
          <Controls className="bottom-5! left-5!" showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            ariaLabel={tHeader("minimapLabel")}
            bgColor="var(--card)"
            maskColor="color-mix(in oklch, var(--foreground) 16%, transparent)"
            nodeColor="var(--primary)"
          />
        </ReactFlow>
        {hydrated && data.persons.length === 0 && (
          <OnboardingCard
            onCreate={() => setCreatePersonOpen(true)}
            onImport={() => fileRef.current?.click()}
          />
        )}
      </section>
      <PersonDetailSheet
        person={selected}
        data={data}
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(undefined)}
        onSelectRelative={setSelected}
        onAddRelative={(relationship, personId) =>
          openRelationship(relationship, personId)
        }
        onEdit={() => selected && setEditing(selected)}
        onDelete={() => {
          if (!selected) return;
          if (!requireEdit()) return;
          const removedId = selected.id;
          const result = storeRemovePerson(removedId);
          if (!result.ok) {
            notify(result.error ?? tToasts("removeError"));
            return;
          }
          recordDeleted([removedId], activeTreeId);
          setSelected(undefined);
          notify(tToasts("removed"));
        }}
      />
      <AddRelativeModal
        open={!!modal || createPersonOpen}
        onOpenChange={(open) => {
          if (!open) {
            setModal(undefined);
            setCreatePersonOpen(false);
          }
        }}
        people={data.persons}
        relationship={modal?.relationship}
        anchorId={modal?.personId}
        unions={data.unions}
        onCreate={addPerson}
      />
      {editing && (
        <EditPersonDialog
          editing={editing}
          onClose={() => setEditing(undefined)}
          onSubmit={saveEdit}
        />
      )}
      {pendingUnion && pendingSource && pendingTarget && (
        <PendingUnionDialog
          sourceName={`${pendingSource.firstName} ${pendingSource.lastName}`}
          targetName={`${pendingTarget.firstName} ${pendingTarget.lastName}`}
          onCancel={() => setPendingUnion(undefined)}
          onConfirm={() => {
            connectPeople(pendingUnion.sourceId, pendingUnion.targetId);
            setPendingUnion(undefined);
          }}
        />
      )}
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      {importPreview?.data && (
        <ImportJsonDialog
          preview={importPreview}
          onCancel={() => {
            setImportPreview(undefined);
            if (fileRef.current) fileRef.current.value = "";
          }}
          onApply={applyImport}
        />
      )}
      <ImportCsvDialog
        open={csvOpen}
        data={data}
        onClose={() => setCsvOpen(false)}
        onApply={applyCsvImport}
        notify={notify}
      />
      <ExportDialog
        open={exportOpen}
        persons={data.persons}
        onClose={() => setExportOpen(false)}
        onExportJson={handleExportJson}
        onExportCsv={handleExportCsv}
      />
      <TreesDialog
        open={treeDialogOpen}
        trees={trees}
        activeTreeId={activeTreeId}
        activeName={activeTreeName}
        roleLabel={roleLabel}
        showReadOnly={activeRole === "viewer"}
        syncing={syncing}
        busy={creatingTree}
        onClose={() => setTreeDialogOpen(false)}
        onSwitch={(treeId, role) => switchTree(treeId, role)}
        onCreate={createTreeNamed}
        onRefresh={refreshTrees}
      />
      {SUPABASE_ENABLED && (
        <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
      )}
      {toast && (
        <div
          role="status"
          className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-primary/30 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-lg"
        >
          {toast}
        </div>
      )}
    </main>
  );
}
export function FamilyTreeCanvas() {
  return (
    <ReactFlowProvider>
      <FlowInner />
    </ReactFlowProvider>
  );
}
