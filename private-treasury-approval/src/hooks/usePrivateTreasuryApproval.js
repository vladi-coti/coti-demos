import { useMemo } from "react";
import { usePrivateTreasuryApprovalNative } from "./usePrivateTreasuryApprovalNative";
import { usePrivateTreasuryApprovalPod } from "./usePrivateTreasuryApprovalPod";

export function usePrivateTreasuryApproval(mode = "native") {
  const nativeMode = usePrivateTreasuryApprovalNative();
  const podMode = usePrivateTreasuryApprovalPod();

  return useMemo(() => (mode === "pod" ? podMode : nativeMode), [mode, nativeMode, podMode]);
}
