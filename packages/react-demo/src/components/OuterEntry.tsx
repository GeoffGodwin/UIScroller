/**
 * OuterEntry
 *
 * Handles entry/exit animation for a single item in UIWindow.
 * Measures its content height and animates expansion/collapse.
 * Notifies UIWindow of its lifecycle for smooth batch animations.
 *
 * @component
 * @prop {number} id - Unique identifier for this entry (used for animation coordination).
 * @prop {React.ReactNode} children - The content to render inside the entry (usually an InnerEntry).
 * @example
 *   <OuterEntry id={1}><InnerEntry text="Hello" /></OuterEntry>
 */
import React from 'react';
import { WindowContext } from "./WindowContext";

class OuterEntry extends React.Component<{
  id: number;
  children: React.ReactNode;
}> {
  static contextType = WindowContext;
  declare context: React.ContextType<typeof WindowContext>;

  // Ref to the outer animated div
  private outerRef = React.createRef<HTMLDivElement>();
  // Ref to the inner measured content
  private measureRef = React.createRef<HTMLDivElement>();
  private lastHeight = 0;
  private onEnd?: (e: TransitionEvent) => void;
  private resizeObserver?: ResizeObserver;

  componentDidMount() {
    const outer = this.outerRef.current!;
    const box = this.measureRef.current!;
    if (!outer || !box) return;

    // Set up initial collapsed state and transition
    outer.style.overflow = 'hidden';
    outer.style.display = 'block';
    outer.style.boxSizing = 'border-box';
    outer.style.height = '0px';
    outer.style.transition = 'height 250ms ease';

    // Measure content height
    const target = Math.round(box.getBoundingClientRect().height);
    this.lastHeight = target;

    // Synchronously inform UIWindow (closes the gate)
    this.context?.onExpandBegin(this.props.id, target);

    // Wait for UIWindow to finish pre-scroll, then animate this entry
    const go = this.context?.waitToAnimate
      ? this.context.waitToAnimate()
      : Promise.resolve();

    go.then(() => {
      requestAnimationFrame(() => {
        void outer.offsetHeight; // force reflow
        outer.style.height = `${target}px`;
      });
    });

    // Listen for transition end to finalize animation
    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName !== 'height') return;
    const finalPx = Math.round(outer.getBoundingClientRect().height);
      outer.style.transition = 'none';
      outer.style.height = `${finalPx}px`;
      void outer.offsetHeight;
      outer.style.transition = '';
      outer.style.height = 'auto';
      this.context?.onExpandEnd(this.props.id);
      outer.removeEventListener('transitionend', onEnd);
    };
    outer.addEventListener('transitionend', onEnd);

    // Setup a resizeObserver since we have to assume entry contents could change size.
    this.resizeObserver = new ResizeObserver(() => {
      const newHeight = Math.ceil(box.getBoundingClientRect().height);
      if (newHeight !== this.lastHeight){
        this.lastHeight = newHeight;
        outer.style.height = `${newHeight}px`;
        this.context?.onExpandEnd(this.props.id, newHeight);
      }
      
    });
    this.resizeObserver.observe(this.measureRef.current!);
  }

  componentWillUnmount() {
    // Clean up transition listener and notify UIWindow
    const outer = this.outerRef.current;
    if (outer && this.onEnd) outer.removeEventListener('transitionend', this.onEnd);
    this.context?.onUnmount(this.props.id, this.lastHeight);
  }

  render() {
    return (
      <div ref={this.outerRef} style={{ height: 0, overflow: 'hidden', display: 'block' }}>
        {/* Measured wrapper for animation */}
        <div ref={this.measureRef}>{this.props.children}</div>
      </div>
    );
  }
}

export default OuterEntry;
