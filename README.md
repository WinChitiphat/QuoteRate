# QuoteRate

QuoteRate is a lightweight website for tracking live `USD/THB` using an OANDA-backed local proxy and a simple converter.

## What it uses

- Plain `HTML`, `CSS`, and `JavaScript`
- A tiny built-in Python server in `server.py`
- OANDA live rates page and stream endpoint for `USD/THB`

## Important note

This version uses OANDA-backed `USD/THB` data fetched server-side by the local Python app. The browser does not call OANDA directly.

## Run locally

From this folder:

```powershell
python server.py
```

Then open:

```text
http://127.0.0.1:8000
```

## Deploy to GitHub Pages

The original static version worked on GitHub Pages, but the OANDA-backed version does not. OANDA rejects cross-origin browser requests from a static host, so this live version needs a backend-capable host.

## Deploy to Render

This repo is now prepared for Render with `render.yaml`.

### Quick steps

1. Sign in to Render.
2. Create a new `Blueprint` or `Web Service` from this GitHub repo.
3. If you use the blueprint flow, Render will read `render.yaml` automatically.
4. Deploy the service.

### Runtime details

- The app binds to `0.0.0.0` and reads Render's `PORT` environment variable.
- Start command: `python server.py`
- Python version is pinned with `.python-version` and `PYTHON_VERSION`.

### Result

After deploy, Render will give you a public `onrender.com` URL where both the site and `/api/usd-thb` are available.

### 1. Create a GitHub repository

Create a new repository on GitHub, for example `QuoteRate`.

### 2. Push this project

From this folder:

```powershell
git init
git add .
git commit -m "Initial QuoteRate site"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/QuoteRate.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your GitHub username.

### Notes

- `server.py` serves both the frontend files and `/api/usd-thb`.
- The frontend polls `/api/usd-thb` every 30 seconds and also refreshes on request.
- Because the data is fetched server-side, deploy this version on a platform that can run Python rather than GitHub Pages.

## Files

- `index.html` for the page structure
- `styles.css` for the visual design
- `script.js` for polling the local quote endpoint and powering the converter
- `server.py` for serving the site and decoding OANDA’s live `USD/THB` stream
- `render.yaml` for Render deployment
