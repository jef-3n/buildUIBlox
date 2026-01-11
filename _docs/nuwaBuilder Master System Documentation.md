# **nuwaBuilder: Master System Documentation**

This document serves as the complete technical authority for the nuwaBuilder ecosystem. It combines high-level architecture, design standards, interaction protocols, and implementation logic into a single, cohesive manual.

## **1\. nuwaBloc Component Specification**

### **1.1 Definition**

A **nuwaBloc** is a high-velocity declarative component unit designed for seamless "Design-to-Production" cycles. It utilizes a **One-Way Compilation Pipeline** that consumes high-abstraction "Design States"—represented as semantic JSON schemas—and transforms them into optimized, minified, and deployment-ready runtime artifacts.

### **1.2 Core Structure**

* **Visual & Layout Layer:** Strictly governed by a multi-state CSS Grid orchestration system. Elements are assigned to "Frames" (Desktop, Tablet, Mobile), and the compiler generates grid-template-areas.  
* **The Styler (JSON-CSS Bridge):** Styling is defined via declarative JSON objects. Static analysis generates atomic, shared CSS classes to prevent "CSS bloat."  
* **Repeaters (Client-Side Iteration):** Ships a "Template Definition" and raw JSON to the browser; the View Factory handles expansion, ensuring rapid Time to Interactive (TTI).  
* **The Ghost Layer (Interaction Orchestration):** A transparent SVG/Absolute layer sitting on top of the Render Layer. It maps physical coordinates to logical events, keeping the visual DOM clean.  
* **Hybrid Evaluation Engine:** Static logic is pre-evaluated on the server; reactive data updates are handled by the View Factory's diffing engine.

### **1.3 Implementation Use Cases**

* **Real-Time Financial Dashboards:** High-frequency data environments requiring interaction stability at 60fps.  
* **Collaborative Whiteboarding:** Infinite canvases where nodes and structures are manipulated simultaneously across users.  
* **Dynamic E-Commerce:** Fetching one card definition and localizing thousands of instances on the client side.  
* **Self-Hosting IDEs:** Editors that use the nuwaBloc system to build and evolve their own interface.

## **2\. Builder Architecture (The Host)**

### **2.1 Core Mission**

The **nuwaBuilder** is a visual IDE for manipulating the nuwaBloc Design State. It provides a zero-code Drag and Drop interface that outputs a strict, validated JSON schema rather than raw code.

### **2.2 The 4-Axis Drawer System**

* **Center Canvas:** The primary viewport featuring a **Variable Density Engine** (1X to 5X scaling). 1X is for visual checks; 5X is for "Logic Mapping" of events.  
* **Left Drawer (The Warehouse):** Manages the project library, component hierarchy, and drag-and-drop primitives.  
* **Right Drawer (The Control Center):** The Inspector/Styler. It manipulates the JSON styler object and facilitates data binding.  
* **Bottom Drawer (The Brain & Sniffer):** Contains the AI Sandbox for natural language editing and the Event Sniffer for real-time \[type, payload\] monitoring.  
* **Top Drawer (System Settings):** Manages global design tokens (palettes, typography) and the "Publish" trigger.

## **3\. Design Guidance Documents**

### **3.1 Guidance: Mission & Pipeline**

* **Purpose:** Governs the "One-Way Compilation Pipeline" from Draft to Snapshot.  
* **Data Consumption:** Subscribes to globalSession for buildStatus.  
* **Key Event:** PIPELINE\_TRIGGER\_BUILD \- Sets status to compiling and locks the UI.  
* **Rule:** Immutability. Once a build starts, the source JSON is locked until the artifact is generated.

### **3.2 Guidance: Host & Drawer System**

* **Purpose:** Manages the spatial layout and scaling.  
* **Data Consumption:** Subscribes to session.ui.drawers and session.ui.scale.  
* **Key Event:** UI\_TOGGLE\_DRAWER \- Updates Firestore to sync layout across all user devices.  
* **Rule:** Pure CSS. Use standard CSS Grid for the Host skeleton (No Tailwind).

### **3.3 Guidance: Ghost Layer & Interaction**

* **Purpose:** Maps visual pixels to logical protocols.  
* **Data Consumption:** Subscribes to compiledBloc.ghostMap.  
* **Key Event:** GHOST\_SELECT\_ELEMENT \- Coordinates "Active Item" focus for the Styler.  
* **Rule:** Z-Index Authority. The Ghost Layer must always sit at the top (z-index: 9999).

