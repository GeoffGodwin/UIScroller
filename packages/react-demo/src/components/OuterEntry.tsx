import React from 'react';
import { WindowContext } from "./WindowContext";

class OuterEntry extends React.Component<{
  id: number;
  children: React.ReactNode;
}> {
  static contextType = WindowContext;
  declare context: React.ContextType<typeof WindowContext>;

  private outerRef = React.createRef<HTMLDivElement>();
  private measureRef = React.createRef<HTMLDivElement>();
  private lastHeight = 0;
  private onEnd?: (e: TransitionEvent) => void;

  componentDidMount() {
  const outer = this.outerRef.current!;
  const box = this.measureRef.current!;
  if (!outer || !box) return;

  outer.style.overflow = 'hidden';
  outer.style.display = 'block';
  outer.style.boxSizing = 'border-box';
  outer.style.height = '0px';
  outer.style.transition = 'height 250ms ease';

  const target = Math.ceil(box.getBoundingClientRect().height);
  this.lastHeight = target;

  // Synchronous: informs UIWindow immediately (closes the gate)
  this.context?.onExpandBegin(this.props.id, target);

  // Wait until UIWindow finishes its pre-scroll, then animate this item
  const go = this.context?.waitToAnimate
    ? this.context.waitToAnimate()
    : Promise.resolve();

  go.then(() => {
    requestAnimationFrame(() => {
      void outer.offsetHeight; // reflow
      outer.style.height = `${target}px`;
    });
  });

  const onEnd = (e: TransitionEvent) => {
    if (e.propertyName !== 'height') return;
    const finalPx = Math.ceil(outer.getBoundingClientRect().height);
    outer.style.transition = 'none';
    outer.style.height = `${finalPx}px`;
    void outer.offsetHeight;
    outer.style.transition = '';
    outer.style.height = 'auto';
    this.context?.onExpandEnd(this.props.id);
    outer.removeEventListener('transitionend', onEnd);
  };
  outer.addEventListener('transitionend', onEnd);
}

  componentWillUnmount() {
    const outer = this.outerRef.current;
    if (outer && this.onEnd) outer.removeEventListener('transitionend', this.onEnd);
    this.context?.onUnmount(this.props.id, this.lastHeight);
  }

  render() {
    return (
      <div ref={this.outerRef} style={{ height: 0, overflow: 'hidden', display: 'block' }}>
        {/* This wrapper is what we measure */}
        <div ref={this.measureRef}>{this.props.children}</div>
      </div>
    );
  }
}

export default OuterEntry;
