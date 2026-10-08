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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { PersonNode } from "./person-node";
import { UnionNode } from "./union-node";
import { TreeControls } from "./tree-controls";
import { PersonDetailSheet } from "./person-detail-sheet";
import { AddRelativeModal } from "./add-relative-modal";
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
  hasLivingPersons,
  personToCsvRow,
  planCsvImport,
  relationshipToCsvRow,
  serializeCsv,
  unionToCsvRow,
  type CsvFileKind,
  type CsvImportPlan,
} from "@/lib/family-tree/csv";
import type { LayoutMode, Person } from "@/types/family-tree";
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
import { Textarea } from "@/components/ui/textarea";
import { CircleHelp, Download, FileUp, Upload } from "lucide-react";

const nodeTypes = { person: PersonNode, union: UnionNode };
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
    removePerson: storeRemovePerson,
    updatePerson: storeUpdatePerson,
    moveNode,
    setLayout: setStoreLayout,
    importData: storeImportData,
  } = useFamilyTree();
  const tHeader = useTranslations("header");
  const tOnboarding = useTranslations("onboarding");
  const tEdit = useTranslations("editDialog");
  const tUnion = useTranslations("unionDialog");
  const tHelp = useTranslations("help");
  const tImportJson = useTranslations("importJson");
  const tImportCsv = useTranslations("importCsv");
  const tExport = useTranslations("exportDialog");
  const tToasts = useTranslations("toasts");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Person>();
  const [dark, setDark] = useState<boolean>(
    () => readStoredTheme() !== "light"
  );
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
  const [csvTexts, setCsvTexts] = useState<
    Partial<Record<CsvFileKind, string>>
  >({});
  const csvPlan: CsvImportPlan | undefined = useMemo(
    () =>
      csvOpen && csvTexts.personas
        ? planCsvImport(
            {
              personasText: csvTexts.personas,
              unionesText: csvTexts.uniones,
              relacionesText: csvTexts.relaciones,
            },
            data
          )
        : undefined,
    [csvOpen, csvTexts, data]
  );

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }, []);
  const openRelationship = useCallback(
    (
      relationship: "parent" | "spouse" | "child",
      personId?: string,
      unionId?: string
    ) => setModal({ relationship, personId, unionId }),
    []
  );
  const addPerson = useCallback(
    (personInput: Omit<Person, "id">, existingId?: string) => {
      const closeModal = () => {
        setModal(undefined);
        setCreatePersonOpen(false);
      };
      const result = storeAddPerson({
        personInput,
        existingId,
        relationship: modal?.relationship,
        anchorId: modal?.personId,
        unionId: modal?.unionId,
      });
      if (!result.ok) {
        if (result.error) notify(result.error);
        return;
      }
      if (result.person) setSelected(result.person);
      closeModal();
    },
    [modal, storeAddPerson, notify]
  );
  const addBranch = useCallback(() => setCreatePersonOpen(true), []);
  const changeLayout = useCallback(
    (value: LayoutMode) => {
      setStoreLayout(value);
      window.setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 80);
    },
    [setStoreLayout, fitView]
  );
  const connectPeople = useCallback(
    (sourceId: string, targetId: string) => {
      const result = storeConnectUnion(sourceId, targetId);
      notify(
        result.ok
          ? tToasts("connected")
          : (result.error ?? tToasts("unionError"))
      );
    },
    [storeConnectUnion, notify, tToasts]
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
    ]
  );
  const nodes = useMemo(
    () =>
      graph.nodes.map((node) => ({
        ...node,
        position: posOverrides[node.id] ?? node.position,
      })),
    [graph.nodes, posOverrides]
  ) as unknown as Node[];
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
    storeImportData(importPreview.data, importPreview.data.posOverrides ?? {});
    setSelected(undefined);
    notify(
      tToasts("imported", {
        persons: importPreview.summary?.persons ?? 0,
        unions: importPreview.summary?.unions ?? 0,
      })
    );
    setImportPreview(undefined);
    if (fileRef.current) fileRef.current.value = "";
  }, [importPreview, storeImportData, notify, tToasts]);
  const readCsvFile = useCallback(
    (file: File, kind: CsvFileKind) => {
      const reader = new FileReader();
      reader.onload = () => {
        setCsvTexts((prev) => ({
          ...prev,
          [kind]: String(reader.result ?? ""),
        }));
      };
      reader.onerror = () => notify(tToasts("csvUnreadable"));
      reader.readAsText(file);
    },
    [notify, tToasts]
  );
  const closeCsvDialog = useCallback(() => {
    setCsvOpen(false);
    setCsvTexts({});
  }, []);
  const applyCsvImport = useCallback(() => {
    if (!csvPlan) return;
    const { applied } = csvPlan;
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
    closeCsvDialog();
  }, [csvPlan, data, storeImportData, notify, tToasts, closeCsvDialog]);
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
  const pendingSource = pendingUnion
    ? data.persons.find((person) => person.id === pendingUnion.sourceId)
    : undefined;
  const pendingTarget = pendingUnion
    ? data.persons.find((person) => person.id === pendingUnion.targetId)
    : undefined;
  return (
    <main className="family-tree-flow relative flex h-dvh min-h-175 flex-col overflow-hidden bg-background">
      <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card px-5">
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
        <div className="hidden items-center gap-5 text-xs text-muted-foreground sm:flex">
          <span>{tHeader("persons", { count: data.persons.length })}</span>
          <span>{tHeader("unions", { count: data.unions.length })}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setExportOpen(true)}
          >
            {tHeader("export")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
          >
            {tHeader("importJson")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCsvOpen(true)}>
            {tHeader("importCsv")}
          </Button>
          <Button size="sm" onClick={() => setCreatePersonOpen(true)}>
            {tHeader("create")}
          </Button>
        </div>
        <Button
          size="sm"
          className="sm:hidden"
          onClick={() => setCreatePersonOpen(true)}
        >
          {tHeader("createShort")}
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={() => setExportOpen(true)}
          aria-label={tHeader("exportLabel")}
        >
          <Download className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          aria-label={tHeader("importJsonLabel")}
        >
          <Upload className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={() => setCsvOpen(true)}
          aria-label={tHeader("importCsvLabel")}
        >
          <FileUp className="size-4" />
        </Button>
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
        <Button
          size="icon"
          variant="outline"
          onClick={() => setHelpOpen(true)}
          aria-label={tHeader("helpLabel")}
        >
          <CircleHelp className="size-4" />
        </Button>
      </header>
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
          dark={dark}
          onTheme={() => setDark((value) => !value)}
        />
        <ReactFlow
          nodes={nodes}
          edges={graph.edges as Edge[]}
          nodeTypes={nodeTypes}
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
          onNodeDragStop={(event, node) => {
            moveNode(node.id, node.position);
            if (node.type !== "person") return;
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
            ariaLabel="Miniatura del árbol genealógico"
            bgColor="var(--card)"
            maskColor="color-mix(in oklch, var(--foreground) 16%, transparent)"
            nodeColor="var(--primary)"
          />
        </ReactFlow>
        {hydrated && data.persons.length === 0 && (
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
                <Button size="sm" onClick={() => setCreatePersonOpen(true)}>
                  {tOnboarding("create")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                >
                  {tOnboarding("import")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
      <PersonDetailSheet
        person={selected}
        data={data}
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(undefined)}
        onSelectRelative={setSelected}
        onEdit={() => selected && setEditing(selected)}
        onDelete={() => {
          if (!selected) return;
          const result = storeRemovePerson(selected.id);
          if (!result.ok) {
            notify(result.error ?? tToasts("removeError"));
            return;
          }
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
        onCreate={addPerson}
      />
      {editing && (
        <Dialog open onOpenChange={(open) => !open && setEditing(undefined)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{tEdit("title")}</DialogTitle>
              <DialogDescription>{tEdit("description")}</DialogDescription>
            </DialogHeader>
            <form onSubmit={saveEdit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-first">{tEdit("firstName")}</Label>
                  <Input
                    id="edit-first"
                    name="firstName"
                    defaultValue={editing.firstName}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-last">{tEdit("lastName")}</Label>
                  <Input
                    id="edit-last"
                    name="lastName"
                    defaultValue={editing.lastName}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-birth">{tEdit("birth")}</Label>
                <Input
                  id="edit-birth"
                  name="birthDate"
                  type="date"
                  defaultValue={editing.birthDate}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-bio">{tEdit("bio")}</Label>
                <Textarea id="edit-bio" name="bio" defaultValue={editing.bio} />
              </div>
              <Button type="submit">{tEdit("save")}</Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
      {pendingUnion && pendingSource && pendingTarget && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setPendingUnion(undefined);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{tUnion("title")}</DialogTitle>
              <DialogDescription>
                {tUnion("description", {
                  a: `${pendingSource.firstName} ${pendingSource.lastName}`,
                  b: `${pendingTarget.firstName} ${pendingTarget.lastName}`,
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setPendingUnion(undefined)}
              >
                {tUnion("cancel")}
              </Button>
              <Button
                onClick={() => {
                  connectPeople(pendingUnion.sourceId, pendingUnion.targetId);
                  setPendingUnion(undefined);
                }}
              >
                {tUnion("confirm")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {helpOpen && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setHelpOpen(false);
          }}
        >
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{tHelp("title")}</DialogTitle>
              <DialogDescription>{tHelp("description")}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 text-sm leading-6">
              <section>
                <h3 className="font-semibold">{tHelp("cardTitle")}</h3>
                <p className="text-muted-foreground">{tHelp("cardBody")}</p>
              </section>
              <section>
                <h3 className="font-semibold">{tHelp("unionTitle")}</h3>
                <p className="text-muted-foreground">{tHelp("unionBody")}</p>
              </section>
              <section>
                <h3 className="font-semibold">{tHelp("createTitle")}</h3>
                <p className="text-muted-foreground">{tHelp("createBody")}</p>
              </section>
              <section>
                <h3 className="font-semibold">{tHelp("connectTitle")}</h3>
                <p className="text-muted-foreground">{tHelp("connectBody")}</p>
              </section>
              <section>
                <h3 className="font-semibold">{tHelp("exploreTitle")}</h3>
                <p className="text-muted-foreground">{tHelp("exploreBody")}</p>
              </section>
              <section>
                <h3 className="font-semibold">{tHelp("editTitle")}</h3>
                <p className="text-muted-foreground">{tHelp("editBody")}</p>
              </section>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {importPreview?.data && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setImportPreview(undefined);
              if (fileRef.current) fileRef.current.value = "";
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{tImportJson("title")}</DialogTitle>
              <DialogDescription>
                {tImportJson("description", { file: importPreview.fileName })}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 text-sm">
              <p>
                {tImportJson("summary", {
                  persons: importPreview.summary?.persons ?? 0,
                  unions: importPreview.summary?.unions ?? 0,
                  relationships: importPreview.summary?.relationships ?? 0,
                })}
              </p>
              <p className="text-muted-foreground">
                {tImportJson("validNote")}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setImportPreview(undefined);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              >
                {tImportJson("cancel")}
              </Button>
              <Button onClick={applyImport}>{tImportJson("apply")}</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {csvOpen && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) closeCsvDialog();
          }}
        >
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{tImportCsv("title")}</DialogTitle>
              <DialogDescription>
                {tImportCsv("descriptionStart")} Plantillas:{" "}
                <a
                  className="underline"
                  href="/plantilla-personas.csv"
                  download
                >
                  {tImportCsv("templates")}
                </a>
                {", "}
                <a className="underline" href="/plantilla-uniones.csv" download>
                  {tImportCsv("templatesUnions")}
                </a>
                {", "}
                <a
                  className="underline"
                  href="/plantilla-relaciones.csv"
                  download
                >
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
              <Button variant="outline" onClick={closeCsvDialog}>
                {tImportCsv("cancel")}
              </Button>
              <Button
                onClick={applyCsvImport}
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
      )}
      {exportOpen && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setExportOpen(false);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{tExport("title")}</DialogTitle>
              <DialogDescription>{tExport("description")}</DialogDescription>
            </DialogHeader>
            {hasLivingPersons(data.persons) && (
              <p
                role="note"
                className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs leading-5"
              >
                {tExport("privacy")}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleExportJson}>
                {tExport("json")}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExportCsv("personas")}
              >
                personas.csv
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExportCsv("uniones")}
              >
                uniones.csv
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExportCsv("relaciones")}
              >
                relaciones.csv
              </Button>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setExportOpen(false)}>
                {tExport("close")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
