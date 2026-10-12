import { useContext } from "react";
import { EncryptionKeyContext, type EncryptionKeyContextValue } from "./EncryptionKeyContext";

export function useEncryptionKey(): EncryptionKeyContextValue {
  const context = useContext(EncryptionKeyContext);
  if (!context) throw new Error("useEncryptionKey() must be used inside <EncryptionKeyProvider>.");
  return context;
}
