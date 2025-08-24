import React from 'react';

/* ------------- WINDOW CONTEXT (entries report events) ------------- */

type WindowCtx = {
  onExpandBegin: (id: number, height: number) => void;
  onExpandEnd: (id: number, final?: number) => void;
  onUnmount: (id: number, lastHeight?: number) => void;
  waitToAnimate: () => Promise<void>;  // <-- NEW
};

const WindowContext = React.createContext<WindowCtx | null>(null);

/* ---------------------- VISUAL ENTRY CONTENT ---------------------- */

class InnerEntry extends React.Component<{ text: string }> {
  render() {
    return (
      <div
        style={{
          display: 'block',
          boxSizing: 'border-box',
          padding: '12px 14px',
          border: '1px solid #e3e3e3',
          borderRadius: 12,
          lineHeight: 1.35,
          fontFamily:
            'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
          /* no margins — keeps measured heights exact */
          margin: 0,
        }}
      >
        {this.props.text}
      </div>
    );
  }
}

/* -------------------- WRAPPER THAT EXPANDS ON MOUNT -------------------- */

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

/* --------------------- BOTTOM-ANCHORED WINDOW --------------------- */

class UIWindow extends React.Component<
  { children: React.ReactNode },
  { spacerPx: number; scrollable: boolean; showJump: boolean }
