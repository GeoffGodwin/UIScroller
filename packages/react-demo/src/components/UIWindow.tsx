/**
 * UIWindow
 *
 * A smart, bottom-up animated scroll container for React UIs.
 *
 * Features:
 * - Shows new entries popping in from the bottom, like a chat app.
 * - Handles smooth entry/exit animations, batch changes, and jump-to-bottom UI.
 * - Designed to be embedded in any container and fully responsive (e.g., CSS grid).
 * - Maintains correct layout and animation even with rapid or batch changes.
 *
 * Usage:
 *   <UIWindow>
 *     {items.map(id => (
 *       <OuterEntry key={id} id={id}>
 *         <InnerEntry text={`Item #${id}`} />
 *       </OuterEntry>
 *     ))}
 *   </UIWindow>
 *
 * UIWindow coordinates entry/exit animations, manages scroll position, and exposes context for child entries.
 *
 * @component
 * @example
 *   <UIWindow>
 *     <OuterEntry id={1}><InnerEntry text="Hello" /></OuterEntry>
 *   </UIWindow>
 */
import React from 'react';
import { WindowContext } from "./WindowContext";

class UIWindow extends React.Component<
  { children: React.ReactNode },
  { spacerPx: number; scrollable: boolean; showJump: boolean; jumpBtnTop?: number }
