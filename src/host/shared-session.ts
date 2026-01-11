import type { FrameName } from './frame-types';
import {
  GLOBAL_SESSION_SCHEMA_VERSION,
  type GlobalPresenceState,
  type GlobalSessionCompiledShadow,
  type GlobalSessionPipelineState,
  type GlobalSessionSnapshot,
  type GlobalSessionUpdate,
  isCompatibleGlobalSessionSnapshot,
} from '../contracts/global-session';
import {
  DEFAULT_UI_SCALE,
  createUiDrawersState,
  type ActiveSurface,
  type UiDrawersState,
} from '../contracts/ui-state';
import { GlobalSessionStore } from './global-session-store';

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

export class SharedSession extends EventTarget {
  private store: GlobalSessionStore;
  private unsubscribe?: () => void;
  state: SharedSessionSnapshot;

  constructor(initial: {
    activeFrame: FrameName;
    selectionPath?: string;
    activeSurface: ActiveSurface;
    scale?: number;
    drawers?: UiDrawersState;
    appId?: string;
    draftId?: string;
    compiledId?: string;
  }) {
    super();
    const sessionId = createSessionId();
    const updatedAt = new Date().toISOString();
    const draftId = initial.draftId;
    const compiledId = initial.compiledId;
    const scale = initial.scale ?? DEFAULT_UI_SCALE;
    const drawers = initial.drawers ?? createUiDrawersState();
    this.state = {
      schemaVersion: GLOBAL_SESSION_SCHEMA_VERSION,
      sessionId,
      revision: 0,
      updatedAt,
      activeFrame: initial.activeFrame,
      selectionPath: initial.selectionPath,
      activeSurface: initial.activeSurface,
      scale,
      drawers,
      draftId,
      compiledId,
      pipeline: {
        status: 'idle',
        draftId,
        compiledId,
      },
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
            drawers,
          },
          true
        ),
      },
    };
    this.store = new GlobalSessionStore(initial.appId ?? 'demo-app', this.state);
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
        | 'drawers'
        | 'draftId'
        | 'compiledId'
        | 'pipeline'
        | 'draftLock'
        | 'compiled'
      >
    >
  ) {
    const nextState = {
      activeFrame: partial.activeFrame ?? this.state.activeFrame,
      selectionPath:
        'selectionPath' in partial ? partial.selectionPath : this.state.selectionPath,
      activeSurface: partial.activeSurface ?? this.state.activeSurface,
      scale: partial.scale ?? this.state.scale,
      drawers: partial.drawers ?? this.state.drawers,
      draftId: partial.draftId ?? this.state.draftId,
      compiledId: partial.compiledId ?? this.state.compiledId,
      pipeline: partial.pipeline ?? this.state.pipeline,
      draftLock: partial.draftLock ?? this.state.draftLock,
      compiled: partial.compiled ?? this.state.compiled,
    };

    const hasChanges =
      nextState.activeFrame !== this.state.activeFrame ||
      nextState.selectionPath !== this.state.selectionPath ||
      nextState.activeSurface !== this.state.activeSurface ||
      nextState.scale !== this.state.scale ||
      nextState.drawers !== this.state.drawers ||
      nextState.draftId !== this.state.draftId ||
      nextState.compiledId !== this.state.compiledId ||
      nextState.pipeline !== this.state.pipeline ||
      nextState.draftLock !== this.state.draftLock ||
      nextState.compiled !== this.state.compiled;

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
      scale: nextState.scale,
      drawers: nextState.drawers,
      draftId: resolvedDraftId,
      compiledId: resolvedCompiledId,
      pipeline: nextState.pipeline,
      draftLock: nextState.draftLock,
      compiled: resolvedCompiledShadow,
    };

    this.applyUpdate(update, 'local');
    this.store.write(this.state, 'local');
  }

  triggerPipeline(draftId: string) {
    const now = new Date().toISOString();
    this.update({
      draftId,
      pipeline: {
        status: 'compiling',
        triggeredAt: now,
        draftId,
        compiledId: this.state.compiledId,
      },
      draftLock: {
        locked: true,
        draftId,
        lockedAt: now,
      },
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

  publishPipeline(compiledId: string) {
    const now = new Date().toISOString();
    const draftId = this.state.draftId;
    this.update({
      compiledId,
      compiled:
        draftId && compiledId
          ? {
              draftId,
              compiledId,
              publishedAt: now,
            }
          : undefined,
      pipeline: {
        status: 'success',
        publishedAt: now,
        draftId,
        compiledId,
      },
      draftLock: {
        locked: false,
        draftId,
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
      scale: snapshot.scale,
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
      scale: snapshot.scale,
      drawers: snapshot.drawers,
      draftId: nextDraftId,
      compiledId: nextCompiledId,
      compiled: nextCompiledShadow,
      pipeline: snapshot.pipeline,
      draftLock: snapshot.draftLock,
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
      scale: update.scale,
      drawers: update.drawers,
      draftId: nextDraftId,
      compiledId: nextCompiledId,
      compiled: nextCompiledShadow,
      pipeline: update.pipeline ?? this.state.pipeline,
      draftLock: update.draftLock ?? this.state.draftLock,
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
  drawers?: UiDrawersState;
  appId?: string;
  draftId?: string;
  compiledId?: string;
}) => new SharedSession(initial);