> {
  state = { spacerPx: 0, scrollable: false, showJump: false };

  private containerRef = React.createRef<HTMLDivElement>();
  private heights = new Map<number, number>();      // id -> px
  private animatingIds = new Set<number>();         // ids currently animating
  private batchActive = false;
  private batchStartedAtBottom = false;

  private ro?: ResizeObserver;
  private animHandle: { cancel?: () => void } | null = null;
  private animGateOpen = true;
  private waiters: Array<() => void> = [];

  // pin loop
  private pinActive = false;
  private pinRaf: number | null = null;

  private static readonly EPS = 2; // px

  // allow children to await the gate
  private waitToAnimate = () =>
  new Promise<void>((resolve) => {
    if (this.animGateOpen) resolve();
    else this.waiters.push(resolve);
  });
  private openGate() {
    if (this.animGateOpen) return;
    this.animGateOpen = true;
    const w = this.waiters.splice(0);
    w.forEach((fn) => fn());
  }
  private closeGate() { this.animGateOpen = false; }

  componentDidMount() {
    this.recomputeSpacer();

    const el = this.containerRef.current;
    if ('ResizeObserver' in window) {
      this.ro = new ResizeObserver(() => {
        this.recomputeSpacer();
        if (this.pinActive) this.scrollToBottomInstant();
      });
      if (el) this.ro.observe(el);
    }
    if (el) {
      el.addEventListener('scroll', this.onScroll, { passive: true });
      const cancel = () => this.cancelSmooth();
      el.addEventListener('wheel', cancel, { passive: true });
      el.addEventListener('touchstart', cancel, { passive: true });
      el.addEventListener('pointerdown', cancel, { passive: true });
    }
  }

  componentWillUnmount() {
    this.ro?.disconnect();
    const el = this.containerRef.current;
    if (el) {
      el.removeEventListener('scroll', this.onScroll);
      el.removeEventListener('wheel', this.cancelSmooth as any);
      el.removeEventListener('touchstart', this.cancelSmooth as any);
      el.removeEventListener('pointerdown', this.cancelSmooth as any);
    }
    this.stopPin();
    this.cancelSmooth();
  }

  /* ---------- utils ---------- */

  private cancelSmooth = () => {
    // if we are pre-scrolling to bottom and gate is closed, don't cancel
    if (this.batchActive && !this.animGateOpen) return;
    try { this.animHandle?.cancel?.(); } catch {}
    this.animHandle = null;
  };

  private sumHeights() {
    let total = 0;
    for (const h of this.heights.values()) total += h;
    return total;
  }

  private recomputeSpacer() {
    const el = this.containerRef.current;
    const containerH = el?.clientHeight ?? 0;
    const itemsH = this.sumHeights();
    const raw = containerH - itemsH;
    const spacer = Math.max(0, raw);
    const scrollable = raw <= UIWindow.EPS;

    this.setState({
      spacerPx: spacer,
      scrollable,
      showJump: scrollable ? this.state.showJump : false,
    });
  }

  private isAtBottom(el?: HTMLElement | null) {
    if (!el) return true;
    const max = el.scrollHeight - el.clientHeight;
    return max - el.scrollTop <= UIWindow.EPS;
  }

  private scrollToBottomInstant() {
    const el = this.containerRef.current;
    if (!el) return;
    el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
  }

  private savedScrollBehavior: string | null = null;

  private scrollToBottomSmooth(duration = 420, onDone?: () => void) {
    const el = this.containerRef.current;
    if (!el) { onDone?.(); return; }

    // Force programmatic control (avoid default smooth)
    if (this.savedScrollBehavior == null) {
      this.savedScrollBehavior = el.style.scrollBehavior;
    }
    el.style.scrollBehavior = 'auto';

    this.cancelSmooth();

    const start = el.scrollTop;
    const end = Math.max(0, el.scrollHeight - el.clientHeight);
    const dist = end - start;
    if (dist <= 0) { onDone?.(); return; }

    let rafId: number | null = null;
    let cancelled = false;
    const t0 = performance.now();
    const easeInOutQuart = (t: number) =>
      t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;

    const step = (t: number) => {
      if (cancelled) return;
      const dt = Math.min(1, (t - t0) / duration);
      el.scrollTop = start + dist * easeInOutQuart(dt);
      if (dt < 1) {
        rafId = requestAnimationFrame(step);
      } else {
        // restore original behavior after our controlled scroll
        el.style.scrollBehavior = this.savedScrollBehavior ?? '';
        onDone?.();
      }
    };

    rafId = requestAnimationFrame(step);
    this.animHandle = {
      cancel: () => {
        cancelled = true;
        if (rafId) cancelAnimationFrame(rafId);
        el.style.scrollBehavior = this.savedScrollBehavior ?? '';
      },
    };
  }

  /* ---------- pin loop ---------- */

  private startPin() {
    if (this.pinActive) return;
    this.pinActive = true;
    if (this.state.showJump) this.setState({ showJump: false });

    const loop = () => {
      if (!this.pinActive) return;
      this.scrollToBottomInstant();
      this.pinRaf = requestAnimationFrame(loop);
    };
    loop();
  }

  private stopPin() {
    this.pinActive = false;
    if (this.pinRaf != null) cancelAnimationFrame(this.pinRaf);
    this.pinRaf = null;
  }

  /* ---------- scroll & jump UI ---------- */

  private onScroll = () => {
    const el = this.containerRef.current;
    if (!el) return;
    if (this.pinActive) return; // ignore while pinned
    const nearBottom = this.isAtBottom(el);
    const showJump = this.state.scrollable && !nearBottom;
    if (showJump !== this.state.showJump) this.setState({ showJump });
  };

  private onJumpClick = () => this.scrollToBottomSmooth(520);

  /* ---------- context handlers (ID-based) ---------- */

  private unpinTimer: number | null = null;
  private armUnpinFallback(ms = 1200) {
    if (this.unpinTimer != null) clearTimeout(this.unpinTimer);
    this.unpinTimer = window.setTimeout(() => {
      if (this.pinActive && this.animatingIds.size === 0) {
        this.stopPin();
        this.recomputeSpacer();
      }
      this.unpinTimer = null;
    }, ms);
  }

  // Called by OuterEntry on mount with its target height
  private onExpandBegin = (id: number, height: number) => {
  this.heights.set(id, height);

  if (!this.batchActive) {
    this.batchActive = true;

    // Block entries until pre-scroll completes.
    this.closeGate();

    // Smooth to bottom first, then pin, then open gate so items can animate.
    this.scrollToBottomSmooth(260, () => {
      this.startPin();
      this.openGate();
      // safety: if nothing animates, unpin soon
      this.armUnpinFallback(1200);
    });
  }

  if (!this.animatingIds.has(id)) this.animatingIds.add(id);

  // Reflect incoming height into spacer immediately
  this.recomputeSpacer();
};

  // Called by OuterEntry after its transition ends
  private onExpandEnd = (id: number) => {
  if (!this.animatingIds.has(id)) return;
  this.animatingIds.delete(id);

  if (this.animatingIds.size === 0) {
    // Batch complete → unpin and do a short settle scroll
    if (this.unpinTimer != null) { clearTimeout(this.unpinTimer); this.unpinTimer = null; }
    this.stopPin();
    this.recomputeSpacer();
    requestAnimationFrame(() => this.scrollToBottomSmooth(320));
    this.batchActive = false;
  }
};

  // Called by OuterEntry on unmount
  private onUnmount = (id: number) => {
    this.heights.delete(id);
    this.animatingIds.delete(id);
    this.recomputeSpacer();
  };

  /* ---------- render ---------- */

  render() {
    const { spacerPx, scrollable, showJump } = this.state;

    return (
      <div
        ref={this.containerRef}
        style={{
          height: '60vh',
          border: '1px solid #ddd',
          borderRadius: 12,
          boxSizing: 'border-box',
          padding: '0 12px',                 // no vertical padding; simpler math
          overflowY: scrollable ? 'auto' : 'hidden',
          background: '#fafafa',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',              // for overlay button
          scrollBehavior: 'auto',
        }}
      >
        <WindowContext.Provider
          value={{
            onExpandBegin: this.onExpandBegin,
            onExpandEnd: this.onExpandEnd,
            onUnmount: this.onUnmount,
            waitToAnimate: this.waitToAnimate,   // <-- add this
          }}
>
          {/* shrinking spacer */}
          <div
            style={{
              flex: '0 0 auto',
              height: spacerPx,
              transition: 'height 250ms ease',
            }}
          />

          {/* entries */}
          <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column' }}>
            {this.props.children}
          </div>

          {/* floating jump-to-bottom; doesn’t affect layout */}
          <button
            onClick={this.onJumpClick}
            style={{
              position: 'sticky',
              right: 12,
              bottom: 12,
              display: showJump ? 'inline-flex' : 'none',
              alignItems: 'center',
              gap: 8,
              border: '1px solid #e3e3e3',
              background: 'white',
              borderRadius: 999,
              padding: '8px 12px',
              boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
              transform: showJump ? 'translateY(0)' : 'translateY(12px)',
              opacity: showJump ? 1 : 0,
              transition: 'transform 200ms ease, opacity 200ms ease',
              zIndex: 3,
            }}
          >
            Jump to bottom
          </button>
        </WindowContext.Provider>
      </div>
    );
  }
}






