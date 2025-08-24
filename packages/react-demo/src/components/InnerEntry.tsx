import React from 'react';

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

export default InnerEntry;
