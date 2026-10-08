"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
          ? "Ramas familiares conectadas."
          : (result.error ?? "No se pudo crear la unión.")
      );
    },
    [storeConnectUnion, notify]
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
        "Revisa los datos.";
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
      notify(updateResult.error ?? "No se pudo guardar.");
      return;
    }
    setSelected(updated);
    setEditing(undefined);
    notify("Datos de la persona actualizados.");
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
      notify("Archivo exportado como copia de seguridad.");
    } catch {
      notify("No se pudo exportar el archivo.");
    }
  }, [data, posOverrides, notify]);
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
        notify(`Archivo ${kind}.csv exportado.`);
      } catch {
        notify("No se pudo exportar el CSV.");
      }
    },
    [data, notify]
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
              `Archivo no válido: ${result.errors[0] ?? "revisa el formato"}`
            );
            return;
          }
          setImportPreview({ ...result, fileName: file.name });
        } catch {
          notify("No se pudo leer el archivo JSON.");
        }
      };
      reader.onerror = () => notify("No se pudo leer el archivo JSON.");
      reader.readAsText(file);
    },
    [notify]
  );
  const applyImport = useCallback(() => {
    if (!importPreview?.data) return;
    storeImportData(importPreview.data, importPreview.data.posOverrides ?? {});
    setSelected(undefined);
    notify(
      `Archivo importado: ${importPreview.summary?.persons ?? 0} personas, ${importPreview.summary?.unions ?? 0} uniones.`
    );
    setImportPreview(undefined);
    if (fileRef.current) fileRef.current.value = "";
  }, [importPreview, storeImportData, notify]);
  const readCsvFile = useCallback(
    (file: File, kind: CsvFileKind) => {
      const reader = new FileReader();
      reader.onload = () => {
        setCsvTexts((prev) => ({
          ...prev,
          [kind]: String(reader.result ?? ""),
        }));
      };
      reader.onerror = () => notify("No se pudo leer el archivo CSV.");
      reader.readAsText(file);
    },
    [notify]
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
      `CSV importado: ${applied.persons.length} personas, ${applied.unions.length} uniones, ${applied.relationships.length} relaciones.`
    );
    closeCsvDialog();
  }, [csvPlan, data, storeImportData, notify, closeCsvDialog]);
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
              Archivo Hawthorne
            </p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Árbol genealógico / editable
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-5 text-xs text-muted-foreground sm:flex">
          <span>{data.persons.length} personas</span>
          <span>{data.unions.length} uniones</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setExportOpen(true)}
          >
            Exportar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileRef.current?.click()}
          >
            Importar JSON
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCsvOpen(true)}>
            Importar CSV
          </Button>
          <Button size="sm" onClick={() => setCreatePersonOpen(true)}>
            Crear nueva persona
          </Button>
        </div>
        <Button
          size="sm"
          className="sm:hidden"
          onClick={() => setCreatePersonOpen(true)}
        >
          Crear
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={() => setExportOpen(true)}
          aria-label="Exportar árbol"
        >
          <Download className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={() => fileRef.current?.click()}
          aria-label="Importar árbol desde JSON"
        >
          <Upload className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={() => setCsvOpen(true)}
          aria-label="Importar desde CSV"
        >
          <FileUp className="size-4" />
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Seleccionar archivo JSON para importar"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleImportFile(file);
          }}
        />
        <Button
          size="icon"
          variant="outline"
          onClick={() => setHelpOpen(true)}
          aria-label="Cómo usar el árbol genealógico"
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
                Empieza tu árbol
              </h2>
              <p className="text-sm text-muted-foreground">
                Aún no hay personas en este archivo. Crea la primera o importa
                un archivo JSON.
              </p>
              <div className="mt-1 flex flex-wrap justify-center gap-2">
                <Button size="sm" onClick={() => setCreatePersonOpen(true)}>
                  Crea tu primera persona
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                >
                  Importar JSON
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
            notify(result.error ?? "No se pudo eliminar.");
            return;
          }
          setSelected(undefined);
          notify("Persona desvinculada del archivo.");
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
              <DialogTitle>Editar datos de la persona</DialogTitle>
              <DialogDescription>
                Actualiza la información básica sin cambiar las conexiones
                familiares.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={saveEdit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-first">Nombre</Label>
                  <Input
                    id="edit-first"
                    name="firstName"
                    defaultValue={editing.firstName}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="edit-last">Apellidos</Label>
                  <Input
                    id="edit-last"
                    name="lastName"
                    defaultValue={editing.lastName}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-birth">Fecha de nacimiento</Label>
                <Input
                  id="edit-birth"
                  name="birthDate"
                  type="date"
                  defaultValue={editing.birthDate}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-bio">Biografía</Label>
                <Textarea id="edit-bio" name="bio" defaultValue={editing.bio} />
              </div>
              <Button type="submit">Guardar cambios</Button>
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
              <DialogTitle>Crear unión de pareja</DialogTitle>
              <DialogDescription>
                ¿Quieres unir a {pendingSource.firstName}{" "}
                {pendingSource.lastName} y {pendingTarget.firstName}{" "}
                {pendingTarget.lastName} como pareja? Después podrás añadir sus
                hijos desde el círculo de la unión.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setPendingUnion(undefined)}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  connectPeople(pendingUnion.sourceId, pendingUnion.targetId);
                  setPendingUnion(undefined);
                }}
              >
                Crear unión
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
              <DialogTitle>Cómo usar el árbol genealógico</DialogTitle>
              <DialogDescription>
                Guía rápida para ver, mover y ampliar tu familia.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 text-sm leading-6">
              <section>
                <h3 className="font-semibold">Tarjeta de persona</h3>
                <p className="text-muted-foreground">
                  Un clic abre su ficha con biografía y familiares. El menú ⋯
                  permite añadir padre/madre, pareja o hijo. El doble clic
                  centra su linaje (padres, pareja e hijos) en pantalla.
                </p>
              </section>
              <section>
                <h3 className="font-semibold">Círculo pequeño: la unión</h3>
                <p className="text-muted-foreground">
                  Representa a una pareja. El botón + que aparece al pasar el
                  cursor añade un hijo a esa pareja.
                </p>
              </section>
              <section>
                <h3 className="font-semibold">Crear personas</h3>
                <p className="text-muted-foreground">
                  Usa Crear para una persona suelta o Nueva rama familiar
                  independiente. Para vincular a alguien que ya existe, elige la
                  pestaña Elegir existente en el formulario.
                </p>
              </section>
              <section>
                <h3 className="font-semibold">Conectar parejas arrastrando</h3>
                <p className="text-muted-foreground">
                  En escritorio, arrastra una tarjeta sobre otra para proponer
                  una unión; siempre pide confirmación. En táctil, arrastrar
                  solo mueve (para no chocar con el desplazamiento): crea la
                  pareja desde el menú ⋯ → &quot;Añadir pareja&quot;. Mover
                  nodos no altera al resto: cada posición que cambies se
                  conserva.
                </p>
              </section>
              <section>
                <h3 className="font-semibold">Explorar</h3>
                <p className="text-muted-foreground">
                  Busca por nombre, cambia entre diseño vertical y horizontal,
                  centra la vista o alterna claro/oscuro desde la barra superior
                  del lienzo.
                </p>
              </section>
              <section>
                <h3 className="font-semibold">Editar y eliminar</h3>
                <p className="text-muted-foreground">
                  Desde la ficha puedes editar datos o desvincular a la persona.
                  Por seguridad no se puede eliminar a quien tenga pareja o
                  hijos: desvincúlalos primero.
                </p>
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
              <DialogTitle>Importar archivo JSON</DialogTitle>
              <DialogDescription>
                Revisa el resumen de {importPreview.fileName} antes de
                aplicarlo. Se reemplazarán los datos actuales.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 text-sm">
              <p>
                {importPreview.summary?.persons ?? 0} personas ·{" "}
                {importPreview.summary?.unions ?? 0} uniones ·{" "}
                {importPreview.summary?.relationships ?? 0} relaciones
              </p>
              <p className="text-muted-foreground">
                El archivo es válido y conserva el formato canónico con versión.
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
                Cancelar
              </Button>
              <Button onClick={applyImport}>Aplicar importación</Button>
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
              <DialogTitle>Importar CSV</DialogTitle>
              <DialogDescription>
                Sube personas.csv (obligatorio) y, si quieres, uniones.csv y
                relaciones.csv. Las filas válidas se aplican y las inválidas se
                listan. Plantillas:{" "}
                <a
                  className="underline"
                  href="/plantilla-personas.csv"
                  download
                >
                  personas
                </a>
                {", "}
                <a className="underline" href="/plantilla-uniones.csv" download>
                  uniones
                </a>
                {", "}
                <a
                  className="underline"
                  href="/plantilla-relaciones.csv"
                  download
                >
                  relaciones
                </a>
                .
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              {(
                [
                  ["personas", "personas.csv (obligatorio)"],
                  ["uniones", "uniones.csv (opcional)"],
                  ["relaciones", "relaciones.csv (opcional)"],
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
                        Cargado
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {csvPlan && (
                <div className="flex flex-col gap-2 text-sm">
                  <p>
                    Se aplicarán: {csvPlan.applied.persons.length} personas ·{" "}
                    {csvPlan.applied.unions.length} uniones ·{" "}
                    {csvPlan.applied.relationships.length} relaciones.
                  </p>
                  {csvPlan.rejected.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      <p className="font-semibold">
                        Filas rechazadas ({csvPlan.rejected.length}):
                      </p>
                      <ul className="max-h-48 overflow-y-auto rounded-xl border p-3 text-xs leading-5">
                        {csvPlan.rejected.slice(0, 100).map((error, index) => (
                          <li key={index}>
                            {error.file}.csv · línea {error.line}
                            {error.field ? ` · ${error.field}` : ""}:{" "}
                            {error.message}
                          </li>
                        ))}
                      </ul>
                      {csvPlan.rejected.length > 100 && (
                        <p className="text-xs text-muted-foreground">
                          … y {csvPlan.rejected.length - 100} más.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">
                      Todas las filas son válidas.
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeCsvDialog}>
                Cancelar
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
                Aplicar válidas
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
              <DialogTitle>Exportar árbol</DialogTitle>
              <DialogDescription>
                JSON canónico (copia de seguridad) o CSV espejo v1.0 (personas,
                uniones, relaciones).
              </DialogDescription>
            </DialogHeader>
            {hasLivingPersons(data.persons) && (
              <p
                role="note"
                className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs leading-5"
              >
                Aviso de privacidad: el archivo incluye personas vivas (sin
                fecha de fallecimiento). Compártelo solo con tu familia.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleExportJson}>
                JSON canónico
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
                Cerrar
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