/* ------------------------ DEMO CONTROLLER ------------------------ */

type DemoState = { items: number[]; nextId: number; n: number };

export class Demo extends React.Component<{}, DemoState> {
  state: DemoState = { items: [0, 1, 2], nextId: 3, n: 1 };

  append = () => {
    this.setState(({ items, nextId }) => ({
      items: [...items, nextId],
      nextId: nextId + 1,
    }));
  };

  deleteNFromEnd = () => {
    this.setState(({ items, n }) => ({
      items: items.slice(0, Math.max(0, items.length - n)),
    }));
  };

  replaceNFromEndWithNew = () => {
    this.setState(({ items, n, nextId }) => {
      const cut = Math.max(0, items.length - n);
      const count = Math.min(n, items.length);
      const newIds = Array.from({ length: count }, (_, i) => nextId + i);
      return { items: [...items.slice(0, cut), ...newIds], nextId: nextId + count };
    });
  };

  onChangeN = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    this.setState({ n: Number.isFinite(v) ? Math.max(0, v) : 0 });
  };

  render() {
    const { items, n } = this.state;

    return (
      <div style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <button onClick={this.append}>Append one</button>
          <button onClick={this.deleteNFromEnd}>Delete last N</button>
          <button onClick={this.replaceNFromEndWithNew}>Replace last N with new</button>
          <label style={{ marginLeft: 'auto' }}>
            N:&nbsp;
            <input
              type="number"
              min={0}
              value={n}
              onChange={this.onChangeN}
              style={{ width: 64 }}
            />
          </label>
        </div>

        <UIWindow>
          {items.map((id) => (
            <OuterEntry key={id} id={id}>
              <InnerEntry text={`Item #${id}`} />
            </OuterEntry>
          ))}
        </UIWindow>
      </div>
    );
  }
}
