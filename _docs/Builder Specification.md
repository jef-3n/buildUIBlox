# **nuwaBuilder: The Self-Hosting MVP Specification**

## **1\. Core Mission**

Meet **nuwaBuilder**: your command center for messing around with the nuwaBloc Design State. It’s built for speed and aims to bridge the gap between "looking good" and "working perfectly."

Here's the deal: we're giving you a zero-code **Drag and Drop (DnD)** interface so you can build complex UIs without touching a single line of raw code. But here's the kicker—unlike those old-school WYSIWYG editors that spit out messy HTML soup, this builder cranks out **clean, strict JSON**. The **Nuwa Compiler** eats that JSON for breakfast and turns it into a super-optimized runtime artifact. No code rot, no mess\!

## **2\. Builder Architecture (The Host)**

We've organized the Builder around a "4-Axis Drawer" system. Think of it as keeping your desk tidy—the main workspace is clean, but your tools are just a slide away.

* **Center Canvas (The Visual Stage):** This is where the magic happens. It's your main viewport for the nuwaBloc. It’s got this neat **Variable Density Engine** that lets you scale the view from ![][image1] (real size) all the way to ![][image2] (tiny\!).  
  * *Why?* At ![][image1], you check the pixels. At ![][image2], it turns into a "Logic Map," so you can see how events flow across a bunch of components at once. It’s a lifesaver for debugging complex event chains without losing track of where things are.  
  * **Scale Levels (1–5):** The Canvas always snaps to five discrete zoom levels so behavior is predictable and repeatable.  
    * **1 (Detail):** 1:1 pixel inspection, full fidelity.  
    * **2 (Comfort):** Slightly zoomed out for layout tweaks.  
    * **3 (Structure):** Balanced overview for multi-section editing.  
    * **4 (Logic):** Emphasizes flow and grouping over pixel precision.  
    * **5 (Map):** Maximum zoom-out for whole-app topology.  
  * **Transform Rules:** Scaling is a pure view transform on the canvas stage. We scale around a fixed origin (see grid-origin invariants), and translate in screen space after scaling to keep the active focus stable. No schema coordinates are modified by zooming.  
  * **Grid-Origin Invariants:**  
    * The grid origin is anchored at the top-left of the design space and never drifts.  
    * Scale changes must not introduce fractional drift in the origin; origin stays at integer grid coordinates.  
    * Panning is additive and reversible, but the origin itself is immutable.  
  * **Stability Across Scaling & Frame Switching:**  
    * Switching scale levels does not mutate frame data.  
    * Switching frames (Desktop/Mobile/etc.) preserves the current zoom level and pan offset.  
    * Returning to a frame restores the exact pre-existing coordinates for that frame, independent of the current zoom.  
* **Left Drawer (Library & Composition):** **The Warehouse.**  
  * *What it does:* It’s where all your stuff lives. You can manage nested components and drag-and-drop primitive blocks (like Buttons or Cards) or grab full patterns (like Repeaters) right onto the grid.  
  * *Templates:* Got a layout you love? Save it as a template and drop complex structures in instantly\!  
* **Right Drawer (The Inspector):** **The Control Center.**  
  * *What it does:* Click an element, and this drawer lights up. It talks directly to the styler JSON object. Instead of wrestling with CSS, you just tweak some sliders and inputs.  
  * *Data Binding:* Hooking up data is a breeze. You just link visual properties (like a background color) to specific spots in the nuwa-context using simple text strings.  
* **Bottom Drawer (Intelligence & Diagnostics):** **The Brain & The Sniffer.**  
  * *AI Sandbox:* Chat with our "Creative Web Designer" AI. Just tell it, "Make a dark-mode version of this card," and watch it update the schema for you.  
  * *Event Sniffer:* Ideally, you want to know what's happening under the hood. This log monitor shows you the real-time \[type, payload\] traffic so you can verify that your "Ghost Layer" triggers are actually firing.  
* **Top Drawer (Global Configuration):** **System Settings.**  
  * *What it does:* This is where you set the rules for the whole environment—palettes, typography, server-side injection rules, and the big "Publish" button that kicks off the compilation.

## **3\. Key Modules**

### **3.1 The Ghost Layer Editor (The Interaction Designer)**

This tool lets you design the "Invisible Interface" that sits on top of your pixels.

* **Canvas Overlay:** Flip this on, and you'll see semi-transparent boxes over your elements. It shows you exactly where the interaction zones are, ignoring the messy DOM structure underneath.  
* **Trigger Mapping (Zero-Code Eventing):** Draw a box over anything—even across multiple grid cells—and tell it to fire a specific event. This separates the look from the logic. You can totally redesign a button, and the click handler won't break because it lives in the Ghost Layer\!  
* **Path Picker:** No more typos\! Drill down into the live nuwa-context, click the data you want, and boom—it injects the exact path (like data.items\[i\].id) right into your config.

### **3.2 The Styler Bridge (JSON to CSS)**