### **3.4 Guidance: Styler & Frame Manager**

* **Purpose:** The bridge between UI controls and the styler JSON.  
* **Data Consumption:** Subscribes to activeSelection.styler and ui.activeFrame.  
* **Key Event:** STYLER\_UPDATE\_PROP \- Performs surgical deep-merge updates to the JSON schema.  
* **Rule:** Frame Isolation. Mobile changes must be isolated from Desktop configurations.

### **3.5 Guidance: Bootstrap & Evolution**

* **Purpose:** Defines the self-hosting plan where the hard-coded Host UI is replaced by nuwaBlocs.  
* **Data Consumption:** Subscribes to the System Component Library.  
* **Key Event:** BOOTSTRAP\_LOAD\_CORE \- Hot-swaps manual UI slots with compiled components.  
* **Rule:** Fallback Logic. Always maintain a hard-coded UI backup in case a bloc fails to load.

## **4\. MVP Handler Definitions (The Functional Brain)**

### **4.1 Pipeline Handlers**

* **PIPELINE\_TRIGGER\_BUILD**  
  * **Logic:** Sets status to compiling, records a timestamp, and alerts the Build Worker.  
* **PIPELINE\_ABORT\_BUILD**  
  * **Logic:** Resets status to idle and sends an interrupt signal to the build container.

### **4.2 Interface Handlers**

* **UI\_TOGGLE\_DRAWER**  
  * **Logic:** Toggles boolean states in Firestore to slide drawers in/out across all synchronized instances.  
* **UI\_SET\_SCALE**  
  * **Logic:** Updates session.ui.scale, triggering a CSS transform on the canvas and re-calibrating Ghost hitboxes.

### **4.3 Interaction Handlers**

* **GHOST\_SELECT\_ELEMENT**  
  * **Logic:** Updates activeSelection path; the Right Drawer reacts by fetching that object's properties.  
* **GHOST\_HOTSPOT\_TRIGGER**  
  * **Logic:** Proxy handler. Translates a click on a Ghost rectangle into a system-level event (e.g., NAV\_TO).

### **4.4 Styler Handlers**

* **STYLER\_UPDATE\_PROP**  
  * **Logic:** Navigates the JSON tree to the target element and performs a deep-merge update of the style property.

### **4.5 Bootstrap Handlers**

* **BOOTSTRAP\_LOAD\_CORE**  
  * **Logic:** Locates a named \<slot\> in the Host, clears it, and renders a nuwaBloc via the View Factory.

## **5\. Operations & Versioning**

* **Branching:** "Draft" is the live stream; "Publish" is a snapshot of both Design \+ Compiled artifacts.  
* **Rollback:** Point the session ID back to the last good snapshot document.  
* **Storage:** All data is housed in /artifacts/{appId}/public/data/.  

### **5.1 Persistence Paths & Access Rules**

**globalSession**

* **Path:** `/artifacts/{appId}/public/data/globalSession`  
* **Read:** All surfaces (editor shell, compiler monitors, ghost layer) subscribe for buildStatus, activeSelection, UI state, and draft/compiled pointers.  
* **Write:** Only the event processor (UI/API) and compiler worker may update this document. Writes MUST be transactional with the draft lock rules in §6.8.  

**Drafts (Design State)**

* **Path:** `/artifacts/{appId}/public/data/drafts/{draftId}`  
* **Read:** Editor, compiler, and preview runtime.  
* **Write:** Only via validated event envelopes; UI surfaces never write compiled output.  

**Compiled Artifacts**

* **Path:** `/artifacts/{appId}/public/data/compiled/{compiledId}`  
* **Read:** Preview runtime, ghost layer, and publish pipelines.  
* **Write:** Compiler workers only.  

### **5.2 Offline/Error Behavior & Consistency Requirements**

**Offline Behavior**

* When offline, surfaces MUST render from the latest cached Draft and globalSession snapshot.  
* Offline mutations are queued as event envelopes and replayed in-order on reconnect; direct document writes are forbidden.  
* If a reconnect detects a schema mismatch or rejected event, the client must halt replay and request a fresh Draft + globalSession sync.  

**Error Behavior**

* Compiler failures MUST set `globalSession.buildStatus=error` and persist an error payload in the session (e.g., `buildError` with code/message).  
* A failed build MUST NOT overwrite existing compiled artifacts; the last known good compiled output remains the active read target.  
* Clearing error state requires an explicit event (e.g., `PIPELINE_ABORT_BUILD` or new `PIPELINE_TRIGGER_BUILD`).  

