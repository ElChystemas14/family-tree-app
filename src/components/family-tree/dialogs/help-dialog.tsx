"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function HelpDialog({ open, onClose }: Props) {
  const tHelp = useTranslations("help");
  if (!open) return null;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
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
  );
}
