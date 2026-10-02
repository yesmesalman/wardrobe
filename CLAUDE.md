# Wardrobe - React Native App

## Project Overview
React Native mobile app for wardrobe management using the latest React Native (0.87.1) with TypeScript support.

## Development Requirements
- Avoid re-building app every time.
- Avoid testing UI changes

### Working Environment
- **Repository**: Local repository at `~/Documents/wardrobe`
- **Branch Strategy**: Always work directly on the `main` branch. Never create new branches (no feature branches, no worktree branches).
- **Always work on the local repository** - not cloud sessions
- Push changes to GitHub after each feature/fix

### Technology Stack
- React Native 0.87.1 (latest)
- React 19.2.3
- TypeScript
- Android & iOS support
- Metro bundler
- `@react-navigation/native` + `bottom-tabs` (with `react-native-screens`) for the bottom tab bar; `react-native-svg` for the drawn icons
- `react-native-webview` + three.js for the 3D garment view (bundled, offline)
- `react-native-vision-camera` v5 (with `react-native-nitro-modules` / `react-native-nitro-image`) for the guided camera, `react-native-image-picker` for the photo library, and `@dr.pogodin/react-native-fs` (storage)
- `react-native-bootsplash` for the launch screen

### App structure
- App icon: the black hanger on white. Launch: the native launch screen (`BootSplash.storyboard` / `BootTheme`, via `react-native-bootsplash`) is plain white, so the hanger can fade in. `SplashScreen` takes over from it: the hanger (`src/assets/bootsplash/logo.png`) fades in, holds, fades out once the saved wardrobe has loaded, then the white fades to reveal the app. Don't re-run the bootsplash asset generator: it would put the logo back into the native screens (and it reformats `AndroidManifest.xml` and writes `undefined` file types into `project.pbxproj`).
- Bottom tabs, in order: **Library** (opens first), **Outfit**, a round **Add item** button (`AddTabButton`, centre), **Trending**, **Settings** (a "Reset Data" row opens `ResetDataModal`, whose "Reset Complete Data" button asks for confirmation, then deletes every garment and its files via `wardrobe.reset` / `deleteAllData`).
- **Outfit** shows one 3D figure, as if worn: the first shirt from the Library over the first pants, in a single WebView scene (`OutfitScene`, `__setOutfit` in `webview/scene.js`; fixed front view, the pants are flattened slightly in depth so the waistband stays under the shirt hem). The scene is drawn in the screen's own background colour (`window.__BACKGROUND`, set by `OutfitScene`) so it has no visible panel, and the camera is framed to fill the height (widening only for long sleeves, which take at most about three-quarters of the width so they stay clear of the arrows; it glides when the shirt changes). Invisible swipe zones (`OutfitSwipeZone`) sit over the upper half (shirt) and lower half (pants), split where the scene reports the waist; while swiping, the garment follows the finger (`__dragOutfit`; it resists past the first/last item and gives a "rigid" haptic on release). A swipe past 45 pt or a quick flick changes the item: the old garment carries on out and the new one follows it in from the swipe direction (up to 300 ms, animated inside the scene; only the changed garment is rebuilt); otherwise it springs back (`__releaseOutfit`); it stops at the ends. Large, faded grey ‹ › arrows at the screen edges beside each garment (`OutfitArrow`) go to the previous/next item on tap, with the same slide; at the first/last item that arrow is shown disabled (a little fainter, and taps do nothing), and a kind with only one item has none. A dashed placeholder starts the add flow when a kind has none. Tapping a Library item opens it in 360° (`GarmentViewerModal`, with Done, **Use** and Delete); Use puts that garment on the figure (`wear` / `wearRequest` in `WardrobeContext`, no slide) and switches to the Outfit tab. The choice is not remembered between launches.
- The **Add item** button is the round "+" in the centre of the tab bar (`AddTabButton`), so it is on every screen; the screen headers (`ScreenHeader`) only show a title and subtitle.
- Library shows garments as a 4-column grid of bordered image-only cards. A "Select" button at the top right (shown when the tab has items) starts picking: every card shows a circle at its top right (a filled check when picked), taps add/remove items instead of opening the 3D viewer, and the header shows "Select items" / "N selected", a ⋯ button (`MoreMenu`, a small dropdown; faded and inactive while nothing is picked) whose only action is Delete (asks for confirmation), and an X in Select's place. Picking ends on the X, on a Shirts/Pants tab switch, on Android back, or after a delete. It opens a Shirt/Pants chooser, then the guided camera (`GuidedCamera`: the live view with a faint outline of the blank model drawn from `frontOutline` in `webview/garmentGeometry.js`, the long-sleeve shirt or long pants with dashes where short sleeves / shorts end, so the garment is laid flat in the model's shape; a Library button picks a photo instead, and on a device without a camera, such as the Simulator, it says so), then a shirt screen (short or long sleeves) or a pants screen (long pants or shorts), which starts on the variant the photo looks like. The add flow and the wardrobe state live in `src/state/WardrobeContext.tsx`.
- Each garment has a `kind` (shirt/pants, used for the per-kind limits and Library tabs) and a `variant` (short-sleeve, long-sleeve, long-pants, shorts) that selects the blank 3D model.

