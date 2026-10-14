"use client";

import { useTranslations } from "next-intl";
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
import type { Person } from "@/types/family-tree";

type Props = {
  editing: Person;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export function EditPersonDialog({ editing, onClose, onSubmit }: Props) {
  const tEdit = useTranslations("editDialog");
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tEdit("title")}</DialogTitle>
          <DialogDescription>{tEdit("description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
  );
}
