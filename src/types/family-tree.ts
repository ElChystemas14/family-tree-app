/**
 * Family Tree Domain Types
 * Strict interfaces for persons, unions, and relationships
 */

export interface Person {
  id: string
  firstName: string
  lastName: string
  gender: 'male' | 'female' | 'other'
  birthDate: string // ISO 8601 date string
  deathDate?: string // ISO 8601 date string, optional for living persons
  photoUrl?: string
  bio?: string
  attributes?: {
    adopted?: boolean
    [key: string]: unknown
  }
}

export interface Union {
  id: string
  partner1Id: string
  partner2Id: string
  unionType: 'marriage' | 'partnership' | 'domestic'
  startDate?: string
  endDate?: string
}

export interface ChildRelationship {
  id: string
  childId: string
  unionId?: string // Links to a Union if both parents known
  singleParentId?: string // For single-parent relationships (only one set)
  type: 'biological' | 'adopted' | 'step'
}

export interface FamilyTreeData {
  persons: Person[]
  unions: Union[]
  relationships: ChildRelationship[]
}

/**
 * React Flow Graph Types
 */
export interface PersonNodeData {
  id: string
  firstName: string
  lastName: string
  birthDate: string
  deathDate?: string
  gender: 'male' | 'female' | 'other'
  photoUrl?: string
  generation: number
  isSelected: boolean
  isSearchFocused: boolean
  isDimmed?: boolean
  isPathHighlighted?: boolean
  layout: LayoutMode
  onQuickAction?: (action: 'parent' | 'spouse' | 'child') => void
}

export interface UnionNodeData {
  id: string
  partner1Id: string
  partner2Id: string
  isDimmed?: boolean
  isPathHighlighted?: boolean
  layout: LayoutMode
  onAddChild?: () => void
}

export type NodeData = PersonNodeData | UnionNodeData

export interface GraphData {
  nodes: Array<{
    id: string
    data: NodeData
    position: { x: number; y: number }
    type: 'person' | 'union'
  }>
  edges: Array<{
    id: string
    source: string
    target: string
    animated?: boolean
  }>
}

export type LayoutMode = 'vertical' | 'horizontal'