> {
  state = { spacerPx: 0, scrollable: false, showJump: false, jumpBtnTop: undefined as number | undefined };

  /** Ref to the scroll container DOM node */
  private containerRef = React.createRef<HTMLDivElement>();
  /** Tracks measured heights for each entry (id -> px) */
  private entryHeights = new Map<number, number>();
  /** Ref to the floating jump-to-bottom button */
  private jumpButtonRef = React.createRef<HTMLButtonElement>();
  /** Set of entry ids currently animating */
  private animatingEntryIds = new Set<number>();
  /** True if a batch of entries is being added/removed */
  private batchActive = false;

  /** ResizeObserver for the scroll container */
  private resizeObserver?: ResizeObserver;
  /** Handle for cancelling smooth scroll animation */
  private animationHandle: { cancel?: () => void } | null = null;
  /** Animation gate: blocks entry animations until pre-scroll is done */
  private animationGateOpen = true;
  private animationWaiters: Array<() => void> = [];

  /** Pin loop: keeps scroll pinned to bottom during batch entry */
  private pinActive = false;
  private pinRequestAnimationFrame: number | null = null;

  /** Epsilon for scroll/height comparisons */
  private static readonly EPSILON = 2; // px

  /**
   * Allows children (entries) to await the animation gate before animating in.
   * Used to ensure pre-scroll is complete before entry animation.
   */
  private waitToAnimate = () =>
    new Promise<void>((resolve) => {
      if (this.animationGateOpen) resolve();
      else this.animationWaiters.push(resolve);
    });
  private openGate() {
    if (this.animationGateOpen) return;
    this.animationGateOpen = true;
    const waiters = this.animationWaiters.splice(0);
    waiters.forEach((fn) => fn());
  }
  private closeGate() { this.animationGateOpen = false; }

  /** Set up resize/scroll listeners and initial layout */
  componentDidMount() {
    this.recomputeSpacer();
    this.updateJumpBtnPosition();

    const el = this.containerRef.current;
    if ('ResizeObserver' in window) {
      this.resizeObserver = new ResizeObserver(() => {
        this.recomputeSpacer();
        this.updateJumpBtnPosition();
        if (this.pinActive) this.scrollToBottomInstant();
      });
      if (el) this.resizeObserver.observe(el);
    }
    if (el) {
      el.addEventListener('scroll', this.onScroll, { passive: true });
      const cancel = () => this.cancelSmooth();
      el.addEventListener('wheel', cancel, { passive: true });
      el.addEventListener('touchstart', cancel, { passive: true });
      el.addEventListener('pointerdown', cancel, { passive: true });
    }
    window.addEventListener('resize', this.handleResize);
  }

  /** Clean up listeners and timers */
  componentWillUnmount() {
    this.resizeObserver?.disconnect();
    const el = this.containerRef.current;
    if (el) {
      el.removeEventListener('scroll', this.onScroll);
      el.removeEventListener('wheel', this.cancelSmooth as any);
      el.removeEventListener('touchstart', this.cancelSmooth as any);
      el.removeEventListener('pointerdown', this.cancelSmooth as any);
    }
    window.removeEventListener('resize', this.handleResize);
    this.stopPin();
    this.cancelSmooth();
  }
  /** On window resize: update jump button and show/hide as needed */
  private handleResize = () => {
    this.updateJumpBtnPosition();
    const el = this.containerRef.current;
    if (!el) return;
    if (this.pinActive) return; // ignore while pinned
    const nearBottom = this.isAtBottom(el);
    const showJump = this.state.scrollable && !nearBottom;
    if (showJump !== this.state.showJump) this.setState({ showJump });
  };
  /** Position the jump-to-bottom button 10px from the visible bottom */
  private updateJumpBtnPosition = () => {
    const container = this.containerRef.current;
    const btn = this.jumpButtonRef.current;
    if (container && btn) {
      // The button should be 10px from the visible bottom of the scroll area, regardless of scroll position
      const top = Math.round(container.scrollTop + container.clientHeight - btn.offsetHeight - 10);
      this.setState({ jumpBtnTop: top });
    }
  };

  // --- Utility methods ---

  /** Cancel any ongoing smooth scroll unless in pre-scroll batch */
  private cancelSmooth = () => {
  if (this.batchActive && !this.animationGateOpen) return;
  try { this.animationHandle?.cancel?.(); } catch {}
  this.animationHandle = null;
  };

  /**
   * Sum all measured entry heights.
   * @returns {number} Total height of all entries in px.
   */
  private sumEntryHeights() {
    let total = 0;
    for (const h of this.entryHeights.values()) total += h;
    return total;
  }

  /**
   * Recompute spacer height and scrollability, and update jump button.
   * Ensures the scroll area always fills the container and jump button is shown/hidden correctly.
   */
  private recomputeSpacer() {
    const el = this.containerRef.current;
  const containerHeight = Math.round(el?.clientHeight ?? 0);
  const entriesHeight = Math.round(this.sumEntryHeights());
  // console.log('Entries height is calc to be', entriesHeight);
  const raw = containerHeight - entriesHeight;
  const spacer = Math.max(0, Math.round(raw));
  const scrollable = raw <= UIWindow.EPSILON;

    // Only allow showJump to be true if not batchActive or pinActive
    let showJump = this.state.showJump;
    if (!scrollable) {
      showJump = false;
    } else if (this.batchActive || this.pinActive) {
      showJump = false;
    }

    this.setState({
      spacerPx: spacer,
      scrollable,
      showJump,
    });
  }

  /**
   * Returns true if scrolled to bottom (within EPSILON).
   * @param {HTMLElement | null} el
   * @returns {boolean}
   */
  private isAtBottom(el?: HTMLElement | null) {
    if (!el) return true;
    const max = Math.round(el.scrollHeight - el.clientHeight);
    const scrollTop = Math.round(el.scrollTop);
    return Math.abs(max - scrollTop) <= UIWindow.EPSILON;
  }

  /** Instantly scroll to bottom. */
  private scrollToBottomInstant() {
    const el = this.containerRef.current;
    if (!el) return;
  el.scrollTop = Math.max(0, Math.round(el.scrollHeight - el.clientHeight));
  }

  /** Stores the original scroll-behavior style for restoration. */
  private savedScrollBehavior: string | null = null;

  /**
   * Smoothly scroll to bottom over a duration (ms).
   * @param {number} duration - Animation duration in ms.
   * @param {() => void} [onDone] - Optional callback when done.
   */
  private scrollToBottomSmooth(duration = 420, onDone?: () => void) {
    const el = this.containerRef.current;
    if (!el) { onDone?.(); return; }

    // Force programmatic control (avoid default smooth)
    if (this.savedScrollBehavior == null) {
      this.savedScrollBehavior = el.style.scrollBehavior;
    }
    el.style.scrollBehavior = 'auto';

    this.cancelSmooth();

  const start = Math.round(el.scrollTop);
  const end = Math.max(0, Math.round(el.scrollHeight - el.clientHeight));
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
  this.animationHandle = {
      cancel: () => {
        cancelled = true;
        if (rafId) cancelAnimationFrame(rafId);
        el.style.scrollBehavior = this.savedScrollBehavior ?? '';
      },
    };
  }

  // --- Pin loop: keep scroll at bottom during batch entry ---

  /** Start pinning scroll to bottom. */
  private startPin() {
    if (this.pinActive) return;
    this.pinActive = true;
    if (this.state.showJump) this.setState({ showJump: false });

    const loop = () => {
      if (!this.pinActive) return;
      this.scrollToBottomInstant();
  this.pinRequestAnimationFrame = requestAnimationFrame(loop);
    };
    loop();
  }

  /** Stop pinning scroll. */
  private stopPin() {
    this.pinActive = false;
  if (this.pinRequestAnimationFrame != null) cancelAnimationFrame(this.pinRequestAnimationFrame);
  this.pinRequestAnimationFrame = null;
  }

  // --- Scroll and jump-to-bottom UI ---

  /**
   * On scroll: show/hide jump button if not pinned or batching.
   * Updates jump button position and visibility.
   */
  private onScroll = () => {
    const el = this.containerRef.current;
    if (!el) return;
    if (this.pinActive || this.batchActive) return; // ignore while pinned or batching
    const nearBottom = this.isAtBottom(el);
    const showJump = this.state.scrollable && !nearBottom;
    if (showJump !== this.state.showJump) this.setState({ showJump }, this.updateJumpBtnPosition);
    else this.updateJumpBtnPosition();
  };

  /** Jump button click handler. */
  private onJumpClick = () => this.scrollToBottomSmooth(520);

  // --- Context handlers for entry lifecycle (ID-based) ---

  /**
   * Fallback: unpin after a timeout if no animations complete.
   * @param {number} ms - Timeout in ms.
   */
  private unpinTimer: number | null = null;
  private armUnpinFallback(ms = 1200) {
    if (this.unpinTimer != null) clearTimeout(this.unpinTimer);
    this.unpinTimer = window.setTimeout(() => {
  if (this.pinActive && this.animatingEntryIds.size === 0) {
        this.stopPin();
        this.recomputeSpacer();
      }
      this.unpinTimer = null;
    }, ms);
  }

  /**
   * Called by OuterEntry on mount with its measured height.
   * Notifies UIWindow to start batch animation and pre-scroll.
   * @param {number} id - Entry id.
   * @param {number} height - Measured height in px.
   */
  private onExpandBegin = (id: number, height: number) => {
    this.entryHeights.set(id, height);

    if (!this.batchActive) {
      this.batchActive = true;
      this.closeGate();
      // Hide jump button immediately before scrolling to bottom
      if (this.state.showJump) {
        this.setState({ showJump: false });
        this.scrollToBottomSmooth(260, () => {
          this.startPin();
          this.openGate();
          this.armUnpinFallback(1200);
        });
      } else {
        this.scrollToBottomSmooth(260, () => {
          this.startPin();
          this.openGate();
          this.armUnpinFallback(1200);
        });
      }
    }

    if (!this.animatingEntryIds.has(id)) this.animatingEntryIds.add(id);
    this.recomputeSpacer();
  };

  /**
   * Called by OuterEntry after its expand transition ends.
   * Notifies UIWindow to finish batch and do a settle scroll if needed.
   * @param {number} id - Entry id.
   */
  private onExpandEnd = (id: number) => {
    if (!this.animatingEntryIds.has(id)) return;
    this.animatingEntryIds.delete(id);

    if (this.animatingEntryIds.size === 0) {
      // Batch complete → unpin and do a short settle scroll
      if (this.unpinTimer != null) { clearTimeout(this.unpinTimer); this.unpinTimer = null; }
      this.stopPin();
      this.recomputeSpacer();
      requestAnimationFrame(() => this.scrollToBottomSmooth(320));
      this.batchActive = false;
    }
  };

  /**
   * Called by OuterEntry on unmount.
   * Cleans up entry height and animation state.
   * @param {number} id - Entry id.
   */
  private onUnmount = (id: number) => {
    this.entryHeights.delete(id);
    this.animatingEntryIds.delete(id);
    this.recomputeSpacer();
  };

  // --- Render ---

  render() {
    const { spacerPx, scrollable, showJump, jumpBtnTop } = this.state;

    return (
      <div
        ref={this.containerRef}
        style={{
          height: '100%',
          boxSizing: 'border-box',
          padding: '0 12px',                 // no vertical padding; simpler math
          overflowY: scrollable ? 'auto' : 'hidden',
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
            waitToAnimate: this.waitToAnimate,
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
          {/* floating jump-to-bottom; doesn’t affect layout */}
          <button
            ref={this.jumpButtonRef}
            onClick={this.onJumpClick}
            style={{
              position: 'absolute',
              right: 12,
              top: jumpBtnTop,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'white',
              borderRadius: 999,
              boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
              zIndex: 3,
              opacity: showJump ? 1 : 0,
              transform: showJump ? 'translateY(0)' : 'translateY(-24px)',
              transition: 'transform 200ms ease, opacity 200ms ease',
              pointerEvents: showJump ? 'auto' : 'none',
              height: 'auto',
              padding: '8px 12px',
              border: '1px solid #e3e3e3',
              overflow: 'hidden',
              cursor: 'pointer'
            }}
          >
            Jump to bottom
          </button>
          {/* entries */}
          <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column' }}>
            {this.props.children}
          </div>

        </WindowContext.Provider>
      </div>
    );
  }
}

export default UIWindow;
