# Flight Touch ✈️

A high-performance 3D flight experience built for Reddit's Developer Platform (Devvit) and the web.

## 🚀 Overview

**Flight Touch** is an immersive 3D game where players navigate an F-16 through a detailed city environment. Built using **Three.js**, it leverages the power of modern web technologies to deliver a smooth gaming experience directly within Reddit posts or as a standalone web application.

## 🛠 Tech Stack

- **[Three.js](https://threejs.org/)**: Core 3D engine for rendering the aircraft, city, and environment.
- **[Devvit](https://developers.reddit.com/)**: Reddit's developer platform for social integration and deployment.
- **[Hono](https://hono.dev/)**: Lightweight web framework for server-side logic and API routes.
- **[Vite](https://vite.dev/)**: Fast build tool and development server.
- **[TypeScript](https://www.typescriptlang.org/)**: Type-safe development for both client and server.

## 📁 Project Structure

- `src/client/`: The 3D game engine, splash screen, and UI components.
- `src/server/`: Devvit app logic, post creation, and server-side triggers.
- `src/shared/`: Shared types and API definitions.
- `public/assets/`: 3D models (`f16.glb`, `city.glb`) and environmental textures.

## ⚡ Getting Started

### Prerequisites
- Node.js (>= 22.2.0)
- [Devvit CLI](https://developers.reddit.com/docs/quickstart)

### Development
1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Login to Devvit**:
   ```bash
   npm run login
   ```
3. **Start playtesting**:
   ```bash
   npm run dev
   ```

## 🚢 Deployment

### Reddit (Devvit)
To upload a new version to Reddit:
```bash
npm run deploy
```

### Web (Netlify)
The game is automatically deployed to **Netlify** whenever changes are pushed to the `Release` branch via GitHub Actions.

## 🎮 Features
- **Dynamic 3D Environments**: Explore a high-fidelity city model with realistic lighting and textures.
- **Smooth Flight Controls**: Optimized for both touch and mouse interaction.
- **Reddit Integration**: Seamlessly embedded within Reddit posts with custom interactive elements.
