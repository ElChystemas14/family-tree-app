'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { PersonNode } from './person-node'
import { UnionNode } from './union-node'
import { TreeControls } from './tree-controls'
import { PersonDetailSheet } from './person-detail-sheet'
import { AddRelativeModal } from './add-relative-modal'
import { transformFamilyToGraph } from '@/lib/family-tree/transform'
import { getParentIds, useFamilyTree } from '@/lib/family-tree/store'
import { buildExportFilename, buildExportPayload, loadStoredTree, parseImportedJson, saveStoredTree, type ImportResult } from '@/lib/family-tree/storage'
import { validatePersonForm } from '@/lib/family-tree/schema'
import type { LayoutMode, Person } from '@/types/family-tree'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CircleHelp, Download, Upload } from 'lucide-react'

const nodeTypes = { person: PersonNode, union: UnionNode }
type ModalState = { relationship?: 'parent' | 'spouse' | 'child'; personId?: string; unionId?: string }

function FlowInner() {
  const { fitView, getIntersectingNodes } = useReactFlow()
  const { data, posOverrides, layout, addPerson: storeAddPerson, connectUnion: storeConnectUnion, removePerson: storeRemovePerson, updatePerson: storeUpdatePerson, moveNode, setLayout: setStoreLayout, importData: storeImportData } = useFamilyTree()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Person>()
  const [dark, setDark] = useState(true)
  const [modal, setModal] = useState<ModalState>()
  const [createPersonOpen, setCreatePersonOpen] = useState(false)
  const [pendingUnion, setPendingUnion] = useState<{ sourceId: string; targetId: string }>()
  const [helpOpen, setHelpOpen] = useState(false)
  const [editing, setEditing] = useState<Person>()
  const [toast, setToast] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [importPreview, setImportPreview] = useState<ImportResult & { fileName: string }>()
  const fileRef = useRef<HTMLInputElement>(null)

  const notify = useCallback((message: string) => { setToast(message); window.setTimeout(() => setToast(''), 3200) }, [])
  const openRelationship = useCallback((relationship: 'parent' | 'spouse' | 'child', personId?: string, unionId?: string) => setModal({ relationship, personId, unionId }), [])
  const addPerson = useCallback((personInput: Omit<Person, 'id'>, existingId?: string) => {
    const closeModal = () => { setModal(undefined); setCreatePersonOpen(false) }
    const result = storeAddPerson({ personInput, existingId, relationship: modal?.relationship, anchorId: modal?.personId, unionId: modal?.unionId })
    if (!result.ok) { if (result.error) notify(result.error); return }
    if (result.person) setSelected(result.person)
    closeModal()
  }, [modal, storeAddPerson, notify])
  const addBranch = useCallback(() => setCreatePersonOpen(true), [])
  const changeLayout = useCallback((value: LayoutMode) => { setStoreLayout(value); window.setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 80) }, [setStoreLayout, fitView])
  const connectPeople = useCallback((sourceId: string, targetId: string) => {
    const result = storeConnectUnion(sourceId, targetId)
    notify(result.ok ? 'Ramas familiares conectadas.' : result.error ?? 'No se pudo crear la unión.')
  }, [storeConnectUnion, notify])
  const graph = useMemo(() => transformFamilyToGraph(data.persons, data.unions, data.relationships, layout, selected?.id, (id, action) => openRelationship(action, id), (id) => openRelationship('child', undefined, id)), [data, layout, selected, openRelationship])
  const nodes = useMemo(() => graph.nodes.map((node) => ({ ...node, position: posOverrides[node.id] ?? node.position, data: node.type === "person" && "firstName" in node.data && "lastName" in node.data ? { ...node.data, isSearchFocused: !!search && `${node.data.firstName} ${node.data.lastName}`.toLowerCase().includes(search.toLowerCase()) } : node.data })), [graph.nodes, search, posOverrides]) as unknown as Node[]
  const focusLineage = useCallback((personId: string) => {
    const parents = new Set(getParentIds(personId, data.unions, data.relationships))
    const partners = new Set<string>()
    data.unions.forEach((union) => { if (union.partner1Id === personId) partners.add(union.partner2Id); else if (union.partner2Id === personId) partners.add(union.partner1Id) })
    const children = new Set(data.relationships.filter((rel) => getParentIds(rel.childId, data.unions, data.relationships).includes(personId)).map((rel) => rel.childId))
    const ids = new Set([personId, ...parents, ...partners, ...children])
    fitView({ nodes: nodes.filter((node) => ids.has(node.id)), padding: 0.25, duration: 500 })
  }, [data, fitView, nodes])
  const saveEdit = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!editing) return; const form = new FormData(event.currentTarget); const validation = validatePersonForm({ firstName: String(form.get('firstName') ?? ''), lastName: String(form.get('lastName') ?? ''), gender: editing.gender, birthDate: String(form.get('birthDate') ?? ''), deathDate: editing.deathDate, photoUrl: editing.photoUrl, bio: String(form.get('bio') ?? '') }); if (!validation.ok || !validation.value) { const firstError = validation.errors.firstName ?? validation.errors.lastName ?? validation.errors.birthDate ?? validation.errors.deathDate ?? validation.errors.bio ?? 'Revisa los datos.'; notify(firstError); return } const updated = { ...editing, firstName: validation.value.firstName, lastName: validation.value.lastName, birthDate: validation.value.birthDate, bio: validation.value.bio ?? '' }; const updateResult = storeUpdatePerson(updated); if (!updateResult.ok) { notify(updateResult.error ?? 'No se pudo guardar.'); return } setSelected(updated); setEditing(undefined); notify('Datos de la persona actualizados.') }
  const handleExport = useCallback(() => {
    try {
      const payload = buildExportPayload(data, posOverrides)
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = buildExportFilename()
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      notify('Archivo exportado como copia de seguridad.')
    } catch { notify('No se pudo exportar el archivo.') }
  }, [data, posOverrides, notify])
  const handleImportFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result ?? ''))
        const result = parseImportedJson(parsed)
        if (!result.ok) { notify(`Archivo no válido: ${result.errors[0] ?? 'revisa el formato'}`); return }
        setImportPreview({ ...result, fileName: file.name })
      } catch { notify('No se pudo leer el archivo JSON.') }
    }
    reader.onerror = () => notify('No se pudo leer el archivo JSON.')
    reader.readAsText(file)
  }, [notify])
  const applyImport = useCallback(() => {
    if (!importPreview?.data) return
    storeImportData(importPreview.data, importPreview.data.posOverrides ?? {})
    setSelected(undefined)
    notify(`Archivo importado: ${importPreview.summary?.persons ?? 0} personas, ${importPreview.summary?.unions ?? 0} uniones.`)
    setImportPreview(undefined)
    if (fileRef.current) fileRef.current.value = ''
  }, [importPreview, storeImportData, notify])
  useEffect(() => { document.documentElement.classList.toggle('dark', dark) }, [dark])
  /* eslint-disable react-hooks/set-state-in-effect -- hidratación post-montaje
     intencionada desde localStorage; en render rompería la hidratación SSR (AUD-MED-08). */
  useEffect(() => {
    const stored = loadStoredTree()
    if (stored.data) {
      storeImportData(stored.data, stored.data.posOverrides ?? {})
    } else if (stored.error) {
      notify(stored.error)
    }
    setHydrated(true)
  }, [storeImportData, notify])
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!hydrated) return
    const timer = window.setTimeout(() => {
      const result = saveStoredTree(data, posOverrides)
      if (!result.ok && result.error) notify(result.error)
    }, 500)
    return () => window.clearTimeout(timer)
  }, [data, posOverrides, hydrated, notify])
  const pendingSource = pendingUnion ? data.persons.find((person) => person.id === pendingUnion.sourceId) : undefined
  const pendingTarget = pendingUnion ? data.persons.find((person) => person.id === pendingUnion.targetId) : undefined
  return <main className="family-tree-flow relative flex h-dvh min-h-175 flex-col overflow-hidden bg-background"><header className="flex h-16 shrink-0 items-center justify-between border-b bg-card px-5"><div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">H</div><div><p className="text-sm font-semibold tracking-tight">Archivo Hawthorne</p><p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Árbol genealógico / editable</p></div></div><div className="hidden items-center gap-5 text-xs text-muted-foreground sm:flex"><span>{data.persons.length} personas</span><span>{data.unions.length} uniones</span><Button size="sm" variant="outline" onClick={handleExport}>Exportar JSON</Button><Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>Importar JSON</Button><Button size="sm" onClick={() => setCreatePersonOpen(true)}>Crear nueva persona</Button></div><Button size="sm" className="sm:hidden" onClick={() => setCreatePersonOpen(true)}>Crear</Button><Button size="icon" variant="outline" onClick={handleExport} aria-label="Exportar árbol como JSON"><Download className="size-4" /></Button><Button size="icon" variant="outline" onClick={() => fileRef.current?.click()} aria-label="Importar árbol desde JSON"><Upload className="size-4" /></Button><input ref={fileRef} type="file" accept="application/json,.json" className="hidden" aria-label="Seleccionar archivo JSON para importar" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleImportFile(file) }} /><Button size="icon" variant="outline" onClick={() => setHelpOpen(true)} aria-label="Cómo usar el árbol genealógico"><CircleHelp className="size-4" /></Button></header><section className="relative min-h-0 flex-1"><TreeControls persons={data.persons} search={search} onSearch={setSearch} onSelectPerson={setSelected} onNewBranch={addBranch} layout={layout} onLayout={changeLayout} onCenter={() => fitView({ padding: 0.2, duration: 500 })} dark={dark} onTheme={() => setDark((value) => !value)} /><ReactFlow nodes={nodes} edges={graph.edges as Edge[]} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.2 }} onNodeClick={(_, node) => { const person = data.persons.find((item) => item.id === node.id); if (person) setSelected(person) }} onNodeDoubleClick={(_, node) => { if (data.persons.some((item) => item.id === node.id)) focusLineage(node.id) }} onNodeDragStop={(_, node) => { moveNode(node.id, node.position); if (node.type !== 'person') return; const target = getIntersectingNodes(node).find((item) => item.type === 'person' && item.id !== node.id); if (target) setPendingUnion({ sourceId: node.id, targetId: target.id }) }} minZoom={0.2} maxZoom={1.5}><Background gap={24} size={1} className="opacity-60" /><Controls className="!bottom-5 !left-5" showInteractive={false} /><MiniMap pannable zoomable ariaLabel="Miniatura del árbol genealógico" bgColor="var(--card)" maskColor="color-mix(in oklch, var(--foreground) 16%, transparent)" nodeColor="var(--primary)" /></ReactFlow></section><PersonDetailSheet person={selected} data={data} open={!!selected} onOpenChange={(open) => !open && setSelected(undefined)} onSelectRelative={setSelected} onEdit={() => selected && setEditing(selected)} onDelete={() => { if (!selected) return; const result = storeRemovePerson(selected.id); if (!result.ok) { notify(result.error ?? 'No se pudo eliminar.'); return } setSelected(undefined); notify('Persona desvinculada del archivo.') }} /><AddRelativeModal open={!!modal || createPersonOpen} onOpenChange={(open) => { if (!open) { setModal(undefined); setCreatePersonOpen(false) } }} people={data.persons} relationship={modal?.relationship} onCreate={addPerson} />{editing && <Dialog open onOpenChange={(open) => !open && setEditing(undefined)}><DialogContent><DialogHeader><DialogTitle>Editar datos de la persona</DialogTitle><DialogDescription>Actualiza la información básica sin cambiar las conexiones familiares.</DialogDescription></DialogHeader><form onSubmit={saveEdit} className="flex flex-col gap-4"><div className="grid grid-cols-2 gap-3"><div className="flex flex-col gap-2"><Label htmlFor="edit-first">Nombre</Label><Input id="edit-first" name="firstName" defaultValue={editing.firstName} /></div><div className="flex flex-col gap-2"><Label htmlFor="edit-last">Apellidos</Label><Input id="edit-last" name="lastName" defaultValue={editing.lastName} /></div></div><div className="flex flex-col gap-2"><Label htmlFor="edit-birth">Fecha de nacimiento</Label><Input id="edit-birth" name="birthDate" type="date" defaultValue={editing.birthDate} /></div><div className="flex flex-col gap-2"><Label htmlFor="edit-bio">Biografía</Label><Textarea id="edit-bio" name="bio" defaultValue={editing.bio} /></div><Button type="submit">Guardar cambios</Button></form></DialogContent></Dialog>}{pendingUnion && pendingSource && pendingTarget && <Dialog open onOpenChange={(open) => { if (!open) setPendingUnion(undefined) }}><DialogContent><DialogHeader><DialogTitle>Crear unión de pareja</DialogTitle><DialogDescription>¿Quieres unir a {pendingSource.firstName} {pendingSource.lastName} y {pendingTarget.firstName} {pendingTarget.lastName} como pareja? Después podrás añadir sus hijos desde el círculo de la unión.</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setPendingUnion(undefined)}>Cancelar</Button><Button onClick={() => { connectPeople(pendingUnion.sourceId, pendingUnion.targetId); setPendingUnion(undefined) }}>Crear unión</Button></div></DialogContent></Dialog>}{helpOpen && <Dialog open onOpenChange={(open) => { if (!open) setHelpOpen(false) }}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Cómo usar el árbol genealógico</DialogTitle><DialogDescription>Guía rápida para ver, mover y ampliar tu familia.</DialogDescription></DialogHeader><div className="flex flex-col gap-4 text-sm leading-6"><section><h3 className="font-semibold">Tarjeta de persona</h3><p className="text-muted-foreground">Un clic abre su ficha con biografía y familiares. El menú ⋯ permite añadir padre/madre, pareja o hijo. El doble clic centra su linaje (padres, pareja e hijos) en pantalla.</p></section><section><h3 className="font-semibold">Círculo pequeño: la unión</h3><p className="text-muted-foreground">Representa a una pareja. El botón + que aparece al pasar el cursor añade un hijo a esa pareja.</p></section><section><h3 className="font-semibold">Crear personas</h3><p className="text-muted-foreground">Usa Crear para una persona suelta o Nueva rama familiar independiente. Para vincular a alguien que ya existe, elige la pestaña Elegir existente en el formulario.</p></section><section><h3 className="font-semibold">Conectar parejas arrastrando</h3><p className="text-muted-foreground">Arrastra una tarjeta sobre otra para proponer una unión; siempre pide confirmación. Mover nodos no altera al resto: cada posición que cambies se conserva.</p></section><section><h3 className="font-semibold">Explorar</h3><p className="text-muted-foreground">Busca por nombre, cambia entre diseño vertical y horizontal, centra la vista o alterna claro/oscuro desde la barra superior del lienzo.</p></section><section><h3 className="font-semibold">Editar y eliminar</h3><p className="text-muted-foreground">Desde la ficha puedes editar datos o desvincular a la persona. Por seguridad no se puede eliminar a quien tenga pareja o hijos: desvincúlalos primero.</p></section></div></DialogContent></Dialog>}{importPreview?.data && <Dialog open onOpenChange={(open) => { if (!open) { setImportPreview(undefined); if (fileRef.current) fileRef.current.value = '' } }}><DialogContent><DialogHeader><DialogTitle>Importar archivo JSON</DialogTitle><DialogDescription>Revisa el resumen de {importPreview.fileName} antes de aplicarlo. Se reemplazarán los datos actuales.</DialogDescription></DialogHeader><div className="flex flex-col gap-2 text-sm"><p>{importPreview.summary?.persons ?? 0} personas · {importPreview.summary?.unions ?? 0} uniones · {importPreview.summary?.relationships ?? 0} relaciones</p><p className="text-muted-foreground">El archivo es válido y conserva el formato canónico con versión.</p></div><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => { setImportPreview(undefined); if (fileRef.current) fileRef.current.value = '' }}>Cancelar</Button><Button onClick={applyImport}>Aplicar importación</Button></div></DialogContent></Dialog>}{toast && <div role="status" className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-primary/30 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-lg">{toast}</div>}</main>
}
export function FamilyTreeCanvas() { return <ReactFlowProvider><FlowInner /></ReactFlowProvider> }
