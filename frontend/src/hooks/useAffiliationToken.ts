import { useEffect, useState } from "react";

const STORAGE_KEY = "affiliationToken";

export function useAffiliationToken() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setToken(saved);
    }
  }, []);

  const saveToken = (nextToken: string) => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, nextToken);
    setToken(nextToken);
  };

  const clearToken = () => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.removeItem(STORAGE_KEY);
    setToken(null);
  };

  return { token, saveToken, clearToken };
}
