'use client'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { MoreHorizontal } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { getInitials, formatYear } from '@/lib/family-tree/mock-data'
import type { PersonNodeData } from '@/types/family-tree'

export function PersonNode({ data }: NodeProps & { data: PersonNodeData }) {
  return <div className={`person-node group relative w-[260px] rounded-xl border bg-card p-3 shadow-sm transition-all ${data.isDimmed ? 'opacity-25' : 'opacity-100'} ${data.isPathHighlighted ? 'border-primary shadow-lg ring-1 ring-primary/30' : data.isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''} ${data.isSearchFocused ? 'border-primary shadow-lg' : 'border-border'}`}>
    <Handle type="target" position={Position.Top} className="!size-2 !border-0 !bg-primary" />
    <div className="flex items-center gap-3"><Avatar className="size-11 shrink-0 border border-border"><AvatarImage src={data.photoUrl} alt={`${data.firstName} ${data.lastName}`} /><AvatarFallback className="bg-secondary text-xs font-semibold">{getInitials(data)}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="whitespace-nowrap text-sm font-semibold text-card-foreground">{data.firstName} {data.lastName}</p><p className="mt-1 text-xs text-muted-foreground">{formatYear(data.birthDate)} — {data.deathDate ? formatYear(data.deathDate) : 'present'}</p></div><DropdownMenu><DropdownMenuTrigger className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-transparent text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-accent-foreground group-hover:opacity-100 focus-visible:opacity-100" aria-label={`Actions for ${data.firstName} ${data.lastName}`}><MoreHorizontal data-icon /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => data.onQuickAction?.('parent')}>Add Parent</DropdownMenuItem><DropdownMenuItem onClick={() => data.onQuickAction?.('spouse')}>Add Spouse</DropdownMenuItem><DropdownMenuItem onClick={() => data.onQuickAction?.('child')}>Add Child</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
    <div className="mt-3 flex items-center justify-between"><Badge variant="secondary" className="text-[10px] uppercase tracking-wider">Generation {data.generation + 1}</Badge>{data.isSearchFocused && <span className="text-[10px] font-medium text-primary">Match</span>}</div><Handle type="source" position={Position.Bottom} className="!size-2 !border-0 !bg-primary" />
  </div>
}
