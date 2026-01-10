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