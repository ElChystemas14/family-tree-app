'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Background, Controls, ReactFlow, ReactFlowProvider, useReactFlow, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { PersonNode } from './person-node'
import { UnionNode } from './union-node'
import { TreeControls } from './tree-controls'
import { PersonDetailSheet } from './person-detail-sheet'
import { AddRelativeModal } from './add-relative-modal'
import { familyTreeData } from '@/lib/family-tree/mock-data'
import { transformFamilyToGraph } from '@/lib/family-tree/transform'
import type { LayoutMode, Person, Union } from '@/types/family-tree'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const nodeTypes = { person: PersonNode, union: UnionNode }
type ModalState = { relationship?: 'parent' | 'spouse' | 'child'; personId?: string; unionId?: string }

function FlowInner() {
  const { fitView, getIntersectingNodes } = useReactFlow()
  const [data, setData] = useState(familyTreeData)
  const [layout, setLayout] = useState<LayoutMode>('vertical')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Person>()
  const [dark, setDark] = useState(true)
  const [modal, setModal] = useState<ModalState>()
  const [createPersonOpen, setCreatePersonOpen] = useState(false)
  const [editing, setEditing] = useState<Person>()
  const [toast, setToast] = useState('')

  const notify = useCallback((message: string) => { setToast(message); window.setTimeout(() => setToast(''), 3200) }, [])
  const openRelationship = useCallback((relationship: 'parent' | 'spouse' | 'child', personId?: string, unionId?: string) => setModal({ relationship, personId, unionId }), [])
  const addPerson = useCallback((personInput: Omit<Person, 'id'>, existingId?: string) => {
    setData((current) => {
      const personId = existingId ?? `person-${Date.now()}`
      const person = existingId ? current.persons.find((item) => item.id === existingId) : { ...personInput, id: personId }
      if (!person) return current
      if (existingId && !modal?.relationship) { setSelected(person); return current }
      const persons = existingId ? current.persons : [...current.persons, person]
      let unions = [...current.unions]; let relationships = [...current.relationships]
      const anchor = modal?.personId
      if (modal?.relationship === 'spouse' && anchor && personId !== anchor && !unions.some((item) => [item.partner1Id, item.partner2Id].includes(anchor) && [item.partner1Id, item.partner2Id].includes(personId))) unions = [...unions, { id: `union-${Date.now()}`, partner1Id: anchor, partner2Id: personId, unionType: 'marriage' }]
      if (modal?.relationship === 'parent' && anchor) { const unionId = `union-${Date.now()}`; unions = [...unions, { id: unionId, partner1Id: personId, partner2Id: anchor, unionType: 'partnership' }]; relationships = [...relationships, { id: `rel-${Date.now()}`, childId: anchor, unionId, type: 'biological' }] }
      if (modal?.relationship === 'child' && anchor) { const union = modal.unionId ? unions.find((item) => item.id === modal.unionId) : unions.find((item) => item.partner1Id === anchor || item.partner2Id === anchor); relationships = [...relationships, { id: `rel-${Date.now()}`, childId: personId, unionId: union?.id, singleParentId: union ? undefined : anchor, type: 'biological' }] }
      setSelected(person); return { persons, unions, relationships }
    })
    setModal(undefined); setCreatePersonOpen(false)
  }, [modal])
  const addBranch = useCallback(() => setCreatePersonOpen(true), [])
  const connectPeople = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return notify('A person cannot be connected to themselves.')
    setData((current) => { if (current.unions.some((union) => [union.partner1Id, union.partner2Id].includes(sourceId) && [union.partner1Id, union.partner2Id].includes(targetId))) { notify('These people are already connected.'); return current }; const union: Union = { id: `union-${Date.now()}`, partner1Id: sourceId, partner2Id: targetId, unionType: 'partnership' }; notify('Family branches connected.'); return { ...current, unions: [...current.unions, union] } })
  }, [notify])
  const graph = useMemo(() => transformFamilyToGraph(data.persons, data.unions, data.relationships, layout, selected?.id, (id, action) => openRelationship(action, id), (id) => openRelationship('child', undefined, id)), [data, layout, selected, openRelationship])
  const nodes = useMemo(() => graph.nodes.map((node) => ({ ...node, data: node.type === "person" && "firstName" in node.data && "lastName" in node.data ? { ...node.data, isSearchFocused: !!search && `${node.data.firstName} ${node.data.lastName}`.toLowerCase().includes(search.toLowerCase()) } : node.data })), [graph.nodes, search]) as unknown as Node[]
  const saveEdit = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!editing) return; const form = new FormData(event.currentTarget); const updated = { ...editing, firstName: String(form.get('firstName') || '').trim(), lastName: String(form.get('lastName') || '').trim(), birthDate: String(form.get('birthDate') || ''), bio: String(form.get('bio') || '') }; if (!updated.firstName || !updated.lastName) return; setData((current) => ({ ...current, persons: current.persons.map((person) => person.id === updated.id ? updated : person) })); setSelected(updated); setEditing(undefined); notify('Person details updated.') }
  useEffect(() => { document.documentElement.classList.toggle('dark', dark) }, [dark])
  return <main className="relative flex h-dvh min-h-[700px] flex-col overflow-hidden bg-background"><header className="flex h-16 shrink-0 items-center justify-between border-b bg-card px-5"><div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">H</div><div><p className="text-sm font-semibold tracking-tight">Hawthorne Archive</p><p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Family tree / editable</p></div></div><div className="hidden items-center gap-5 text-xs text-muted-foreground sm:flex"><span>{data.persons.length} people</span><span>{data.unions.length} unions</span><Button size="sm" onClick={() => setCreatePersonOpen(true)}>Create new person</Button></div></header><section className="relative min-h-0 flex-1"><TreeControls persons={data.persons} search={search} onSearch={setSearch} onSelectPerson={setSelected} onNewBranch={addBranch} layout={layout} onLayout={(value) => { setLayout(value); window.setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 80) }} onCenter={() => fitView({ padding: 0.2, duration: 500 })} dark={dark} onTheme={() => setDark((value) => !value)} /><ReactFlow nodes={nodes} edges={graph.edges as Edge[]} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.2 }} onNodeClick={(_, node) => { const person = data.persons.find((item) => item.id === node.id); if (person) setSelected(person) }} onNodeDragStop={(_, node) => { if (node.type !== 'person') return; const target = getIntersectingNodes(node).find((item) => item.type === 'person' && item.id !== node.id); if (target) connectPeople(node.id, target.id) }} proOptions={{ hideAttribution: true }} minZoom={0.2} maxZoom={1.5}><Background gap={24} size={1} className="opacity-60" /><Controls className="!bottom-5 !left-5" showInteractive={false} /><div aria-label="Family tree preview" className="absolute bottom-5 right-5 z-10 hidden h-32 w-56 overflow-hidden rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur sm:block"><div className="relative h-full w-full">{nodes.filter((node) => node.type === 'person').map((node) => { const x = ((node.position.x + 80) / 1700) * 100; const y = ((node.position.y + 20) / 900) * 100; return <span key={node.id} className="absolute h-1.5 w-3 rounded-sm bg-primary/80" style={{ left: `${Math.max(2, Math.min(94, x))}%`, top: `${Math.max(3, Math.min(94, y))}%` }} /> })}<span className="absolute inset-1 rounded-lg border border-primary/20" /></div></div></ReactFlow></section><PersonDetailSheet person={selected} open={!!selected} onOpenChange={(open) => !open && setSelected(undefined)} onSelectRelative={setSelected} onEdit={() => selected && setEditing(selected)} onDelete={() => { if (!selected) return; setData((current) => ({ ...current, persons: current.persons.filter((person) => person.id !== selected.id), unions: current.unions.filter((union) => union.partner1Id !== selected.id && union.partner2Id !== selected.id), relationships: current.relationships.filter((rel) => rel.childId !== selected.id) })); setSelected(undefined); notify('Person unlinked from the archive.') }} /><AddRelativeModal open={!!modal || createPersonOpen} onOpenChange={(open) => { if (!open) { setModal(undefined); setCreatePersonOpen(false) } }} people={data.persons} relationship={modal?.relationship} onCreate={addPerson} />{editing && <Dialog open onOpenChange={(open) => !open && setEditing(undefined)}><DialogContent><DialogHeader><DialogTitle>Edit person data</DialogTitle><DialogDescription>Update core information without changing family connections.</DialogDescription></DialogHeader><form onSubmit={saveEdit} className="flex flex-col gap-4"><div className="grid grid-cols-2 gap-3"><div className="flex flex-col gap-2"><Label htmlFor="edit-first">First name</Label><Input id="edit-first" name="firstName" defaultValue={editing.firstName} /></div><div className="flex flex-col gap-2"><Label htmlFor="edit-last">Last name</Label><Input id="edit-last" name="lastName" defaultValue={editing.lastName} /></div></div><div className="flex flex-col gap-2"><Label htmlFor="edit-birth">Birth date</Label><Input id="edit-birth" name="birthDate" type="date" defaultValue={editing.birthDate} /></div><div className="flex flex-col gap-2"><Label htmlFor="edit-bio">Biography</Label><Textarea id="edit-bio" name="bio" defaultValue={editing.bio} /></div><Button type="submit">Save changes</Button></form></DialogContent></Dialog>}{toast && <div role="status" className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-primary/30 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-lg">{toast}</div>}</main>
}
export function FamilyTreeCanvas() { return <ReactFlowProvider><FlowInner /></ReactFlowProvider> }
