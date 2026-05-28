const KEY = "ozen.lastSeenVersion";

export function getLastSeenVersion(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setLastSeenVersion(v: string): void {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    // localStorage unavailable — silent fail; the modal will simply re-show
    // next launch, which is preferable to crashing.
  }
}