This is the translator that turns your ideas into the minified CSS the compiler needs.

* **Visual Controls:** Color pickers, spacing dials, toggles—tweak the styler JSON in real-time and see the changes happen instantly on the Center Canvas.  
* **Frame Manager (Responsive Orchestration):** A powerful way to switch contexts.  
  * *How it works:* Move an element while in "Mobile" mode, and it *only* updates the mobile coordinates in the JSON. Your Desktop layout stays exactly where you left it. Precise control, zero headaches.  
* **Catch-All Manager:** Define rules for the weird states. Want an element to vanish if data is missing? Set a rule like "If data.isEmpty, set opacity: 0.00001." It keeps your layout stable even when things hide.

### **3.3 The Sync & Compile Engine**

This keeps everything up-to-date and playing nice together.

* **Real-Time Design Sync:** Every change you make saves instantly to Firestore. We call this the "Hot State."  
* **Auto-Compiler Trigger:** The server watches for your changes. To keep things smooth, it waits a split second (debounce) and then runs the compiler to generate the optimized code in the background.  
* **Surface Messenger:** Once the new code is ready, the system shouts out to every open window you have. So, if you tweak something on your "Control Monitor," your "Preview Monitor" updates instantly.

## **4\. The "Builder-Building" Workflow (The Bootstrap)**

Here's the roadmap for how this tool eventually builds itself:

1. **Manual Host Setup:** First, we hard-code the basic Grid/Drawer stuff using standard Lit and **plain CSS**. We need a skeleton to get started\!  
2. **View Factory Integration:** We plug in the core engine that knows how to read nuwaBloc JSON and render it. Now the Host can show content, even if its own UI is still hard-coded.  
3. **Bootstrap Blocs:** You use the manual Host to build the first real nuwaBlocs—things like Toolbar Buttons and Input Fields.  
4. **Closure (The Switch):** Ideally, this is the finish line. We swap out the hard-coded drawers for the nuwaBloc versions you just made. Now, the Builder is made of the very blocks it creates\! Meta, right?

## **5\. Metadata & Versioning**

* **Branching Strategy:** We keep "Drafts" and "Production" separate.  
  * *Draft:* The messy stream of changes happening while you work.  
  * *Publish:* When you're happy, you snapshot the current state into a permanent release.  
* **Rollback & Atomicity:** Because the compiled version is just a shadow of the design, reverting is easy. Messed up? Just point the session back to the last good snapshot, and everything—looks and logic—restores instantly.

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAUCAYAAACJfM0wAAABPUlEQVR4XmNgGLZAQUGBQ1FRURyGZWRkhIDCjKKiojzI4iB1KBqVlZXF5OXlS+Tk5NJQJKBASUlJDSifBcQPgPgoEHsDhVmABjkA2WeA+nYAcQwQC4I1gGyAaqgF4gNAnINqJApgAcpPBeL9IIeABEAWAA3LMzY2ZkVXDAYgLwEVrSZgMMggJyB+DsSBQGwExNU4DQUBYg1WUVHhA/pyE9CVJ0G+FBcX50ZXgwKINRgEgGqSgPgJ0AILdDkMQKzBIBcD1UwFuvgRkC5Bl8cAxBgMDYYOoBpFkOHySJGIExAyGBRBQLlqIDYC8eWRIhFdLQrAZzAoSQK9Xg+kzWFisEgEql+CkSlgACgZDZRcCXXBNaAh04E5SxeUk4D8OUC5W0D6A5BuACpnhqb9Gmg4fwDiraCMgmbsKBgF9AIADl1SbnfyKuEAAAAASUVORK5CYII=>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAUCAYAAACJfM0wAAABkElEQVR4Xu2TP0sDQRTELySCoIh/OA/Jkcslh42NmELBJthaWSsWKS2sFIso2ikBRQs7EQsbsRMEC8HKQvATCIKIYJuP4G/M3XpZo52NZGDY3ffmze7tvnOcf4tisdgbhqGX0Pf9YcIZ13X703HpTFGhUNgNguAUNuA+yQsKoy9bxymVSuPkVuALvIfzhHNoq8wf8biBS3DIFJE4UAHBV3hmm6aQQ3cM78rl8qgC2oCa1Uql0mOLdeINfYYd7wSM5uA7XIBTsN7RVJBxPp/3dYrk7mxNgiiKBvj8K2oeMN3yPK/P1hggaCA+gpPM13U1vxWQr8E39DN2rg3sPpEYcfIRim7hoq0TdGLds96Dcc3Op5Fh50HGrBZqHwou9QXtMnMNe+RDmQepR/yG+AGeOcGy1j8Z64GI16WP68wjpnUG6k9MDjmNqzXCsaDVp6ZATc/G24zTSSx5RHTnbT9FChmSNXWGzILWj/LZQmpB5icUPjE2GXfQZ2XEejO+5ya8Jla1fFvQXSGcjdutiy7+AB9HDl7dkZkBjAAAAABJRU5ErkJggg==>
