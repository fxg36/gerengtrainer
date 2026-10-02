// Native builds ship their content in the signed app, with updates via the stores.
import { useState } from "react";
export function useRegisterSW(_options?: {
  onOfflineReady?: () => void;
  onRegisterError?: (error: unknown) => void;
}) {
  return {
    needRefresh: useState(false),
    offlineReady: useState(true),
    updateServiceWorker: async (_reloadPage?: boolean) => {},
  };
}
