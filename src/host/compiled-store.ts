import { ARTIFACT_PATHS } from '../contracts/artifact-policy';
import {
  type CompiledArtifact,
  isCompatibleCompiledArtifact,
} from './compiled-contract';

export type CompiledStoreOrigin = 'local' | 'remote';

export type CompiledStoreListener = (
  artifact: CompiledArtifact,
  origin: CompiledStoreOrigin
) => void;

const resolveStorage = (): Storage | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

export class CompiledArtifactStore {
  private storageKey: string;
  private storage?: Storage;
  private snapshot: CompiledArtifact;
  private listeners = new Set<CompiledStoreListener>();

  constructor(appId: string, initialSnapshot: CompiledArtifact) {
    this.storageKey = ARTIFACT_PATHS.compiled(appId, initialSnapshot.compiledId);
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

  subscribe(listener: CompiledStoreListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  read() {
    return this.snapshot;
  }

  write(snapshot: CompiledArtifact, origin: CompiledStoreOrigin = 'local') {
    this.snapshot = snapshot;
    this.setStorageKey(snapshot.compiledId);
    this.persistSnapshot(snapshot);
    this.notify(snapshot, origin);
  }

  private setStorageKey(compiledId: string) {
    const nextKey = ARTIFACT_PATHS.compiled(this.snapshot.appId, compiledId);
    if (nextKey === this.storageKey) {
      return;
    }
    this.storageKey = nextKey;
  }

  private notify(snapshot: CompiledArtifact, origin: CompiledStoreOrigin) {
    for (const listener of this.listeners) {
      listener(snapshot, origin);
    }
  }

  private parseSnapshot(value: string) {
    try {
      const parsed = JSON.parse(value);
      if (!isCompatibleCompiledArtifact(parsed)) {
        return undefined;
      }
      return parsed;
    } catch {
      return undefined;
    }
  }

  private persistSnapshot(snapshot: CompiledArtifact) {
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
