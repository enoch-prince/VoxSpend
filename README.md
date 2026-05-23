# 🎙️ VoxSpend

**VoxSpend** is a voice-first, AI-native expense tracking Progressive Web App (PWA) designed for speed, privacy, and seamless offline use. Log your daily spending simply by speaking, and let AI handle the categorization and structuring of your data.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Vue](https://img.shields.io/badge/vue-%2335495e.svg?logo=vuedotjs&logoColor=%234FC08D)
![Convex](https://img.shields.io/badge/convex-orange?logo=convex)
![Groq](https://img.shields.io/badge/AI-Groq-brightgreen)

---

## ✨ Features

- **🎙️ Voice-First Logging**: Record your expenses naturally. "Bought coffee for $5 and lunch for $12" is automatically split into multiple entries.
- **🤖 AI-Powered Parsing**: Uses Groq (Whisper/Llama) to accurately extract amounts, categories, and descriptions from your voice notes.
- **📡 Local-First & Offline Ready**: Everything works offline. Expenses are stored in IndexedDB and synced to the cloud when you're back online.
- **📱 PWA Experience**: Installable on iOS and Android with full app-like behavior.
- **📊 Insightful Analytics**: Visualize your spending habits with dynamic charts and category breakdowns.
- **🔔 Smart Notifications**: Get daily reminders and push notifications to stay on top of your budget.
- **💳 MoMo Integration**: Support for Mobile Money tracking (specifically tailored for regional payment systems).
- **🎨 Premium Neumorphic UI**: A modern, sleek, and alive interface designed for accessibility and visual delight.

---

## 🚀 Tech Stack

- **Frontend**: [Vue 3](https://vuejs.org/) (Composition API), [Pinia](https://pinia.vuejs.org/) (State Management), [TypeScript](https://www.typescriptlang.org/).
- **Backend**: [Convex](https://convex.dev/) (Real-time database and serverless functions) for voice transcription and sync.
- **Serverless**: Vercel serverless still powers the feedback endpoint at `/api/feedback`.
- **AI Engine**: [Groq SDK](https://groq.com/) for high-speed transcription and NLP.
- **Storage**: [Dexie.js](https://dexie.org/) for persistent local storage (IndexedDB).
- **Visuals**: [Chart.js](https://www.chartjs.org/) for data visualization.
- **PWA**: [Vite PWA Plugin](https://vite-pwa-org.netlify.app/) for service worker management and offline assets.

---

## 🛠️ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/)
- A [Convex](https://convex.dev/) account
- A [Groq](https://groq.com/) API Key

### Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/enoch-prince/VoxSpend.git
   cd voxspend
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env.local` file in the root and add your keys:

   ```env
   VITE_GROQ_API_KEY=your_groq_key_here
   VITE_CONVEX_URL=your_convex_deployment_url
   GITHUB_TOKEN=your_github_token
   GITHUB_REPO=your_github_repo_slug
   VAPID_PUBLIC_KEY=your_vapid_public_key
   VAPID_PRIVATE_KEY=your_vapid_private_key
   ```

   Notes:
   - `VITE_GROQ_API_KEY` is used for Groq transcription and parsing.
   - `VITE_CONVEX_URL` is required for Convex voice actions and push subscriptions.
   - `GITHUB_TOKEN` and `GITHUB_REPO` are required for feedback issue creation.
   - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` are required for push notifications.

4. **Run the app**:
   ```bash
   npm run dev
   ```

---

## 🏗️ Project Structure

```text
├── api/             # Vercel serverless functions (feedback and legacy voice proxy)
├── convex/          # Backend schema, mutations, and actions
├── public/          # Static assets and PWA icons
├── src/
│   ├── components/  # Reusable UI components
│   ├── stores/      # Pinia state management (expenses, voice, etc.)
│   ├── services/    # API and logic services (Groq, Convex)
│   ├── views/       # Main page components
│   ├── sw.ts        # PWA Service Worker logic
│   └── main.ts      # App entry point
└── vite.config.ts   # Build and PWA configuration
```

---

## 📱 PWA & Offline Support

VoxSpend is built with a **Local-First** philosophy.

- **IndexedDB**: Expenses are first saved locally using Dexie.js.
- **Background Sync**: Recordings captured offline are queued and processed automatically once the connection is restored.
- **Service Worker**: The app is fully cached for lightning-fast loads even without an internet connection.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

Developed with ❤️ by [Enoch Prince](https://github.com/enoch-prince)