### How the 3D works
- Blank models are built at runtime by `webview/garmentGeometry.js` (short-sleeve shirt, long-sleeve shirt, long pants, shorts; the pants follow a slim-jeans flat-lay: the crotch point is high, at about 30% down from the waist, the legs part in a narrow V that widens to the hem, and the inseam is about 70% of the length; shorts have a roomier leg opening; the shirts follow a flat-lay tee: a boxy body with straight sides (a little wider than the pants' waist, which it covers in the Outfit; narrower and the waistband pokes through the shirt's sides), shoulders following one straight line sloping about 26° from the collar to the shoulder point, and sleeves hanging from the shoulder point about 46° below horizontal with a natural gap under the arm (a short sleeve is the first stretch of a long one); each sleeve starts just inside the body, slimmer than it, and stays under the shoulder line, so the shoulder rounds smoothly into the sleeve from any angle). Each has a `decal` anchor for print mode.
- Every garment of a variant uses the same standard model (`SHIRT` / `PANTS` proportions in `garmentGeometry.js`), so all shirts and all pants render at one size; the photo is warped to fit the model instead. After the cut-out, the photo's outline and the model's own front silhouette (`modelOutline`, measured once per variant) are measured the same way (`measureShirt`: body width and centre, hem, length, and each sleeve's root, angle and reach, a sleeve lying over the body falling back to the standard angle; `measurePants`: waist, crotch, half width there, the legs' outer/inner edges at the hem), and `warpOnto` draws the photo in the model's shape: shirts body-to-body (stretched to the standard length) and each sleeve turned and stretched along its axis onto the model's sleeve, blended across the body's sides; pants waist-to-crotch, then each leg crotch-to-hem. `__processPhoto` returns one warped cut-out per variant of the kind (the add screen shows the one for the chosen variant) plus the variant the garment looks like. If the outline or landmarks can't be found (or the background is kept), the plain crop is used for every variant.
- The photo is shown on the model in one of two modes (`Garment.mode`), rendered by three.js inside a WebView (`webview/scene.js`), bundled by `npm run build:webview` into `src/webview/sceneHtml.ts` (generated, committed). Re-run it after changing anything in `webview/`.
  - **fit** (default): the page cuts the garment out of the photo (flood-fills the plain background from the border, keeps the largest blob, peels the halo of shadow/anti-aliased pixels off its edge (`peelFringe`), picks the dominant colour), warps it into the model's shape (above) and projects it straight through the model's front over its front-on extent. Back/sides use the fabric colour; the photo fades out on surfaces facing sideways. The user can fine-tune in an "Adjust fit" 2D view (`Garment.align`): drag to move, pinch or the − / + zoom buttons (`ZoomControl`, hold to repeat; 30%–400%) to resize, Reset to go back. Saved as `<id>-cutout.png`.
  - **print**: the photo is a small decal on the chest/thigh. Only garments saved by early versions use it; new garments are always fit.
- Limits: 20 shirts and 20 pants (`MAX_PER_KIND` in `src/constants.ts`).
- Expo modules / `@react-three/fiber/native` were tried and dropped: Expo's native code needs a newer Xcode/Swift than the dev Mac supports.

### Dev environment notes
- Build needs Xcode 26.x (`sudo xcode-select -s /Applications/Xcode-26.app`) with the iOS platform installed.
- `~/Documents` is iCloud-synced, which breaks iOS code signing of build output. Build with `-derivedDataPath ~/Library/Developer/Xcode/DerivedData/wardrobe-ios`.

### Development Workflow
1. All work should be done on the local repository
2. Test changes locally before pushing
3. Use meaningful commit messages with context
4. Push to the `main` branch (do not create or switch to other branches)
5. Keep dependencies updated

### Project Structure
```
wardrobe/
├── App.tsx          # Main app component
├── index.js         # Entry point
├── src/             # Screens, components, hooks, storage, assets
├── webview/         # three.js scene and garment geometry for the WebView
├── scripts/         # WebView bundler
├── android/         # Android native code
├── ios/             # iOS native code
├── package.json     # Dependencies & scripts
└── tsconfig.json    # TypeScript configuration
```

### Available Scripts
- `npm start` - Start Metro bundler
- `npm run android` - Run on Android emulator
- `npm run ios` - Run on iOS simulator
- `npm run lint` - Run ESLint
- `npm test` - Run Jest tests
- `npm run build:webview` - Rebuild the WebView 3D page (`src/webview/sceneHtml.ts`)

### Notes
- Focus on clean code and component structure
- Use TypeScript for type safety
- Keep native code minimal for now
