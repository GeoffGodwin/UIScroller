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
Note: This was run using Node v22.16.0

```bash
cd packages/react-demo
npm install
npm start
# Open the local URL (usually http://localhost:5173)
```


## Installation & Usage in Your App

Once published to npm, install UIScroller in your React project:

```bash
npm install ui-scroller-react
```

TypeScript type declarations are included automatically—no extra steps needed for autocompletion and type safety.

Then import the components from the package:

```tsx
import { UIWindow, OuterEntry, InnerEntry, WindowContext } from 'ui-scroller-react';

<UIWindow>
	{items.map((id) => (
		<OuterEntry key={id} id={id}>
			<InnerEntry text={`Item #${id}`} />
		</OuterEntry>
	))}
</UIWindow>
```

If using from source (not yet published), you can import directly from the `src` folder:

```tsx
import { UIWindow, OuterEntry, InnerEntry, WindowContext } from './path/to/ui-scroller-react/src';
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

## Build & Publishing (for contributors)

1. Make sure all code is in `src/` and exported via `src/index.ts`.
2. Run:

	```bash
	npm run build
	```

	This will generate both the production build and the TypeScript type declarations in `dist/`.

3. To publish:

	```bash
	npm publish
	```

	(Make sure the `name` in `package.json` is unique and `private` is set to `false`.)

## License

MIT
