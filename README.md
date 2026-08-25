# Shadow Runner

Shadow Runner is a 3D stealth-runner about surviving a city whose shadows move with the sun. It is designed as an installable PWA for Windows and as a Capacitor app for Android and iOS.

## Included

- Real-time 3D city rendered with Three.js
- Moving directional sun and geometry-based shadow safety checks
- Sun exposure, dash, animated player, collision, relics, goal gates, ranks, and par times
- Deterministic progression through 1,000 levels in 50 districts
- Keyboard, touch joystick, haptics, synthesized audio, pause, settings, and local saves
- English and Persian interface with RTL support
- Responsive HUD, safe-area support, reduced-motion support, and PWA offline cache
- Capacitor configuration for Android and iOS store builds

## Run

```bash
npm install
npm run dev
```

Use `WASD` or arrow keys to move and `Space` to dash. On touch devices, use the on-screen joystick and dash button.

## Validate

```bash
npm test
npm run build
```

The tests generate all 1,000 levels twice, verify deterministic output, and check collectible placement.

## Platform builds

### Android

Install Android Studio, Android SDK 36, and JDK 21 first. Set Android Studio's Gradle JDK to 21.

```bash
npx cap add android
npm run native:sync
npm run android:open
```

Build a signed Android App Bundle in Android Studio. Cafe Bazaar and Myket both accept Android store releases; check each store's current signing and billing requirements before submission.

### iOS

```bash
npx cap add ios
npm run native:sync
npm run ios:open
```

The final iOS archive must be signed and uploaded using Xcode on macOS with an Apple Developer account.

### Windows

Run `npm run build`, host `dist`, and install it from Microsoft Edge as a PWA. For Microsoft Store submission, package the hosted PWA with PWABuilder or submit its generated MSIX package.

## Production notes

- Replace `com.shadowrunner.game` in `capacitor.config.json` with a publisher-owned reverse-domain app ID before the first store release. It cannot safely change after publishing.
- Create final 1024x1024 store artwork and platform-specific adaptive icons from `public/icon.svg`.
- Test performance on mid-range physical Android and iOS devices before release.
- Keep hand-authored featured levels for store screenshots while retaining procedural generation for the full campaign.
- Add store billing only after choosing the exact paid-download or in-app-purchase model required by the target store.
