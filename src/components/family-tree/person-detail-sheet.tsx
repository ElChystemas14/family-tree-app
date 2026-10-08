"use client";
import { useTranslations } from "next-intl";
import { Pencil, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  formatDate,
  getFamilyRelationships,
  getInitials,
  getPersonName,
} from "@/lib/family-tree/mock-data";
import type { FamilyTreeData, Person } from "@/types/family-tree";

type Props = {
  person?: Person;
  data: FamilyTreeData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectRelative: (person: Person) => void;
  onEdit?: () => void;
  onDelete?: () => void;
};
function useRelationshipLabels(): Record<string, string> {
  const t = useTranslations("detail");
  return {
    biological: t("relBiological"),
    adopted: t("relAdopted"),
    step: t("relStep"),
    partner: t("relPartner"),
  };
}
function RelativeCard({
  person,
  relationship,
  onSelect,
}: {
  person: Person;
  relationship: string;
  onSelect: () => void;
}) {
  const relationshipLabels = useRelationshipLabels();
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-card p-3 text-left hover:border-primary/40 hover:bg-accent"
    >
      <Avatar className="size-9 border border-border">
        <AvatarImage src={person.photoUrl} alt={getPersonName(person)} />
        <AvatarFallback>{getInitials(person)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {getPersonName(person)}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDate(person.birthDate)}
        </span>
      </span>
      <Badge variant="outline" className="text-[10px]">
        {relationshipLabels[relationship] ?? relationship}
      </Badge>
    </button>
  );
}
export function PersonDetailSheet({
  person,
  data,
  open,
  onOpenChange,
  onSelectRelative,
  onEdit,
  onDelete,
}: Props) {
  const t = useTranslations("detail");
  const family = person
    ? getFamilyRelationships(person.id, data)
    : { parents: [], partners: [], children: [] };
  const isAdopted = family.parents.some(
    (relative) => relative.relationship === "adopted"
  );
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full p-0 sm:max-w-lg">
        <ScrollArea className="h-full">
          <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-7 sm:px-8">
            <SheetHeader className="p-0">
              <div className="flex items-start gap-4">
                <Avatar className="size-20 shrink-0 border border-border">
                  <AvatarImage
                    src={person?.photoUrl}
                    alt={person ? getPersonName(person) : ""}
                  />
                  <AvatarFallback className="bg-secondary text-lg">
                    {person ? getInitials(person) : "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 pt-1">
                  <SheetTitle className="text-balance text-2xl">
                    {person ? getPersonName(person) : t("fallbackTitle")}
                  </SheetTitle>
                  <SheetDescription>
                    {person
                      ? `${formatDate(person.birthDate)}${person.deathDate ? ` — ${formatDate(person.deathDate)}` : t("alive")}`
                      : ""}
                  </SheetDescription>
                  <Badge variant="secondary" className="mt-3">
                    {isAdopted ? t("adopted") : t("member")}
                  </Badge>
                </div>
              </div>
            </SheetHeader>
            {person && (
              <div className="flex flex-col gap-6">
                <div className="flex gap-2">
                  <Button size="sm" onClick={onEdit}>
                    <Pencil data-icon="inline-start" /> {t("edit")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={onDelete}>
                    <Trash2 data-icon="inline-start" /> {t("delete")}
                  </Button>
                </div>
                <section className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {t("bio")}
                  </p>
                  <p className="mt-3 text-sm leading-6">
                    {person.bio ?? t("noBio")}
                  </p>
                </section>
                <Separator />
                <section className="flex flex-col gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {t("connections")}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("connectionsDesc", { name: person.firstName })}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl border p-3">
                      <p className="text-xl font-semibold">
                        {family.parents.length}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("parents")}
                      </p>
                    </div>
                    <div className="rounded-xl border p-3">
                      <p className="text-xl font-semibold">
                        {family.partners.length}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("partners")}
                      </p>
                    </div>
                    <div className="rounded-xl border p-3">
                      <p className="text-xl font-semibold">
                        {family.children.length}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("children")}
                      </p>
                    </div>
                  </div>
                  {[
                    [t("parents"), family.parents],
                    [t("partners"), family.partners],
                    [t("children"), family.children],
                  ].map(([title, items]) => (
                    <section
                      key={String(title)}
                      className="flex flex-col gap-2"
                    >
                      <h3 className="text-sm font-semibold">{String(title)}</h3>
                      {(
                        items as Array<{ person: Person; relationship: string }>
                      ).length ? (
                        (
                          items as Array<{
                            person: Person;
                            relationship: string;
                          }>
                        ).map((item) => (
                          <RelativeCard
                            key={item.person.id}
                            person={item.person}
                            relationship={item.relationship}
                            onSelect={() => onSelectRelative(item.person)}
                          />
                        ))
                      ) : (
                        <p className="rounded-xl border border-dashed px-3 py-3 text-sm text-muted-foreground">
                          {t("noneRegistered", {
                            group: String(title).toLowerCase(),
                          })}
                        </p>
                      )}
                    </section>
                  ))}
                </section>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
