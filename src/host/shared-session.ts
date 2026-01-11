import type { FrameName } from './frame-types';
import {
  GLOBAL_SESSION_SCHEMA_VERSION,
  type GlobalDesignTokens,
  type GlobalPresenceState,
  type GlobalSessionCompiledShadow,
  type GlobalSessionPipelineState,
  type GlobalSessionPipelineError,
  type GlobalSessionSnapshot,
  type GlobalSessionUpdate,
  isCompatibleGlobalSessionSnapshot,
} from '../contracts/global-session';
import {
  DEFAULT_UI_SCALE,
  clampUiScale,
  createFrameTransformState,
  createUiDrawersState,
  type ActiveSurface,
  type FrameTransformState,
  type UiDrawersState,
} from '../contracts/ui-state';
import { GlobalSessionStore } from './global-session-store';
import type { FirestoreAdapter } from './firestore-adapter';
import type { CompiledArtifact } from './compiled-contract';
import { createCompiledId } from './compiler';
import { ARTIFACT_PATHS } from '../contracts/artifact-policy';

export type PresenceState = GlobalPresenceState;

export type SharedSessionSnapshot = GlobalSessionSnapshot;

type SharedSessionUpdate = GlobalSessionUpdate;

export type SharedSessionEventDetail = {
  state: SharedSessionSnapshot;
  origin: 'local' | 'remote';
  changes: SharedSessionChangeSet;
};

export const SHARED_SESSION_UPDATE_EVENT = 'SHARED_SESSION_UPDATE';

// Presence rules: every session update refreshes presence; stale entries expire after the TTL.
const PRESENCE_TTL_MS = 60_000;

const createSessionId = () =>
  globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const buildPresenceEntry = (
  update: SharedSessionUpdate,
  isLocal: boolean
): PresenceState => ({
  sessionId: update.sessionId,
  activeFrame: update.activeFrame,
  selectionPath: update.selectionPath,
  activeSurface: update.activeSurface,
  scale: update.scale,
  frameTransforms: update.frameTransforms,
  drawers: update.drawers,
  lastSeenAt: update.updatedAt,
  isLocal,
});

const prunePresence = (presence: Record<string, PresenceState>) => {
  const now = Date.now();
  return Object.fromEntries(
    Object.entries(presence).filter(([, entry]) => {
      if (entry.isLocal) return true;
      return now - Date.parse(entry.lastSeenAt) <= PRESENCE_TTL_MS;
    })
  );
};

const shouldApplyUpdate = (incoming: SharedSessionUpdate, current: SharedSessionSnapshot) => {
  if (incoming.revision !== current.revision) {
    return incoming.revision > current.revision;
  }
  if (incoming.updatedAt !== current.updatedAt) {
    return Date.parse(incoming.updatedAt) > Date.parse(current.updatedAt);
  }
  return incoming.sessionId > current.sessionId;
};

type SharedSessionChangeSet = {
  session: boolean;
  surface: boolean;
  pipeline: boolean;
  draftPointers: boolean;
};

const hasPipelineChanged = (
  prev?: GlobalSessionPipelineState,
  next?: GlobalSessionPipelineState
) => {
  if (prev === next) return false;
  if (!prev || !next) return true;
  return (
    prev.status !== next.status ||
    prev.triggeredAt !== next.triggeredAt ||
    prev.abortedAt !== next.abortedAt ||
    prev.publishedAt !== next.publishedAt ||
    prev.tag !== next.tag ||
    prev.notes !== next.notes ||
    prev.draftId !== next.draftId ||
    prev.compiledId !== next.compiledId ||
    prev.error?.code !== next.error?.code ||
    prev.error?.message !== next.error?.message
  );
};

const hasDraftPointersChanged = (prev: SharedSessionSnapshot, next: SharedSessionSnapshot) =>
  prev.draftId !== next.draftId ||
  prev.compiledId !== next.compiledId ||
  prev.compiled?.draftId !== next.compiled?.draftId ||
  prev.compiled?.compiledId !== next.compiled?.compiledId;

