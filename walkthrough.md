# VoxSpend Implementation Walkthrough

VoxSpend is now fully scaffolded and functional. Below is a summary of the features and architecture implemented.

## Core Features

### 1. Voice-First Expense Entry
The primary way to add expenses is by tapping the microphone button in the bottom navigation bar.
- **Recording**: Uses the browser's `MediaRecorder` API with real-time audio level visualization.
- **Transcription**: Powered by **Groq Whisper (whisper-large-v3-turbo)** for near-instant speech-to-text.
- **AI Parsing**: **Groq Llama 3.3** extracts structured JSON (amount, category, merchant, date) from the transcript using a Ghana-specific system prompt (GHS default).

### 2. Local-First Architecture
- **IndexedDB**: Powered by **Dexie.js**. All data is saved locally first, ensuring the app works perfectly offline.
- **Pinia Stores**: Manage reactive state for expenses, categories, user profile, and voice state.
- **Sync Queue**: Every mutation (add/edit/delete) is queued for synchronization with the cloud backend (Convex).

### 3. Neumorphic UI
A premium design system inspired by the provided reference images.
- **Light & Dark Themes**: Fully supported via CSS custom properties and a dedicated Pinia store.
- **Custom Components**: Neumorphic cards, inset inputs, and glassmorphism navigation.
- **Responsive**: Mobile-first design optimized for various screen sizes.

### 4. PWA Support
- **Offline Resilience**: Service worker precaches the app shell and caches Google Fonts.
- **Installable**: Manifest and icons configured for a native-like experience on iOS and Android.

## Key Files

- [src/services/groqService.ts](src/services/groqService.ts) — The AI engine.
- [src/stores/expenses.ts](src/stores/expenses.ts) — The local-first data store.
- [src/assets/scss/main.scss](src/assets/scss/main.scss) — The design system.

## How to Test

1. **Start the dev server**: `npm run dev`
2. **Setup**: Enter your name and your personal **Groq API Key**.
3. **Add Expense**: Tap the blue mic button and say something like *"I spent 50 cedis on fuel at Goil today"*.
4. **Confirm**: Review the parsed details and save.
5. **Analytics**: Check the "Stats" tab to see your category breakdown.
