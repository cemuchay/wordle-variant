# 🧩 Wordle Variant

A high-performance, feature rich Wordle clone built with **React**, **TypeScript**, **Tailwind CSS**, and **Supabase**. This version goes beyond the classic game by introducing dynamic word lengths, real time social features, and a competitive challenge mode.

## 🚀 Key Features

### 🎮 Gameplay & Mechanics

- **Dynamic Word Lengths:** Play with words ranging from 3 to 7 letters.
- **Fair Play Algorithm:** Starting May 2026, all games provide 6 attempts regardless of length to ensure a balanced experience.
- **Smart Hint System:** Stuck? Unlock a hint after 3 attempts that reveals a correctly placed letter.
- **Interactive Feedback:** Smooth CSS animations including letter by letter reveals, "pop" effects on entry, and "shake" animations for invalid words.

### 🌐 Social & Real-time

- **Global Chat Room:** A 24 hour persistent chat room for all players.
- **Real-time Voice Chat:** Join global or challenge specific voice rooms powered by **Agora** and Supabase Realtime.
- **Live Presence:** See who's online and who's currently in a voice call via the **Dynamic Island** status bar.
- **Challenge Mode:** Create custom challenges or join live lobbies. Compete in real time with others on the same target word.

### 📱 Advanced Integration

- **Cloud Sync:** Play across devices. Your stats, streaks, and current game state are automatically synced to your Supabase account.
- **Dynamic Island UI:** A modern, non-intrusive status bar that tracks active calls, online users, and system notifications.

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Styling:** Tailwind CSS 4.0, Framer Motion
- **Backend/BaaS:** Supabase (Auth, Database, Realtime, Edge Functions)
- **Audio:** Agora RTC SDK
- **State Management:** React Reducers & Context API
- **Deployment:** Vercel & Render

## 📦 Getting Started

### Prerequisites

- Node.js (Latest LTS)
- Supabase Account
- Agora Account (for voice features)

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/cemuchay/wordle-variant.git
   ```
2. Install dependencies
   ```bash
   npm install
   ```
3. Set up environment variables (`.env`)
   ```env
   VITE_SUPABASE_URL=your_url
   VITE_SUPABASE_ANON_KEY=your_key
   VITE_AGORA_APP_ID=your_agora_id
   ```
4. Run the development server
   ```bash
   npm run dev
   ```

## 📈 Evolution of the Project

What started as a simple Wordle clone has evolved into a full scale social gaming platform. Significant milestones include:

- **Phase 1:** Core engine and daily word logic.
- **Phase 2:** Supabase integration for stats and authentication.
- **Phase 3:** Challenge mode and real-time multiplayer lobbies.
- **Phase 4:** Voice chat integration and "Dynamic Island" UI.
- **Phase 5 (Current):** Enhanced animations, performance optimizations, and global social rooms.

## 📄 License

Feel free to modify.