const buildChangeSet = (prev: SharedSessionSnapshot, next: SharedSessionSnapshot): SharedSessionChangeSet => ({
  session:
    prev.activeFrame !== next.activeFrame ||
    prev.selectionPath !== next.selectionPath ||
    prev.activeSurface !== next.activeSurface ||
    prev.scale !== next.scale ||
    prev.frameTransforms !== next.frameTransforms ||
    prev.drawers !== next.drawers,
  surface: prev.activeSurface !== next.activeSurface,
  pipeline: hasPipelineChanged(prev.pipeline, next.pipeline),
  draftPointers: hasDraftPointersChanged(prev, next),
});

type DraftPointerUpdate = Pick<SharedSessionUpdate, 'draftId' | 'compiledId' | 'compiled'>;

const resolveDraftId = (update: DraftPointerUpdate, current: SharedSessionSnapshot) =>
  update.draftId ?? update.compiled?.draftId ?? current.draftId;

const resolveCompiledId = (update: DraftPointerUpdate, current: SharedSessionSnapshot) =>
  update.compiledId ?? update.compiled?.compiledId ?? current.compiledId;

const resolveCompiledShadow = (
  update: DraftPointerUpdate,
  nextDraftId?: string,
  nextCompiledId?: string,
  current?: GlobalSessionCompiledShadow
): GlobalSessionCompiledShadow | undefined =>
  update.compiled ??
  (nextDraftId && nextCompiledId
    ? {
        compiledId: nextCompiledId,
        draftId: nextDraftId,
      }
    : current);

const resolveFrameTransforms = (
  frameTransforms: FrameTransformState | undefined,
  scale: number,
  activeFrame: FrameName,
  fallback: FrameTransformState
) => {
  if (frameTransforms) {
    return frameTransforms;
  }
  return {
    ...fallback,
    [activeFrame]: {
      ...fallback[activeFrame],
      scale: clampUiScale(scale),
    },
  };
};

export class SharedSession extends EventTarget {
  private store: GlobalSessionStore;
  private unsubscribe?: () => void;
  private appId: string;
  private firestore?: FirestoreAdapter;
  state: SharedSessionSnapshot;

  constructor(initial: {
    activeFrame: FrameName;
    selectionPath?: string;
    activeSurface: ActiveSurface;
    scale?: number;
    frameTransforms?: FrameTransformState;
    drawers?: UiDrawersState;
    appId?: string;
    draftId?: string;
    compiledId?: string;
    firestore?: FirestoreAdapter;
    tokens?: GlobalDesignTokens;
  }) {
    super();
    const sessionId = createSessionId();
    const updatedAt = new Date().toISOString();
    const draftId = initial.draftId;
    const compiledId = initial.compiledId;
    const scale = clampUiScale(initial.scale ?? DEFAULT_UI_SCALE);
    const frameTransforms =
      initial.frameTransforms ?? createFrameTransformState(scale);
    const drawers = initial.drawers ?? createUiDrawersState();
    this.appId = initial.appId ?? 'demo-app';
    this.firestore = initial.firestore;
    this.state = {
      schemaVersion: GLOBAL_SESSION_SCHEMA_VERSION,
      sessionId,
      revision: 0,
      updatedAt,
      activeFrame: initial.activeFrame,
      selectionPath: initial.selectionPath,
      activeSurface: initial.activeSurface,
      scale,
      frameTransforms,
      drawers,
      draftId,
      compiledId,
      pipeline: {
        status: 'idle',
        draftId,
        compiledId,
      },
      tokens: initial.tokens,
      draftLock: {
        locked: false,
        draftId,
      },
      compiled:
        draftId && compiledId
          ? {
              draftId,
              compiledId,
            }
          : undefined,
      presence: {
        [sessionId]: buildPresenceEntry(
          {
            schemaVersion: GLOBAL_SESSION_SCHEMA_VERSION,
            sessionId,
            revision: 0,
            updatedAt,
            activeFrame: initial.activeFrame,
            selectionPath: initial.selectionPath,
            activeSurface: initial.activeSurface,
            scale,
            frameTransforms,
            drawers,
          },
          true
        ),
      },
    };
    this.store = new GlobalSessionStore(this.appId, this.state, {
      firestore: this.firestore,
    });
  }

  connect() {
    this.store.connect();
    const snapshot = this.store.read();
    if (isCompatibleGlobalSessionSnapshot(snapshot)) {
      this.applySnapshot(snapshot, 'remote');
    }
    this.unsubscribe = this.store.subscribe(this.handleStoreSnapshot);
  }

