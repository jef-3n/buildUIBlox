import { ARTIFACT_PATHS } from '../contracts/artifact-policy';
import {
  type DraftArtifact,
  isCompatibleDraftArtifact,
} from './draft-contract';

export type DraftStoreOrigin = 'local' | 'remote';

export type DraftStoreListener = (
  draft: DraftArtifact,
  origin: DraftStoreOrigin
) => void;

const resolveStorage = (): Storage | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

export class DraftArtifactStore {
  private storageKey: string;
  private storage?: Storage;
  private snapshot: DraftArtifact;
  private listeners = new Set<DraftStoreListener>();

  constructor(appId: string, initialSnapshot: DraftArtifact) {
    this.storageKey = ARTIFACT_PATHS.draft(appId, initialSnapshot.draftId);
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

  subscribe(listener: DraftStoreListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  read() {
    return this.snapshot;
  }

  write(snapshot: DraftArtifact, origin: DraftStoreOrigin = 'local') {
    this.snapshot = snapshot;
    this.setStorageKey(snapshot.draftId);
    this.persistSnapshot(snapshot);
    this.notify(snapshot, origin);
  }

  private setStorageKey(draftId: string) {
    const nextKey = ARTIFACT_PATHS.draft(this.snapshot.appId, draftId);
    if (nextKey === this.storageKey) {
      return;
    }
    this.storageKey = nextKey;
  }

  private notify(snapshot: DraftArtifact, origin: DraftStoreOrigin) {
    for (const listener of this.listeners) {
      listener(snapshot, origin);
    }
  }

  private parseSnapshot(value: string) {
    try {
      const parsed = JSON.parse(value);
      if (!isCompatibleDraftArtifact(parsed)) {
        return undefined;
      }
      return parsed;
    } catch {
      return undefined;
    }
  }

  private persistSnapshot(snapshot: DraftArtifact) {
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
