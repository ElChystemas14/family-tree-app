"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, UserRound } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { Person, Union } from "@/types/family-tree";
import {
  validatePersonForm,
  type PersonFormErrors,
} from "@/lib/family-tree/schema";

type Relationship = "parent" | "spouse" | "child";

export interface LinkOptions {
  unionId?: string;
  singleParent?: boolean;
  relType?: "biological" | "adopted" | "step";
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  people: Person[];
  relationship?: Relationship;
  anchorId?: string;
  unions?: Union[];
  onCreate: (
    person: Omit<Person, "id">,
    existingId?: string,
    opts?: LinkOptions
  ) => void;
};

export function AddRelativeModal({
  open,
  onOpenChange,
  people,
  relationship,
  anchorId,
  unions = [],
  onCreate,
}: Props) {
  const [mode, setMode] = useState<"create" | "existing">("create");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<Person["gender"]>("other");
  const [birthDate, setBirthDate] = useState("");
  const [deathDate, setDeathDate] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [bio, setBio] = useState("");
  const [existingId, setExistingId] = useState("");
  const [errors, setErrors] = useState<PersonFormErrors>({});
  const [relType, setRelType] = useState<"biological" | "adopted" | "step">(
    "biological"
  );
  const [childUnionId, setChildUnionId] = useState("");
  const [singleParent, setSingleParent] = useState(false);
  const t = useTranslations("addRelative");
  const anchorUnions = useMemo(
    () =>
      anchorId
        ? unions.filter(
            (union) =>
              union.partner1Id === anchorId || union.partner2Id === anchorId
          )
        : [],
    [unions, anchorId]
  );
  const unionName = (id: string) => {
    const union = unions.find((item) => item.id === id);
    if (!union) return id;
    const nameOf = (personId: string) => {
      const found = people.find((person) => person.id === personId);
      return found ? `${found.firstName} ${found.lastName}` : personId;
    };
    return `${nameOf(union.partner1Id)} + ${nameOf(union.partner2Id)}`;
  };
  const sortedPeople = useMemo(
    () =>
      people
        .slice()
        .sort((a, b) =>
          `${a.firstName} ${a.lastName}`.localeCompare(
            `${b.firstName} ${b.lastName}`
          )
        ),
    [people]
  );
  const reset = () => {
    setMode("create");
    setFirstName("");
    setLastName("");
    setBirthDate("");
    setDeathDate("");
    setPhotoUrl("");
    setBio("");
    setExistingId("");
    setErrors({});
    setRelType("biological");
    setChildUnionId("");
    setSingleParent(false);
  };
  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };
  const submit = () => {
    const linkOpts: LinkOptions | undefined =
      relationship === "child" || relationship === "parent"
        ? {
            unionId:
              relationship === "child" && !singleParent
                ? childUnionId || undefined
                : undefined,
            singleParent: relationship === "child" && singleParent,
            relType,
          }
        : undefined;
    if (mode === "existing") {
      if (existingId)
        onCreate(
          { firstName: "", lastName: "", gender: "other" },
          existingId,
          linkOpts
        );
      return;
    }
    const validation = validatePersonForm({
      firstName,
      lastName,
      gender,
      birthDate,
      deathDate,
      photoUrl,
      bio,
    });
    if (!validation.ok || !validation.value) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    onCreate(
      {
        firstName: validation.value.firstName,
        lastName: validation.value.lastName,
        gender: validation.value.gender,
        birthDate: validation.value.birthDate,
        deathDate: validation.value.deathDate,
        photoUrl: validation.value.photoUrl,
        bio: validation.value.bio,
        attributes: {},
      },
      undefined,
      linkOpts
    );
    handleOpenChange(false);
  };
  const relationshipLabels: Record<Relationship, string> = {
    parent: t("relationParent"),
    spouse: t("relationSpouse"),
    child: t("relationChild"),
  };
  const heading = relationship
    ? t("addTitle", { relation: relationshipLabels[relationship] })
    : t("createTitle");
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Plus data-icon />
            </span>
            {heading}
          </DialogTitle>
          <DialogDescription>
            {relationship ? t("addDescription") : t("createDescription")}
          </DialogDescription>
        </DialogHeader>
        {(relationship === "child" || relationship === "parent") && (
          <div className="flex flex-col gap-3 rounded-xl border p-3">
            {relationship === "child" && (
              <div className="flex flex-col gap-2">
                <Label>{t("childOf")}</Label>
                {anchorUnions.length > 0 ? (
                  <Select
                    value={singleParent ? "__single__" : childUnionId}
                    onValueChange={(value) => {
                      if (value === "__single__") setSingleParent(true);
                      else {
                        setSingleParent(false);
                        setChildUnionId(value ?? "");
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("unionAuto")}>
                        {singleParent
                          ? t("singleParent")
                          : childUnionId
                            ? unionName(childUnionId)
                            : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {anchorUnions.map((union) => (
                        <SelectItem key={union.id} value={union.id}>
                          {unionName(union.id)}
                        </SelectItem>
                      ))}
                      <SelectItem value="__single__">
                        {t("singleParent")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("singleNote")}
                  </p>
                )}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label>{t("relTypeLabel")}</Label>
              <Select
                value={relType}
                onValueChange={(value) =>
                  setRelType((value as typeof relType | null) ?? "biological")
                }
              >
                <SelectTrigger>
                  <SelectValue>
                    {relType === "adopted"
                      ? t("relAdopted")
                      : relType === "step"
                        ? t("relStep")
                        : t("relBio")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="biological">{t("relBio")}</SelectItem>
                  <SelectItem value="adopted">{t("relAdopted")}</SelectItem>
                  <SelectItem value="step">{t("relStep")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <Tabs
          value={mode}
          onValueChange={(value) =>
            setMode((value as typeof mode | null) ?? "create")
          }
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">{t("tabCreate")}</TabsTrigger>
            <TabsTrigger value="existing">{t("tabExisting")}</TabsTrigger>
          </TabsList>
          <TabsContent value="create" className="flex flex-col gap-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="relative-first">{t("firstName")}</Label>
                <Input
                  id="relative-first"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  aria-invalid={!!errors.firstName}
                />
                {errors.firstName ? (
                  <p role="alert" className="text-xs text-destructive">
                    {errors.firstName}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="relative-last">{t("lastName")}</Label>
                <Input
                  id="relative-last"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  aria-invalid={!!errors.lastName}
                />
                {errors.lastName ? (
                  <p role="alert" className="text-xs text-destructive">
                    {errors.lastName}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label>{t("gender")}</Label>
                <Select
                  value={gender}
                  onValueChange={(value) =>
                    setGender((value as Person["gender"] | null) ?? "other")
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      {gender === "female"
                        ? t("genderFemale")
                        : gender === "male"
                          ? t("genderMale")
                          : t("genderOther")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">{t("genderFemale")}</SelectItem>
                    <SelectItem value="male">{t("genderMale")}</SelectItem>
                    <SelectItem value="other">{t("genderOther")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="relative-photo">{t("photo")}</Label>
                <Input
                  id="relative-photo"
                  value={photoUrl}
                  onChange={(event) => setPhotoUrl(event.target.value)}
                  placeholder={t("photoPlaceholder")}
                  aria-invalid={!!errors.photoUrl}
                />
                {errors.photoUrl ? (
                  <p role="alert" className="text-xs text-destructive">
                    {errors.photoUrl}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="relative-birth">{t("birth")}</Label>
                <Input
                  id="relative-birth"
                  type="date"
                  value={birthDate}
                  onChange={(event) => setBirthDate(event.target.value)}
                  aria-invalid={!!errors.birthDate}
                />
                {errors.birthDate ? (
                  <p role="alert" className="text-xs text-destructive">
                    {errors.birthDate}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="relative-death">{t("death")}</Label>
                <Input
                  id="relative-death"
                  type="date"
                  value={deathDate}
                  onChange={(event) => setDeathDate(event.target.value)}
                  aria-invalid={!!errors.deathDate}
                />
                {errors.deathDate ? (
                  <p role="alert" className="text-xs text-destructive">
                    {errors.deathDate}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="relative-bio">{t("bio")}</Label>
              <Textarea
                id="relative-bio"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder={t("bioPlaceholder")}
                aria-invalid={!!errors.bio}
              />
              {errors.bio ? (
                <p role="alert" className="text-xs text-destructive">
                  {errors.bio}
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              onClick={submit}
              disabled={!firstName.trim() || !lastName.trim()}
            >
              <UserRound data-icon="inline-start" />
              {t("createButton")}
              {relationship
                ? t("createButtonSuffix", {
                    relation: relationshipLabels[relationship],
                  })
                : ""}
            </Button>
          </TabsContent>
          <TabsContent value="existing" className="flex flex-col gap-4 pt-4">
            <div className="flex flex-col gap-2">
              <Label>{t("existingLabel")}</Label>
              <Select
                value={existingId}
                onValueChange={(value) => setExistingId(value ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("existingPlaceholder")}>
                    {(() => {
                      const selected = sortedPeople.find(
                        (person) => person.id === existingId
                      );
                      return selected
                        ? `${selected.firstName} ${selected.lastName}`
                        : null;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {sortedPeople.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.firstName} {person.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" onClick={submit} disabled={!existingId}>
              {t("linkButton")}
              {relationship
                ? t("linkButtonSuffix", {
                    relation: relationshipLabels[relationship],
                  })
                : ""}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
