import React from 'react';
import UIWindow from './components/UIWindow';
import InnerEntry from './components/InnerEntry';
import OuterEntry from './components/OuterEntry';

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