**Consistency Requirements**

* All writes to `globalSession` and Drafts MUST use optimistic concurrency (`updatedAt` and/or Firestore preconditions).  
* `globalSession.draftId` and `compiled.draftId` must remain aligned (§6.6); any mismatch blocks publish.  
* The Draft, globalSession, and compiled artifact references are updated atomically by the pipeline (transaction or batched write).  

## **6\. Rulebook & Enforcement (Authoritative)**

This section is the single source of truth for schema authority, validation, and enforcement. Any subsystem that ingests or emits a nuwaBuilder payload MUST comply with this Rulebook.

### **6.1 Rulebook Principles**

* **Canonical Schemas Only:** All documents and events MUST conform to the canonical schemas below.  
* **Immutable Compiled Outputs:** Compiled Artifacts are read-only by all authoring surfaces.  
* **Single-Writer Rule:** Draft mutation is only permitted via declared event envelopes.  
* **Versioned Authority:** Every schema and payload is versioned and validated at ingress.  
* **Blocker-First Enforcement:** Violations that can corrupt state or create irreversible mismatches are blocked immediately.

### **6.2 Canonical Schemas**

> **Notation:** The shapes below are structural contracts. Field types are strict; `?` indicates optional.

**Draft (Design State)**

```json
{
  "schemaVersion": "draft.v1",
  "draftId": "string",
  "appId": "string",
  "ownerId": "string",
  "updatedAt": "iso-8601",
  "rootNodeId": "string",
  "nodes": {
    "nodeId": {
      "type": "string",
      "props": { "key": "value" },
      "children": ["nodeId"],
      "styler": { "token": "value" },
      "dataBindings": { "path": "string" }
    }
  },
  "assets": {
    "assetId": { "type": "image|video|font", "url": "string" }
  },
  "frames": {
    "desktop": { "grid": "object", "order": ["nodeId"] },
    "tablet?": { "grid": "object", "order": ["nodeId"] },
    "mobile": { "grid": "object", "order": ["nodeId"] }
  },
  "meta": { "name": "string", "tags": ["string"] }
}
```

**Compiled Artifact**

```json
{
  "schemaVersion": "compiled.v1",
  "compiledId": "string",
  "draftId": "string",
  "appId": "string",
  "compiledAt": "iso-8601",
  "css": "string",
  "runtime": {
    "nodes": { "nodeId": { "type": "string", "props": { "key": "value" } } },
    "layout": { "frames": { "desktop": "object", "mobile": "object" } }
  },
  "ghostMap": {
    "nodeId": { "bounds": [0, 0, 0, 0], "handlers": ["eventId"] }
  },
  "integrity": { "sourceHash": "string", "compilerVersion": "string" }
}
```

**globalSession**

```json
{
  "schemaVersion": "session.v1",
  "sessionId": "string",
  "appId": "string",
  "userId": "string",
  "draftId": "string",
  "compiledId": "string",
  "compiled": {
    "compiledId": "string",
    "draftId": "string",
    "publishedAt": "iso-8601?"
  },
  "pipeline": {
    "status": "idle|compiling|error|success",
    "triggeredAt": "iso-8601?",
    "abortedAt": "iso-8601?",
    "publishedAt": "iso-8601?",
    "draftId": "string?",
    "compiledId": "string?",
    "error": { "code": "string", "message": "string" }
  },
  "draftLock": {
    "locked": "boolean",
    "draftId": "string",
    "lockedAt": "iso-8601",
    "releasedAt": "iso-8601?"
  },
  "ui": { "$ref": "uiState.v1" },
  "activeSelection": { "$ref": "activeSelection.v1" },
  "eventCursor": "number",
  "updatedAt": "iso-8601"
}
```

**ui state**

```json
{
  "schemaVersion": "uiState.v1",
  "drawers": {
    "left": "open|closed",
    "right": "open|closed",
    "bottom": "open|closed"
  },
  "scale": "number",
  "activeFrame": "desktop|tablet|mobile",
  "snifferEnabled": "boolean"
}
```

**activeSelection**

```json
{
  "schemaVersion": "activeSelection.v1",
  "nodeId": "string",
  "path": ["string"],
  "stylerPath": ["string"],
  "source": "ghost|tree|search",
  "updatedAt": "iso-8601"
}
```

**ghostMap**

