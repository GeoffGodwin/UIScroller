# ui-scroller-react

A smart, bottom-up animated scroll container for React UIs. Perfect for chat and messaging interfaces. Includes TypeScript types and is fully responsive.

## Features
- Bottom-up entry animation (like chat apps)
- Handles batch changes and smooth entry/exit
- Jump-to-bottom UI
- Responsive and embeddable in any layout
- TypeScript support out of the box

## Installation
```bash
npm install ui-scroller-react
```

## Usage
```tsx
import { UIWindow, OuterEntry, InnerEntry } from 'ui-scroller-react';

<UIWindow>
  {items.map((id) => (
    <OuterEntry key={id} id={id}>
      <InnerEntry text={`Item #${id}`} />
    </OuterEntry>
  ))}
</UIWindow>
```

## License
MIT