  disconnect() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.store.disconnect();
  }

  update(
    partial: Partial<
      Pick<
        SharedSessionSnapshot,
        | 'activeFrame'
        | 'selectionPath'
        | 'activeSurface'
        | 'scale'
        | 'frameTransforms'
        | 'drawers'
        | 'draftId'
        | 'compiledId'
        | 'pipeline'
        | 'draftLock'
        | 'compiled'
        | 'tokens'
      >
    >,
    options?: { skipFirestore?: boolean }
  ) {
    const nextState = {
      activeFrame: partial.activeFrame ?? this.state.activeFrame,
      selectionPath:
        'selectionPath' in partial ? partial.selectionPath : this.state.selectionPath,
      activeSurface: partial.activeSurface ?? this.state.activeSurface,
      scale: partial.scale ?? this.state.scale,
      frameTransforms: partial.frameTransforms ?? this.state.frameTransforms,
      drawers: partial.drawers ?? this.state.drawers,
      draftId: partial.draftId ?? this.state.draftId,
      compiledId: partial.compiledId ?? this.state.compiledId,
      pipeline: partial.pipeline ?? this.state.pipeline,
      draftLock: partial.draftLock ?? this.state.draftLock,
      compiled: partial.compiled ?? this.state.compiled,
      tokens: partial.tokens ?? this.state.tokens,
    };

    const hasChanges =
      nextState.activeFrame !== this.state.activeFrame ||
      nextState.selectionPath !== this.state.selectionPath ||
      nextState.activeSurface !== this.state.activeSurface ||
      nextState.scale !== this.state.scale ||
      nextState.frameTransforms !== this.state.frameTransforms ||
      nextState.drawers !== this.state.drawers ||
      nextState.draftId !== this.state.draftId ||
      nextState.compiledId !== this.state.compiledId ||
      nextState.pipeline !== this.state.pipeline ||
      nextState.draftLock !== this.state.draftLock ||
      nextState.compiled !== this.state.compiled ||
      nextState.tokens !== this.state.tokens;

    if (!hasChanges) {
      return;
    }

    const pointerUpdate: DraftPointerUpdate = {
      draftId: nextState.draftId,
      compiledId: nextState.compiledId,
      compiled: nextState.compiled,
    };
    const resolvedDraftId = resolveDraftId(pointerUpdate, this.state);
    const resolvedCompiledId = resolveCompiledId(pointerUpdate, this.state);
    const resolvedCompiledShadow = resolveCompiledShadow(
      pointerUpdate,
      resolvedDraftId,
      resolvedCompiledId,
      this.state.compiled
    );

    const update: SharedSessionUpdate = {
      schemaVersion: GLOBAL_SESSION_SCHEMA_VERSION,
      sessionId: this.state.sessionId,
      revision: this.state.revision + 1,
      updatedAt: new Date().toISOString(),
      activeFrame: nextState.activeFrame,
      selectionPath: nextState.selectionPath,
      activeSurface: nextState.activeSurface,
      scale: clampUiScale(nextState.scale),
      frameTransforms: nextState.frameTransforms,
      drawers: nextState.drawers,
      draftId: resolvedDraftId,
      compiledId: resolvedCompiledId,
      pipeline: nextState.pipeline,
      draftLock: nextState.draftLock,
      compiled: resolvedCompiledShadow,
      tokens: nextState.tokens,
    };

    this.applyUpdate(update, 'local');
    this.store.write(this.state, 'local', options);
  }

  async triggerPipeline(draftId: string) {
    const now = new Date().toISOString();
    const compiledId = createCompiledId(draftId);
    this.update({
      draftId,
      pipeline: {
        status: 'compiling',
        triggeredAt: now,
        draftId,
        compiledId,
      },
      draftLock: {
        locked: true,
        draftId,
        lockedAt: now,
      },
    });
    await this.store.flushFirestore(this.state);
    await this.firestore?.invokeCompileWorker?.({
      appId: this.appId,
      draftId,
      compiledId,
      triggeredAt: now,
    });
  }

  abortPipeline(reason?: string) {
    const now = new Date().toISOString();
    const error = reason
      ? {
          code: 'PIPELINE_ABORTED',
          message: reason,
        }
      : undefined;
    this.update({
      pipeline: {
        status: 'idle',
        abortedAt: now,
        draftId: this.state.draftId,
        compiledId: this.state.compiledId,
        error,
      },
      draftLock: {
        locked: false,
        draftId: this.state.draftId,
        releasedAt: now,
      },
    });
  }

  async publishPipeline(
    compiled: CompiledArtifact,
    metadata?: { tag: string; notes?: string }
  ) {
    const now = new Date().toISOString();
    const draftId = this.state.draftId;
    const compiledId = compiled.compiledId;
    const pipeline = {
      status: 'success',
      publishedAt: now,
      tag: metadata?.tag,
      notes: metadata?.notes,
      draftId,
      compiledId,
    } as const;
    const draftLock = {
      locked: false,
      draftId,
      releasedAt: now,
    };
    const compiledShadow =
      draftId && compiledId
        ? {
            draftId,
            compiledId,
            publishedAt: now,
          }
        : undefined;

    const useTransaction = Boolean(this.firestore?.runTransaction);
    this.update({
      compiledId,
      compiled: compiledShadow,
      pipeline,
      draftLock,
    }, useTransaction ? { skipFirestore: true } : undefined);

    if (this.firestore?.runTransaction) {
      await this.firestore.runTransaction(async (transaction) => {
        transaction.set(ARTIFACT_PATHS.compiled(this.appId, compiledId), compiled);
        transaction.set(ARTIFACT_PATHS.globalSession(this.appId), this.state);
      });
    }
  }

  recordPipelineError(error: GlobalSessionPipelineError) {
    const now = new Date().toISOString();
    this.update({
      pipeline: {
        status: 'error',
        abortedAt: now,
        draftId: this.state.draftId,
        compiledId: this.state.compiledId,
        error,
      },
      draftLock: {
        locked: false,
        draftId: this.state.draftId,
        releasedAt: now,
      },
    });
  }

  private handleStoreSnapshot = (
    snapshot: SharedSessionSnapshot,
    origin: 'local' | 'remote'
  ) => {
    if (origin === 'local') {
      return;
    }
    if (!isCompatibleGlobalSessionSnapshot(snapshot)) {
      return;
    }
    this.applySnapshot(snapshot, origin);
  };

  private applySnapshot(snapshot: SharedSessionSnapshot, origin: 'local' | 'remote') {
    if (!isCompatibleGlobalSessionSnapshot(snapshot)) {
      return;
    }
    const update: SharedSessionUpdate = {
      schemaVersion: snapshot.schemaVersion,
      sessionId: snapshot.sessionId,
      revision: snapshot.revision,
      updatedAt: snapshot.updatedAt,
      activeFrame: snapshot.activeFrame,
      selectionPath: snapshot.selectionPath,
      activeSurface: snapshot.activeSurface,
      scale: clampUiScale(snapshot.scale),
      frameTransforms: snapshot.frameTransforms,
      drawers: snapshot.drawers,
      draftId: snapshot.draftId,
      compiledId: snapshot.compiledId,
      compiled: snapshot.compiled,
      pipeline: snapshot.pipeline,
      draftLock: snapshot.draftLock,
    };

    if (!shouldApplyUpdate(update, this.state)) {
      this.state = {
        ...this.state,
        presence: prunePresence({
          ...snapshot.presence,
          ...this.state.presence,
        }),
      };
      return;
    }

    const nextPresence = prunePresence({
      ...snapshot.presence,
      ...this.state.presence,
    });

    if (!nextPresence[this.state.sessionId]) {
      nextPresence[this.state.sessionId] = buildPresenceEntry(
        {
          sessionId: this.state.sessionId,
          revision: this.state.revision,
          updatedAt: this.state.updatedAt,
          activeFrame: this.state.activeFrame,
          selectionPath: this.state.selectionPath,
          activeSurface: this.state.activeSurface,
          scale: this.state.scale,
          frameTransforms: this.state.frameTransforms,
          drawers: this.state.drawers,
        },
        true
      );
    }

    const pointerUpdate: DraftPointerUpdate = {
      draftId: update.draftId,
      compiledId: update.compiledId,
      compiled: update.compiled,
    };
    const nextDraftId = resolveDraftId(pointerUpdate, this.state);
    const nextCompiledId = resolveCompiledId(pointerUpdate, this.state);
    const nextCompiledShadow = resolveCompiledShadow(
      pointerUpdate,
      nextDraftId,
      nextCompiledId,
      this.state.compiled
    );

    const nextState: SharedSessionSnapshot = {
      ...this.state,
      revision: snapshot.revision,
      updatedAt: snapshot.updatedAt,
      activeFrame: snapshot.activeFrame,
      selectionPath: snapshot.selectionPath,
      activeSurface: snapshot.activeSurface,
      scale: clampUiScale(snapshot.scale),
      frameTransforms: resolveFrameTransforms(
        snapshot.frameTransforms,
        snapshot.scale,
        snapshot.activeFrame,
        this.state.frameTransforms
      ),
      drawers: snapshot.drawers,
      draftId: nextDraftId,
      compiledId: nextCompiledId,
      compiled: nextCompiledShadow,
      pipeline: snapshot.pipeline,
      draftLock: snapshot.draftLock,
      tokens: snapshot.tokens ?? this.state.tokens,
      presence: nextPresence,
    };

    const changes = buildChangeSet(this.state, nextState);
    this.state = nextState;

    this.dispatchEvent(
      new CustomEvent<SharedSessionEventDetail>(SHARED_SESSION_UPDATE_EVENT, {
        detail: { state: this.state, origin, changes },
      })
    );
  }

  private applyUpdate(update: SharedSessionUpdate, origin: 'local' | 'remote') {
    const currentPresence = {
      ...this.state.presence,
      [update.sessionId]: buildPresenceEntry(update, update.sessionId === this.state.sessionId),
    };

    if (!shouldApplyUpdate(update, this.state)) {
      this.state = {
        ...this.state,
        presence: prunePresence(currentPresence),
      };
      return;
    }

    const nextPresence = prunePresence(currentPresence);
    if (!nextPresence[this.state.sessionId]) {
      nextPresence[this.state.sessionId] = buildPresenceEntry(
        {
          sessionId: this.state.sessionId,
          revision: this.state.revision,
          updatedAt: this.state.updatedAt,
          activeFrame: this.state.activeFrame,
          selectionPath: this.state.selectionPath,
          activeSurface: this.state.activeSurface,
          scale: this.state.scale,
          drawers: this.state.drawers,
        },
        true
      );
    }

    const pointerUpdate: DraftPointerUpdate = {
      draftId: update.draftId,
      compiledId: update.compiledId,
      compiled: update.compiled,
    };
    const nextDraftId = resolveDraftId(pointerUpdate, this.state);
    const nextCompiledId = resolveCompiledId(pointerUpdate, this.state);
    const nextCompiledShadow = resolveCompiledShadow(
      pointerUpdate,
      nextDraftId,
      nextCompiledId,
      this.state.compiled
    );

    const nextState: SharedSessionSnapshot = {
      ...this.state,
      schemaVersion: GLOBAL_SESSION_SCHEMA_VERSION,
      revision: update.revision,
      updatedAt: update.updatedAt,
      activeFrame: update.activeFrame,
      selectionPath: update.selectionPath,
      activeSurface: update.activeSurface,
      scale: clampUiScale(update.scale),
      frameTransforms: resolveFrameTransforms(
        update.frameTransforms,
        update.scale,
        update.activeFrame,
        this.state.frameTransforms
      ),
      drawers: update.drawers,
      draftId: nextDraftId,
      compiledId: nextCompiledId,
      compiled: nextCompiledShadow,
      pipeline: update.pipeline ?? this.state.pipeline,
      draftLock: update.draftLock ?? this.state.draftLock,
      tokens: update.tokens ?? this.state.tokens,
      presence: nextPresence,
    };

    const changes = buildChangeSet(this.state, nextState);
    this.state = nextState;

    this.dispatchEvent(
      new CustomEvent<SharedSessionEventDetail>(SHARED_SESSION_UPDATE_EVENT, {
        detail: { state: this.state, origin, changes },
      })
    );
  }
}

export const createSharedSession = (initial: {
  activeFrame: FrameName;
  selectionPath?: string;
  activeSurface: ActiveSurface;
  scale?: number;
  frameTransforms?: FrameTransformState;
  drawers?: UiDrawersState;
  appId?: string;
  draftId?: string;
  compiledId?: string;
  firestore?: FirestoreAdapter;
  tokens?: GlobalDesignTokens;
}) => new SharedSession(initial);
