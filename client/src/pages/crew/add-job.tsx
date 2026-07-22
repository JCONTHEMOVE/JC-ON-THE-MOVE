import { ArrowLeft, CalendarPlus } from "lucide-react";
import { useLocation } from "wouter";
import { StaffJobForm } from "@/components/StaffJobForm";

function validDate(value: string | null): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

export default function CrewAddJobPage() {
  const [location, setLocation] = useLocation();
  const requestedDate = validDate(new URLSearchParams(location.split("?")[1] || "").get("date"));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-8 pt-5 sm:px-6">
      <div className="mb-5 flex items-start gap-3">
        <button
          type="button"
          onClick={() => setLocation("/crew")}
          className="mt-0.5 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          aria-label="Back to today"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-blue-300">
            <CalendarPlus className="h-4 w-4" /> Field intake
          </p>
          <h1 className="mt-1 text-2xl font-black text-white">Add a job</h1>
          <p className="mt-1 text-sm text-slate-400">Create the job once, then it appears on the shared calendar and job board.</p>
        </div>
      </div>

      <StaffJobForm
        prefilledDate={requestedDate}
        onSaved={(leadId) => setLocation(`/lead/${encodeURIComponent(leadId)}?returnTo=${encodeURIComponent("/crew")}`)}
      />
    </div>
  );
}
