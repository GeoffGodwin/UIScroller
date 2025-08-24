# UIScroller

UIScroller is a smart, bottom-up animated scroll container for React UIs. It is designed for chat-like interfaces and any scenario where new elements should appear to pop in from the bottom, with smooth entry/exit animations and robust handling of batch changes. UIScroller is fully responsive and can be embedded in any layout, including CSS grids.

## Features

- **Bottom-up entry animation:** New items appear to pop in from the bottom, not just scroll up.
- **Batch change support:** Handles multiple additions/removals at once without animation glitches.
- **Jump-to-bottom UI:** Shows a floating button only when needed, without causing layout shifts.
- **Responsive design:** Works inside any container, including CSS grid layouts.
- **No layout bugs:** Maintains smoothness and correct positioning even with rapid or complex changes.
- **Simple API:** Just wrap your entries in `OuterEntry` and `InnerEntry` inside `UIWindow`.

## Demo

The included demo (`packages/react-demo`) shows:
- Appending, removing, and replacing entries
- Jump-to-bottom button behavior
- Responsiveness inside a CSS grid

### Run the Demo

```bash
cd packages/react-demo
npm install
npm run dev
# Open the local URL (usually http://localhost:5173)
```

## Usage

```tsx
import UIWindow from './components/UIWindow';
import OuterEntry from './components/OuterEntry';
import InnerEntry from './components/InnerEntry';

<UIWindow>
	{items.map((id) => (
		<OuterEntry key={id} id={id}>
			<InnerEntry text={`Item #${id}`} />
		</OuterEntry>
	))}
</UIWindow>
```

## How It Works

- **UIWindow** manages scroll position, spacer, and jump button.
- **OuterEntry** animates its own height and notifies UIWindow of lifecycle events.
- **InnerEntry** is a simple content block (customize as needed).
- **WindowContext** coordinates entry/exit and batch animation.

## Customization

- You can style the entries or UIWindow as needed.
- Works with any React content as children.

## License

MIT

---

*Contributions and suggestions are welcome!*
# UIScroller
Building a text animation style scroller to better learn StencilJS
