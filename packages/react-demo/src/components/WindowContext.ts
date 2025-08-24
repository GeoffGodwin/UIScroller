/**
 * WindowContext
 *
 * React context for UIWindow entry lifecycle coordination.
 *
 * Provides UIWindow's entry lifecycle handlers to child components (OuterEntry), allowing them to:
 *   - Notify UIWindow when an entry is about to expand (mount/animate in)
 *   - Notify UIWindow when an entry has finished expanding (animation end)
 *   - Notify UIWindow when an entry is unmounting (removed)
 *   - Await UIWindow's animation gate to coordinate batch animations
 *
 * Used by:
 *   - UIWindow: Provides the context value (handlers) to its children
 *   - OuterEntry: Consumes the context to coordinate its animation with UIWindow
 *
 * This enables smooth, coordinated entry/exit animations and batch changes.
 *
 * @typedef {Object} WindowCtx
 * @property {(id: number, height: number) => void} onExpandBegin - Called by OuterEntry before expanding
 * @property {(id: number, final?: number) => void} onExpandEnd - Called by OuterEntry after expand animation
 * @property {(id: number, lastHeight?: number) => void} onUnmount - Called by OuterEntry on unmount
 * @property {() => Promise<void>} waitToAnimate - Called by OuterEntry to await UIWindow's animation gate
 */
import React from "react";

export type WindowCtx = {
  onExpandBegin: (id: number, height: number) => void;
  onExpandEnd: (id: number, final?: number) => void;
  onUnmount: (id: number, lastHeight?: number) => void;
  waitToAnimate: () => Promise<void>;  // <-- NEW
};

export const WindowContext = React.createContext<WindowCtx | null>(null);