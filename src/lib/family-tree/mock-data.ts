import type { ChildRelationship, FamilyTreeData, Person, Union } from '@/types/family-tree'

export const familyTreeData: FamilyTreeData = {
  persons: [
    { id: 'ruth', firstName: 'Ruth', lastName: 'Hawthorne', gender: 'female', birthDate: '1928-04-12', deathDate: '2011-09-08', bio: 'A patient gardener and keeper of family stories. Ruth documented every branch of the Hawthorne family in careful handwritten journals.', attributes: { occupation: 'Botanist' } },
    { id: 'walter', firstName: 'Walter', lastName: 'Hawthorne', gender: 'male', birthDate: '1925-11-03', deathDate: '1998-06-19', bio: 'Walter built furniture by hand and taught his children to see beauty in useful things.', attributes: { occupation: 'Woodworker' } },
    { id: 'evelyn', firstName: 'Evelyn', lastName: 'Mercer', gender: 'female', birthDate: '1932-06-27', deathDate: '2004-02-14', bio: 'Evelyn was a school principal known for her fierce curiosity and generous spirit.' },
    { id: 'arthur', firstName: 'Arthur', lastName: 'Mercer', gender: 'male', birthDate: '1929-01-21', deathDate: '2001-05-02', bio: 'Arthur loved long rail journeys and kept an extensive collection of maps.' },
    { id: 'margaret', firstName: 'Margaret', lastName: 'Hawthorne', gender: 'female', birthDate: '1954-08-17', photoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=160&h=160&fit=crop&crop=faces', bio: 'Margaret is the family archivist. She has spent the last decade digitising photographs and letters from both sides of the family.', attributes: { occupation: 'Archivist' } },
    { id: 'thomas', firstName: 'Thomas', lastName: 'Hawthorne', gender: 'male', birthDate: '1951-03-09', photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&h=160&fit=crop&crop=faces', bio: 'Thomas grew up near the coast and still returns every summer with a camera and a sketchbook.' },
    { id: 'susan', firstName: 'Susan', lastName: 'Vale', gender: 'female', birthDate: '1956-12-01', bio: 'Susan is an avid traveller and beloved aunt to a growing generation.', attributes: { occupation: 'Cartographer' } },
    { id: 'peter', firstName: 'Peter', lastName: 'Hawthorne', gender: 'male', birthDate: '1958-05-22', deathDate: '2020-10-11', bio: 'Peter was a quiet maker who repaired radios and collected field recordings.' },
    { id: 'james', firstName: 'James', lastName: 'Reed', gender: 'male', birthDate: '1953-02-14', bio: 'James and Margaret shared a love of old films and Sunday markets.' },
    { id: 'lucy', firstName: 'Lucy', lastName: 'Hawthorne', gender: 'female', birthDate: '1981-07-04', photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&h=160&fit=crop&crop=faces', bio: 'Lucy lives in Copenhagen with her family and works in community design.', attributes: { occupation: 'Designer' } },
    { id: 'ben', firstName: 'Benjamin', lastName: 'Hawthorne', gender: 'male', birthDate: '1984-10-19', bio: 'Ben is a teacher, amateur chef, and the family’s most enthusiastic group-chat participant.' },
    { id: 'olivia', firstName: 'Olivia', lastName: 'Reed', gender: 'female', birthDate: '1987-09-28', bio: 'Olivia is a marine biologist based in Wellington.' },
    { id: 'nora', firstName: 'Nora', lastName: 'Hawthorne', gender: 'female', birthDate: '1991-01-16', attributes: { adopted: true }, bio: 'Nora joined the Hawthorne family at age two. She is a ceramic artist and storyteller.' },
    { id: 'william', firstName: 'William', lastName: 'Vale', gender: 'male', birthDate: '1980-05-30', bio: 'William restores vintage bicycles and knows every back road in the county.' },
    { id: 'clara', firstName: 'Clara', lastName: 'Vale', gender: 'female', birthDate: '2010-04-25', bio: 'Clara is a keen climber and aspiring astronomer.' },
    { id: 'henry', firstName: 'Henry', lastName: 'Vale', gender: 'male', birthDate: '2013-11-07', bio: 'Henry loves puzzles, insects, and building elaborate blanket forts.' },
  ],
  unions: [
    { id: 'u-ruth-walter', partner1Id: 'ruth', partner2Id: 'walter', unionType: 'marriage', startDate: '1950-06-10' },
    { id: 'u-evelyn-arthur', partner1Id: 'evelyn', partner2Id: 'arthur', unionType: 'marriage' },
    { id: 'u-margaret-thomas', partner1Id: 'margaret', partner2Id: 'thomas', unionType: 'marriage', startDate: '1978-06-10', endDate: '1998-12-12' },
    { id: 'u-margaret-james', partner1Id: 'margaret', partner2Id: 'james', unionType: 'partnership', startDate: '2001-04-18' },
    { id: 'u-susan-william', partner1Id: 'susan', partner2Id: 'william', unionType: 'marriage' },
  ],
  relationships: [
    { id: 'r-margaret', childId: 'margaret', unionId: 'u-ruth-walter', type: 'biological' }, { id: 'r-peter', childId: 'peter', unionId: 'u-ruth-walter', type: 'biological' },
    { id: 'r-thomas', childId: 'thomas', unionId: 'u-evelyn-arthur', type: 'biological' }, { id: 'r-susan', childId: 'susan', unionId: 'u-evelyn-arthur', type: 'biological' },
    { id: 'r-lucy', childId: 'lucy', unionId: 'u-margaret-thomas', type: 'biological' }, { id: 'r-ben', childId: 'ben', unionId: 'u-margaret-thomas', type: 'biological' },
    { id: 'r-olivia', childId: 'olivia', unionId: 'u-margaret-james', type: 'biological' }, { id: 'r-nora', childId: 'nora', unionId: 'u-margaret-james', type: 'adopted' },
    { id: 'r-clara', childId: 'clara', unionId: 'u-susan-william', type: 'biological' }, { id: 'r-henry', childId: 'henry', unionId: 'u-susan-william', type: 'biological' },
  ],
}

export const getInitials = (person: { firstName: string; lastName: string }) => `${person.firstName[0]}${person.lastName[0]}`
export const formatYear = (date?: string) => date ? new Date(date).getFullYear().toString() : ''
export const formatDate = (date?: string) => date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
export const getPersonName = (person: { firstName: string; lastName: string }) => `${person.firstName} ${person.lastName}`

export interface RelativePerson { person: Person; relationship: ChildRelationship['type'] | 'partner'; union?: Union }
export interface FamilyRelationships { parents: RelativePerson[]; partners: RelativePerson[]; children: RelativePerson[] }

export function getFamilyRelationships(personId: string): FamilyRelationships {
  const { persons, unions, relationships } = familyTreeData
  const personById = new Map(persons.map((person) => [person.id, person]))
  const addUnique = (items: RelativePerson[], relative: RelativePerson) => items.some((item) => item.person.id === relative.person.id) ? items : [...items, relative]
  let parents: RelativePerson[] = [], partners: RelativePerson[] = [], children: RelativePerson[] = []
  relationships.filter((relationship) => relationship.childId === personId).forEach((relationship) => {
    const union = relationship.unionId ? unions.find((item) => item.id === relationship.unionId) : undefined
    const parentIds = union ? [union.partner1Id, union.partner2Id].filter((id) => id !== personId) : relationship.singleParentId ? [relationship.singleParentId] : []
    parentIds.forEach((id) => { const parent = personById.get(id); if (parent) parents = addUnique(parents, { person: parent, relationship: relationship.type, union }) })
  })
  unions.filter((union) => union.partner1Id === personId || union.partner2Id === personId).forEach((union) => {
    const partner = personById.get(union.partner1Id === personId ? union.partner2Id : union.partner1Id)
    if (partner) partners = addUnique(partners, { person: partner, relationship: 'partner', union })
    relationships.filter((relationship) => relationship.unionId === union.id).forEach((relationship) => { const child = personById.get(relationship.childId); if (child) children = addUnique(children, { person: child, relationship: relationship.type, union }) })
  })
  return { parents, partners, children }
}

export function getImmediateRelatives(personId: string) {
  const { parents, partners, children } = getFamilyRelationships(personId)
  return [...parents, ...partners, ...children].map((relative) => relative.person)
}

