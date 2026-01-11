import { ARTIFACT_PATHS } from '../contracts/artifact-policy';
import {
  type CompiledArtifact,
  isCompatibleCompiledArtifact,
} from './compiled-contract';
import type { FirestoreAdapter } from './firestore-adapter';
import { resolveSnapshotData, snapshotExists } from './firestore-adapter';

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
  private firestore?: FirestoreAdapter;
  private firestoreUnsubscribe?: () => void;

  constructor(
    appId: string,
    initialSnapshot: CompiledArtifact,
    options?: { firestore?: FirestoreAdapter }
  ) {
    this.storageKey = ARTIFACT_PATHS.compiled(appId, initialSnapshot.compiledId);
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
    void this.persistFirestoreSnapshot(snapshot);
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

  private isIncomingStale(incoming: CompiledArtifact, base: CompiledArtifact) {
    const incomingTime = Date.parse(incoming.compiledAt);
    const baseTime = Date.parse(base.compiledAt);
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
      this.setStorageKey(parsed.compiledId);
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
    if (!isCompatibleCompiledArtifact(payload)) {
      return undefined;
    }
    return payload;
  }

  private async persistFirestoreSnapshot(snapshot: CompiledArtifact) {
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
    this.setStorageKey(parsed.compiledId);
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
