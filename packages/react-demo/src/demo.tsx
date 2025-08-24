/**
 * Demo: Interactive showcase for UIWindow and entry animation features.
 * - Demonstrates bottom-up entry, batch changes, and jump-to-bottom UI.
 * - Now includes a CSS grid container to prove UIWindow responsiveness.
 */
import React from 'react';
import './demo.css';
import UIWindow from './components/UIWindow';
import InnerEntry from './components/InnerEntry';
import ReactDOM from 'react-dom';
// VariableHeightEntry: for testing variable height entries
const VariableHeightEntry: React.FC<{ text: string }> = ({ text }) => {
  // Randomize height between 30px and 400px on each mount
  const [height] = React.useState(() => Math.floor(Math.random() * (400 - 30 + 1)) + 30);
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
        margin: 0,
        height,
        background: '#f9f9f9',
        transition: 'height 0.2s',
      }}
    >
      {text} <span style={{ color: '#aaa', fontSize: 12 }}>(height: {height}px)</span>
    </div>
  );
};
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
      <div className="page-layout">
        <div className="header">
          <div className="demo-controls">
            <button onClick={this.append}>Append one</button>
            <button onClick={this.deleteNFromEnd}>Delete last N</button>
            <button onClick={this.replaceNFromEndWithNew}>Replace last N with new</button>
            <label>
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
        </div>
        <div className="left-sidebar">
          Left Column
        </div>
        <div className="main">
          <UIWindow>
            {items.map((id) => (
              <OuterEntry key={id} id={id}>
                <VariableHeightEntry text={`Item #${id}`} />
              </OuterEntry>
            ))}
          </UIWindow>
        </div>
        <div className="right-sidebar">
          Right Column
        </div>
        <div className='footer'>Footer Content</div>
      </div>
    );
  }
}