```json
{
  "schemaVersion": "ghostMap.v1",
  "nodeId": {
    "bounds": [0, 0, 0, 0],
    "frame": "desktop|tablet|mobile",
    "handlers": [
      { "eventId": "string", "type": "click|hover|drag|drop" }
    ]
  }
}
```

**event envelope**

```json
{
  "schemaVersion": "event.v1",
  "eventId": "string",
  "sessionId": "string",
  "cursor": "number",
  "type": "PIPELINE_TRIGGER_BUILD|UI_TOGGLE_DRAWER|STYLER_UPDATE_PROP|GHOST_SELECT_ELEMENT|BOOTSTRAP_LOAD_CORE",
  "actor": { "userId": "string", "role": "human|ai|system" },
  "origin": { "surfaceId": "string", "source": "ghost|ui|api|worker" },
  "payload": { "key": "value" },
  "telemetry": {
    "traceId": "string",
    "spanId": "string",
    "correlationId": "string",
    "receivedAt": "iso-8601"
  },
  "timestamp": "iso-8601",
  "requiresDraftLock": "boolean"
}
```

**event naming & payload rules**

* **Type Naming:** `type` is `DOMAIN_ACTION` (UPPER_SNAKE_CASE). Domains are stable (`UI_`, `GHOST_`, `STYLER_`, `PIPELINE_`, `BOOTSTRAP_`), actions are verbs.  
* **Event IDs:** `eventId` is globally unique (UUID or ULID) and immutable; `cursor` is strictly increasing per `sessionId`.  
* **Payload Schema:** `payload` MUST validate against the schema registered for the event `type` (`payloadSchemas[type]`). No `any` payloads in production paths.  
* **Actor/Origin:** `actor` identifies who initiated the event; `origin` identifies where the event entered the system. Both are required.  
* **Timestamping:** `timestamp` is the client-generated time; `telemetry.receivedAt` is the server ingress time.

**root listener & handler registry**

* **Root Listener:** A single root listener ingests all raw events, normalizes them into the event envelope, validates schema, and appends `cursor` before dispatch.  
* **Handler Registry:** Registry is a map of `type -> handler[]` with deterministic order. Handlers declare `requiresDraftLock`, `mutatesDraft`, and `telemetryTags`.  
* **Dispatch Rules:** Unknown `type` is rejected with `errorCode=EVENT_UNREGISTERED` and no mutation.  
* **Isolation:** Handlers run in order; failures do not short-circuit subsequent handlers unless explicitly marked `blocking=true`.

**telemetry & error handling**

* **Telemetry Fields:** `traceId`/`spanId` (distributed tracing), `correlationId` (client session thread), plus handler-level tags.  
* **Validation Failures:** Reject event, emit `EVENT_VALIDATION_FAILED`, increment error metrics, and do not mutate state.  
* **Handler Errors:** Capture `errorId`, `errorCode`, and sanitized `message` in logs; emit `EVENT_HANDLER_FAILED` with the same `eventId`.  
* **Retries:** Only idempotent events may retry; non-idempotent events must hard fail with guidance in logs.  
* **Backpressure:** If event throughput exceeds limits, respond with `EVENT_THROTTLED` and enqueue for retry when allowed.

### **6.3 Reducer Contracts & Dispatch Flow**

**Immutable reducer signatures**

```ts
type Reducer<State, Event> = (
  state: Readonly<State>,
  event: Readonly<Event>
) => State;

type DomainReducers = {
  data: Reducer<DraftState, EventEnvelope>;
  ui: Reducer<UiState, EventEnvelope>;
  selection: Reducer<ActiveSelectionState, EventEnvelope>;
  compiled: Reducer<CompiledState, EventEnvelope>;
};
```

* **Immutability:** Reducers MUST return new state objects and never mutate inputs.  
* **Domain scope:** Each reducer only touches its own context slice; cross-domain updates happen via dispatching additional events.  
* **Compiled guardrail:** The `compiled` reducer is read-only at authoring time; it only responds to compiler output events (e.g., `PIPELINE_BUILD_COMPLETE`).

**Event dispatch flow**

