// Demo.tsx
import React from 'react';

class InnerEntry extends React.Component<{ text: string }> {
  render() {
    return (
      <div
        style={{
          display: 'block',
          padding: '12px 14px',
          border: '1px solid #e3e3e3',
          borderRadius: 12,
          lineHeight: 1.35,
          backgroundColor: '#a9f9f9',
          fontFamily:
            'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
          // no vertical margin here
          margin: 0,
          boxSizing: 'border-box',
        }}
      >
        {this.props.text}
      </div>
    );
  }
}

class OuterEntry extends React.Component<{ children: React.ReactNode }> {
  private outerRef = React.createRef<HTMLDivElement>();
  private innerRef = React.createRef<HTMLDivElement>();

  componentDidMount() {
    const outer = this.outerRef.current!;
    const inner = this.innerRef.current!;
    if (!outer || !inner) return;

    // put spacing on the outer wrapper so it's not part of the measured height
    outer.style.margin = '6px 0';
    outer.style.overflow = 'hidden';
    outer.style.display = 'block';
    outer.style.boxSizing = 'border-box';
    outer.style.height = '0px';
    outer.style.transition = 'height 250ms ease';

    // Measure including borders/padding (no margins on inner)
    const target = Math.ceil(inner.getBoundingClientRect().height);

    requestAnimationFrame(() => {
      void outer.offsetHeight; // reflow
      outer.style.height = `${target}px`;
    });

    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName !== 'height') return;

      // --- Option A: keep fixed px (simplest, zero jump) ---
      // outer.style.transition = '';
      // outer.style.height = `${target}px`;

      // --- Option B: no-jump swap to 'auto' ---
      const finalPx = Math.ceil(outer.getBoundingClientRect().height);
      outer.style.transition = 'none';
      outer.style.height = `${finalPx}px`;
      void outer.offsetHeight; // commit
      outer.style.transition = ''; // restore (for future animations)
      outer.style.height = 'auto';

      outer.removeEventListener('transitionend', onEnd);
    };
    outer.addEventListener('transitionend', onEnd);
  }

  render() {
    // Inner wrapper is just for measuring
    return (
      <div ref={this.outerRef} style={{ height: 0, overflow: 'hidden', display: 'block' }}>
        <div ref={this.innerRef}>{this.props.children}</div>
      </div>
    );
  }
}

class UIWindow extends React.Component<{ children: React.ReactNode }> {
  render() {
    return <div style={{ display: 'block' }}>{this.props.children}</div>;
  }
}

type State = {
  items: number[];
  nextId: number;
  n: number;
};

export class Demo extends React.Component<{}, State> {
  state: State = {
    items: [0, 1, 2],
    nextId: 3,
    n: 1,
  };

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
      const count = Math.min(n, items.length); // how many we can actually replace
      const newIds = Array.from({ length: count }, (_, i) => nextId + i);
      return {
        items: [...items.slice(0, cut), ...newIds],
        nextId: nextId + count,
      };
    });
  };

  onChangeN = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value, 10);
    this.setState({ n: Number.isFinite(v) ? Math.max(0, v) : 0 });
  };

  render() {
    const { items, n } = this.state;

    return (
      <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
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
            <OuterEntry key={id}>
              <InnerEntry text={`Item #${id}`} />
            </OuterEntry>
          ))}
        </UIWindow>
      </div>
    );
  }
}
