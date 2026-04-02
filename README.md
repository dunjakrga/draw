# Virtual Paint ✋

Draw in the air using your hand and webcam. Powered by [MediaPipe Hands](https://google.github.io/mediapipe/solutions/hands).

## Live Demo

👉 [Open on GitHub Pages](https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/)

## Gestures

| Gesture | Action |
|---|---|
| ☝ 1 finger (index) | Draw |
| ✌ 2 fingers (index + middle) | Pause / lift pen |
| 🤟 3 fingers (index + middle + ring) | Cycle to next color |

## Features

- Real-time hand skeleton overlay (white, inverted) drawn over the camera feed
- 7 colors + eraser, selectable by gesture or toolbar buttons
- Adjustable brush size
- Clear canvas and save drawing as PNG

## Files

```
index.html   — UI and styles
app.js       — Hand tracking logic and drawing
```

## Run locally

Just open `index.html` in Chrome or Edge (camera requires HTTPS or localhost).

## Deploy to GitHub Pages

1. Create a new GitHub repository
2. Upload `index.html`, `app.js`, and `README.md`
3. Go to **Settings → Pages → Source → main branch → / (root)**
4. Your app will be live at `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

> **Note:** Camera access requires HTTPS. GitHub Pages provides this automatically.
