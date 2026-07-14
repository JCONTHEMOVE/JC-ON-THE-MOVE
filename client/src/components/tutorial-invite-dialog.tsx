import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, GraduationCap, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type TutorialAudience = "admin" | "crew";

interface TutorialInviteDialogProps {
  audience: TutorialAudience;
  currentPath: string;
  onNavigate: (path: string) => void;
}

const DISMISS_PREFIX = "jc-tutorial-invite-dismissed-v1";
const INVITE_DELAY_MS = 900;

const inviteCopy: Record<TutorialAudience, {
  title: string;
  description: string;
  route: string;
  optionHint: string;
  points: string[];
}> = {
  admin: {
    title: "Need a quick app walkthrough?",
    description: "The admin tutorials now walk you through booking text leads, dispatching work, and checking the money and people screens.",
    route: "/admin/tutorials",
    optionHint: "Find it anytime in Options > Tutorials.",
    points: ["Book a text-message lead", "Dispatch and prep ETA notes", "Check pricing, finance, and people"],
  },
  crew: {
    title: "New here or need a refresher?",
    description: "The crew tutorials show each worker how to start the day, handle assigned jobs, create a customer request, and launch a tracked local marketing post.",
    route: "/crew/tutorials",
    optionHint: "Find it anytime in Options > Tutorials.",
    points: ["Start a worker shift", "Accept and complete jobs", "Create a customer request", "Launch a tracked local marketing post"],
  },
};

export function TutorialInviteDialog({ audience, currentPath, onNavigate }: TutorialInviteDialogProps) {
  const copy = inviteCopy[audience];
  const storageKey = `${DISMISS_PREFIX}-${audience}`;
  const [open, setOpen] = useState(false);

  const alreadyOnTutorials = useMemo(
    () => currentPath === copy.route || currentPath.startsWith(`${copy.route}/`),
    [copy.route, currentPath],
  );

  useEffect(() => {
    if (alreadyOnTutorials) {
      return;
    }

    try {
      if (window.localStorage.getItem(storageKey) === "true") {
        return;
      }
    } catch {
      return;
    }

    const inviteTimer = window.setTimeout(() => setOpen(true), INVITE_DELAY_MS);
    return () => window.clearTimeout(inviteTimer);
  }, [alreadyOnTutorials, storageKey]);

  function dismiss() {
    try {
      window.localStorage.setItem(storageKey, "true");
    } catch {
      // Ignore private-mode storage failures; the dialog can safely close for this session.
    }
    setOpen(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      dismiss();
      return;
    }
    setOpen(true);
  }

  function openTutorials() {
    dismiss();
    onNavigate(copy.route);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[92vw] border-slate-700 bg-slate-950 p-0 text-white shadow-2xl sm:max-w-lg">
        <div className="border-b border-slate-800 bg-slate-900/70 px-5 py-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-200">
            <Sparkles className="h-3.5 w-3.5" />
            Training is ready
          </div>
          <DialogHeader className="mt-4 text-left">
            <DialogTitle className="flex items-center gap-2 text-xl font-black text-white">
              <GraduationCap className="h-5 w-5 text-blue-300" />
              {copy.title}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-slate-300">
              {copy.description}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-3 px-5 py-4">
          {copy.points.map((point) => (
            <div key={point} className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-300" />
              <span className="text-sm font-semibold text-slate-100">{point}</span>
            </div>
          ))}
          <p className="text-xs font-medium text-slate-400">{copy.optionHint}</p>
        </div>

        <DialogFooter className="gap-2 border-t border-slate-800 px-5 py-4 sm:justify-between sm:space-x-0">
          <Button
            type="button"
            variant="ghost"
            onClick={dismiss}
            className="text-slate-300 hover:bg-white/10 hover:text-white"
          >
            Later
          </Button>
          <Button
            type="button"
            onClick={openTutorials}
            className="bg-blue-600 text-white hover:bg-blue-500"
          >
            Open tutorials
            <ArrowRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
