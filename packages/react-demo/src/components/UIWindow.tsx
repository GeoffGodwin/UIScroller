import React from 'react';
import { WindowContext } from "./WindowContext";

class UIWindow extends React.Component<
  { children: React.ReactNode },
  { spacerPx: number; scrollable: boolean; showJump: boolean }
> {
  state = { spacerPx: 0, scrollable: false, showJump: false };

  private containerRef = React.createRef<HTMLDivElement>();
  private heights = new Map<number, number>();      // id -> px
  private animatingIds = new Set<number>();         // ids currently animating
  private batchActive = false;

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
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid #e3e3e3',
              background: 'white',
              borderRadius: 999,
              padding: '8px 12px',
              boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
              transform: showJump ? 'translateY(0)' : 'translateY(-24px)',
              opacity: showJump ? 1 : 0,
              transition: 'transform 200ms ease, opacity 200ms ease',
              zIndex: 3,
              pointerEvents: showJump ? 'auto' : 'none',
            }}
          >
            Jump to bottom
          </button>
        </WindowContext.Provider>
      </div>
    );
  }
}

export default UIWindow;
