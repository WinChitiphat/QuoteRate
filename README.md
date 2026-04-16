# QuoteRate

QuoteRate is a static website that shows the latest free exchange rates and includes a simple currency converter.

## What it uses

- Plain `HTML`, `CSS`, and `JavaScript`
- [Frankfurter](https://www.frankfurter.app/docs/) for free exchange-rate data with no API key

## Important note

This project uses a free public API. That means the rates are the latest reference rates made available by the provider, not broker-grade tick-by-tick forex prices.

## Run locally

From this folder:

```powershell
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Deploy to GitHub Pages

This project is ready for GitHub Pages because it is a fully static site.

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

### 3. Enable GitHub Pages

On GitHub:

1. Open the repository.
2. Go to `Settings`.
3. Open `Pages`.
4. Under `Build and deployment`, choose:
   - `Source`: `Deploy from a branch`
   - `Branch`: `main`
   - `Folder`: `/ (root)`
5. Save.

### 4. Open the live site

For a project repository named `QuoteRate`, the URL will usually be:

```text
https://YOUR-USERNAME.github.io/QuoteRate/
```

### Notes

- The `.nojekyll` file is included so GitHub Pages serves the site exactly as a plain static project.
- Because this app uses a browser request to Frankfurter, GitHub Pages does not need any server-side code.
- GitHub Pages deployment can take a minute or two after you push or update settings.

## Files

- `index.html` for the page structure
- `styles.css` for the visual design
- `script.js` for fetching rates and powering the converter
