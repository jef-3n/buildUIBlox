export type FirestoreDocumentSnapshot = {
  exists?: boolean;
  data?: unknown | (() => unknown);
};

export type FirestoreTransactionAdapter = {
  get: (path: string) => Promise<FirestoreDocumentSnapshot | undefined>;
  set: (path: string, data: unknown) => void;
};

export type PipelineCompileRequest = {
  appId: string;
  draftId: string;
  compiledId: string;
  triggeredAt: string;
};

export type FirestoreAdapter = {
  get: (path: string) => Promise<FirestoreDocumentSnapshot | undefined>;
  set: (path: string, data: unknown) => Promise<void>;
  onSnapshot: (
    path: string,
    callback: (snapshot: FirestoreDocumentSnapshot | undefined) => void,
    onError?: (error: unknown) => void
  ) => () => void;
  runTransaction?: <T>(
    updateFn: (transaction: FirestoreTransactionAdapter) => Promise<T>
  ) => Promise<T>;
  invokeCompileWorker?: (request: PipelineCompileRequest) => Promise<void>;
};

export const resolveSnapshotData = (
  snapshot?: FirestoreDocumentSnapshot
): unknown | undefined => {
  if (!snapshot) {
    return undefined;
  }
  const payload = snapshot.data;
  if (typeof payload === 'function') {
    return payload();
  }
  return payload;
};

export const snapshotExists = (snapshot?: FirestoreDocumentSnapshot): boolean => {
  if (!snapshot) {
    return false;
  }
  if (typeof snapshot.exists === 'boolean') {
    return snapshot.exists;
  }
  return typeof snapshot.data !== 'undefined';
};
