import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "jcmoves_admin_view_mode";
const EVENT_NAME = "jcmoves-admin-view-mode";

type AdminViewMode = "admin" | "crew";

function readViewMode(): AdminViewMode {
  if (typeof window === "undefined") return "admin";
  return window.localStorage.getItem(STORAGE_KEY) === "crew" ? "crew" : "admin";
}

function writeViewMode(mode: AdminViewMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, mode);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: mode }));
}

export function useAdminViewMode() {
  const [viewMode, setViewModeState] = useState<AdminViewMode>(() => readViewMode());

  useEffect(() => {
    const sync = () => setViewModeState(readViewMode());
    const syncCustom = (event: Event) => {
      const nextMode = (event as CustomEvent<AdminViewMode>).detail;
      setViewModeState(nextMode === "crew" ? "crew" : "admin");
    };

    window.addEventListener("storage", sync);
    window.addEventListener(EVENT_NAME, syncCustom);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(EVENT_NAME, syncCustom);
    };
  }, []);

  const setViewMode = useCallback((mode: AdminViewMode) => {
    writeViewMode(mode);
  }, []);

  return {
    viewMode,
    isCrewPreview: viewMode === "crew",
    setViewMode,
    setCrewPreview: useCallback((enabled: boolean) => {
      writeViewMode(enabled ? "crew" : "admin");
    }, []),
  };
}
