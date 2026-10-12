import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../auth/useAuth";
import { fingerprintOf, importKey } from "../crypto";
import { EncryptionKeyContext, type EncryptionKeyContextValue } from "./EncryptionKeyContext";

interface LoadedKey {
  ownerId: string; // the user the key was loaded for
  key: CryptoKey;
  fingerprint: string;
}

export function EncryptionKeyProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { state } = useAuth();
  const user = state.status === "authenticated" ? state.user : null;

  const [loaded, setLoaded] = useState<LoadedKey | null>(null);

  // The key counts only for the user it was loaded for. After a logout (or a
  // different user logging in) it is simply not offered any more: derived from
  // the auth state, no effect needed to "clear it at the right moment".
  const active = loaded && user && loaded.ownerId === user.id ? loaded : null;

  const loadKey = useCallback(
    async (base64Key: string) => {
      if (!user) throw new Error("Log in first.");
      const key = await importKey(base64Key);
      const fingerprint = await fingerprintOf(key);

      // Compare with the fingerprint registered at onboarding, so a wrong key is
      // caught now instead of producing files nobody can decrypt.
      if (fingerprint !== user.keyFingerprint) {
        throw new Error("This is not the key registered for your account.");
      }
      setLoaded({ ownerId: user.id, key, fingerprint });
    },
    [user],
  );

  const activateGeneratedKey = useCallback(
    (key: CryptoKey, fingerprint: string) => {
      if (user) setLoaded({ ownerId: user.id, key, fingerprint });
    },
    [user],
  );

  const clearKey = useCallback(() => setLoaded(null), []);

  const value = useMemo<EncryptionKeyContextValue>(
    () => ({ key: active?.key ?? null, fingerprint: active?.fingerprint ?? null, loadKey, activateGeneratedKey, clearKey }),
    [active, loadKey, activateGeneratedKey, clearKey],
  );

  return <EncryptionKeyContext.Provider value={value}>{children}</EncryptionKeyContext.Provider>;
}
