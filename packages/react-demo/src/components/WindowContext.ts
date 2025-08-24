import React from "react";

export type WindowCtx = {
  onExpandBegin: (id: number, height: number) => void;
  onExpandEnd: (id: number, final?: number) => void;
  onUnmount: (id: number, lastHeight?: number) => void;
  waitToAnimate: () => Promise<void>;  // <-- NEW
};

export const WindowContext = React.createContext<WindowCtx | null>(null);