1. **Ingress:** Raw input (UI, Ghost, API, Worker) enters the Root Listener.  
2. **Normalize:** Wrap in `event.v1` envelope and append `cursor`.  
3. **Validate:** Enforce `payloadSchemas[type]`; reject on failure.  
4. **Lock check:** If `requiresDraftLock=true` and `buildStatus=compiling`, reject.  
5. **Dispatch:** Route to domain reducers in deterministic order: `data → ui → selection → compiled`.  
6. **Derive:** Recompute derived selectors (layout caches, ghost hitbox projections, UI flags).  
7. **Persist:** Commit stored slices to Firestore (Draft/UI/Selection) and write compiled outputs only from compiler workers.  
8. **Broadcast:** Emit state-change notifications and telemetry events to all connected surfaces.

### **6.4 Context Distribution Layers**

**Data Context (Design State)**

* **Source:** Draft (`draft.v1`) document.  
* **Purpose:** Canonical content model: nodes, frames, styler, bindings, assets.  
* **Consumers:** Compiler, View Factory, Tree UI, Inspector.  

**UI Context**

* **Source:** `uiState.v1` in `globalSession`.  
* **Purpose:** Host layout, scaling, drawer visibility, active frame.  
* **Consumers:** Host shell, drawers, canvas scaling, ghost recalibration.  

**Selection Context**

* **Source:** `activeSelection.v1` in `globalSession`.  
* **Purpose:** User focus: nodeId, path, stylerPath, source.  
* **Consumers:** Styler/Inspector, breadcrumb UI, multi-surface highlighting.  

**Compiled Context**

* **Source:** `compiled.v1` artifact + `ghostMap.v1`.  
* **Purpose:** Read-only runtime surface for preview and production.  
* **Consumers:** Renderer, Ghost Layer, published runtime.  

### **6.5 Derived vs Stored State Rules**

**Stored state (authoritative, persisted)**

* Draft (Design State), UI state, Selection state, and Compiled artifacts.  
* Only mutated via validated events or compiler workers.  
* Must be schema versioned and durable across sessions.

**Derived state (computed, ephemeral)**

* Ghost hitbox projections, layout caches, visibility flags, selection outlines, and memoized selectors.  
* Must be recomputable from stored state at any time.  
* Never persisted to Firestore; never written as a source of truth.

**Rules**

* Do not dispatch events that directly mutate derived state.  
* If a derived value needs persistence, promote it to stored state with a schema and migration plan.  
* Derived state must be invalidated and recomputed after every stored-state mutation.

### **6.6 Schema Versioning & Validation Strategy**

* **Versioned Keys:** `schemaVersion` is mandatory for every payload and uses `name.vN` (e.g., `draft.v1`).  
* **Forward-Only Migration:** Consumers MUST reject unknown major versions; minor patches must be additive.  
* **Ingress Validation:** Every write path (UI, API, compiler, worker) validates against schema before mutation.  
* **Compile Gate:** Compiler validates the Draft and refuses output on violations; the build status is set to `error`.  
* **Session Integrity:** `compiled.draftId` MUST match `globalSession.draftId` at publish time.  
* **Hash Integrity:** Compiled Artifacts include `integrity.sourceHash` of the Draft to detect drift.

### **6.7 Blocker Criteria (Hard Failures)**

Any of the following MUST block writes, builds, or publish operations:

1. **Schema Mismatch:** Missing/incorrect `schemaVersion` or type violations.  
2. **Draft/Compiled Mismatch:** `compiled.draftId` does not equal the Draft being published.  
3. **Immutable Breach:** Attempt to mutate `compiled.v1` or `ghostMap.v1` directly from the editor.  
4. **Invalid Selection:** `activeSelection.nodeId` missing in Draft `nodes`.  
5. **Ghost Map Drift:** `ghostMap` references node IDs that are absent in the Compiled runtime.  
6. **Locked Draft Mutation:** `requiresDraftLock=true` event is processed while `buildStatus=compiling`.  
7. **Unauthorized Actor:** `event.actor.role` not in `human|ai|system` or missing `userId`.

### **6.8 Draft Lock Enforcement (Persisted State)**

* **Persisted Lock:** `globalSession.draftLock` is the single source of truth for pipeline draft locking.  
* **Lock Acquisition:** `PIPELINE_TRIGGER_BUILD` MUST set `draftLock.locked=true` and `draftLock.draftId=globalSession.draftId` in the same write that flips `buildStatus=compiling`.  
* **Lock Enforcement:** While locked, any event that would mutate Draft state or update `globalSession.draftId` MUST be rejected.  
* **Lock Release:** The lock is released only when the pipeline transitions to `buildStatus=idle|error|success` via compiler completion or explicit abort.  
* **Auditability:** `lockedAt`/`releasedAt` timestamps are mandatory for lock state transitions.
