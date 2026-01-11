import { ARTIFACT_PATHS } from '../contracts/artifact-policy';
import {
  type DraftArtifact,
  isCompatibleDraftArtifact,
} from './draft-contract';
import type { FirestoreAdapter } from './firestore-adapter';
import { resolveSnapshotData, snapshotExists } from './firestore-adapter';

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
  private firestore?: FirestoreAdapter;
  private firestoreUnsubscribe?: () => void;

  constructor(
    appId: string,
    initialSnapshot: DraftArtifact,
    options?: { firestore?: FirestoreAdapter }
  ) {
    this.storageKey = ARTIFACT_PATHS.draft(appId, initialSnapshot.metadata.draftId);
    this.storage = resolveStorage();
    this.snapshot = initialSnapshot;
    this.firestore = options?.firestore;
  }

  connect() {
    if (!this.storage) {
      this.storage = resolveStorage();
    }
    if (this.storage) {
      const existing = this.storage.getItem(this.storageKey);
      if (existing) {
        const parsed = this.parseSnapshot(existing);
        if (parsed) {
          this.snapshot = parsed;
          this.setStorageKey(parsed.metadata.draftId);
        }
      } else {
        this.persistSnapshot(this.snapshot);
      }
      globalThis.addEventListener('storage', this.handleStorageEvent);
    }
    this.connectFirestore();
  }

  disconnect() {
    globalThis.removeEventListener('storage', this.handleStorageEvent);
    this.firestoreUnsubscribe?.();
    this.firestoreUnsubscribe = undefined;
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
    if (this.isIncomingStale(snapshot, this.snapshot)) {
      return false;
    }
    this.snapshot = snapshot;
    this.setStorageKey(snapshot.metadata.draftId);
    this.persistSnapshot(snapshot);
    void this.persistFirestoreSnapshot(snapshot);
    this.notify(snapshot, origin);
    return true;
  }

  private setStorageKey(draftId: string) {
    const nextKey = ARTIFACT_PATHS.draft(this.snapshot.metadata.appId, draftId);
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

  private isIncomingStale(incoming: DraftArtifact, base: DraftArtifact) {
    const incomingTime = Date.parse(incoming.metadata.updatedAt);
    const baseTime = Date.parse(base.metadata.updatedAt);
    if (Number.isNaN(incomingTime) || Number.isNaN(baseTime)) {
      return false;
    }
    return incomingTime < baseTime;
  }

  private async connectFirestore() {
    if (!this.firestore) {
      return;
    }
    const snapshot = await this.firestore.get(this.storageKey);
    const parsed = this.parseFirestoreSnapshot(snapshot);
    if (parsed && !this.isIncomingStale(parsed, this.snapshot)) {
      this.snapshot = parsed;
      this.setStorageKey(parsed.metadata.draftId);
      this.persistSnapshot(parsed);
      this.notify(parsed, 'remote');
    } else if (!snapshotExists(snapshot)) {
      await this.persistFirestoreSnapshot(this.snapshot);
    }
    this.firestoreUnsubscribe = this.firestore.onSnapshot(
      this.storageKey,
      this.handleFirestoreSnapshot
    );
  }

  private parseFirestoreSnapshot(snapshot?: { data?: unknown | (() => unknown) }) {
    const payload = resolveSnapshotData(snapshot);
    if (!payload) {
      return undefined;
    }
    if (!isCompatibleDraftArtifact(payload)) {
      return undefined;
    }
    return payload;
  }

  private async persistFirestoreSnapshot(snapshot: DraftArtifact) {
    if (!this.firestore) {
      return;
    }
    if (this.firestore.runTransaction) {
      await this.firestore.runTransaction(async (transaction) => {
        const current = this.parseFirestoreSnapshot(
          await transaction.get(this.storageKey)
        );
        if (current && this.isIncomingStale(snapshot, current)) {
          return;
        }
        transaction.set(this.storageKey, snapshot);
      });
      return;
    }
    const existing = this.parseFirestoreSnapshot(await this.firestore.get(this.storageKey));
    if (existing && this.isIncomingStale(snapshot, existing)) {
      return;
    }
    await this.firestore.set(this.storageKey, snapshot);
  }

  private handleFirestoreSnapshot = (snapshot?: { data?: unknown | (() => unknown) }) => {
    const parsed = this.parseFirestoreSnapshot(snapshot);
    if (!parsed) {
      return;
    }
    if (this.isIncomingStale(parsed, this.snapshot)) {
      return;
    }
    this.snapshot = parsed;
    this.setStorageKey(parsed.metadata.draftId);
    this.persistSnapshot(parsed);
    this.notify(parsed, 'remote');
  };

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
