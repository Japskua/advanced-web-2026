/**
 * The encryption key context.
 *
 * The key lives only in React state, in memory. It is never sent to the server
 * and never written to localStorage: a reload forgets it and the user pastes it
 * again. That is the price of the server never being able to read the files.
 */
import { createContext } from "react";

export interface EncryptionKeyContextValue {
  key: CryptoKey | null;
  fingerprint: string | null;
  // Import a Base64 key; throws if it is invalid or not this account's key.
  loadKey: (base64Key: string) => Promise<void>;
  // Use an already imported key (right after onboarding generated it).
  activateGeneratedKey: (key: CryptoKey, fingerprint: string) => void;
  clearKey: () => void;
}

export const EncryptionKeyContext = createContext<EncryptionKeyContextValue | undefined>(undefined);
