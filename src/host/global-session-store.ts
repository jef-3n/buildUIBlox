import {
  ARTIFACT_PATHS,
} from '../contracts/artifact-policy';
import {
  type GlobalSessionSnapshot,
  isCompatibleGlobalSessionSnapshot,
} from '../contracts/global-session';

export type GlobalSessionStoreOrigin = 'local' | 'remote';

export type GlobalSessionStoreListener = (
  snapshot: GlobalSessionSnapshot,
  origin: GlobalSessionStoreOrigin
) => void;

const resolveStorage = (): Storage | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

export class GlobalSessionStore {
  private storageKey: string;
  private storage?: Storage;
  private snapshot: GlobalSessionSnapshot;
  private listeners = new Set<GlobalSessionStoreListener>();

  constructor(appId: string, initialSnapshot: GlobalSessionSnapshot) {
    this.storageKey = ARTIFACT_PATHS.globalSession(appId);
    this.storage = resolveStorage();
    this.snapshot = initialSnapshot;
  }

  connect() {
    if (!this.storage) {
      return;
    }
    const existing = this.storage.getItem(this.storageKey);
    if (existing) {
      const parsed = this.parseSnapshot(existing);
      if (parsed) {
        this.snapshot = parsed;
      }
    } else {
      this.persistSnapshot(this.snapshot);
    }
    globalThis.addEventListener('storage', this.handleStorageEvent);
  }

  disconnect() {
    globalThis.removeEventListener('storage', this.handleStorageEvent);
  }

  subscribe(listener: GlobalSessionStoreListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  read() {
    return this.snapshot;
  }

  write(snapshot: GlobalSessionSnapshot, origin: GlobalSessionStoreOrigin = 'local') {
    this.snapshot = snapshot;
    this.persistSnapshot(snapshot);
    this.notify(snapshot, origin);
  }

  private notify(snapshot: GlobalSessionSnapshot, origin: GlobalSessionStoreOrigin) {
    for (const listener of this.listeners) {
      listener(snapshot, origin);
    }
  }

  private parseSnapshot(value: string) {
    try {
      const parsed = JSON.parse(value);
      if (!isCompatibleGlobalSessionSnapshot(parsed)) {
        return undefined;
      }
      return parsed;
    } catch {
      return undefined;
    }
  }

  private persistSnapshot(snapshot: GlobalSessionSnapshot) {
    if (!this.storage) {
      return;
    }
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(snapshot));
    } catch {
      // Best-effort persistence for offline/local use.
    }
  }

  private handleStorageEvent = (event: StorageEvent) => {
    if (!event.key || event.key !== this.storageKey) {
      return;
    }
    if (!event.newValue) {
      return;
    }
    const parsed = this.parseSnapshot(event.newValue);
    if (!parsed) {
      return;
    }
    this.snapshot = parsed;
    this.notify(parsed, 'remote');
  };
}
