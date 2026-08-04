# Liv Café & Bistro — Website

Marketing site for Liv Café & Bistro (713 St. Patrick Street, Victoria, BC). Built with [Astro](https://astro.build) and [Tailwind CSS](https://tailwindcss.com), deployed as a static site to GitHub Pages.

## Requirements

- Node.js 22.12.0 or newer

## Local development

```sh
npm install
npm run dev
```

The site runs at `http://localhost:4321/liv-cafe-website/` (the `/liv-cafe-website/` path prefix matches production — see **Deployment** below).

| Command           | Action                                       |
| :----------------- | :-------------------------------------------- |
| `npm install`       | Install dependencies                          |
| `npm run dev`        | Start the local dev server                    |
| `npm run build`       | Build the production site to `./dist/`        |
| `npm run preview`      | Preview the production build locally          |

## Project structure

```text
/
├── public/
│   ├── favicon.png
│   └── menus/           # Downloadable menu & catering PDFs
├── src/
│   ├── assets/           # Images, optimized automatically by Astro at build time
│   ├── layouts/
│   │   └── Layout.astro   # Shared nav, footer, and <head> for every page
│   └── pages/            # One file per route (about.astro -> /about, etc.)
└── astro.config.mjs      # Site URL, base path, integrations
```

## Updating the menus

Menu PDFs live in `public/menus/`. To update or add one:

1. Drop the new PDF into `public/menus/`.
2. Link to it from `src/pages/menu.astro` (or `catering.astro` for the catering menu) using `${import.meta.env.BASE_URL}/menus/your-file.pdf` — this keeps the link working whether the site is served from a subpath or a custom domain.
3. Prefer PDFs over Word docs for anything public — Word files can carry hidden author/edit-history metadata.

## Reservation form

The reservation form on `/contact` submits directly to [Web3Forms](https://web3forms.com) (no backend of our own). The access key in `contact.astro` is meant to be public — it only routes submissions to an inbox, it isn't a secret. To change which inbox receives reservations, generate a new access key at web3forms.com under the desired email and swap it in.

## Analytics

Visitor stats use [Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/) — free, and it sets no cookies, so the site needs no cookie consent banner.

This is already configured — the token lives in `CLOUDFLARE_ANALYTICS_TOKEN` at the top of `src/layouts/Layout.astro`. It's a public identifier, not a secret; it appears in the page source of every site that uses it.

To point it at a different site or account: in the Cloudflare dashboard go to **Web Analytics → Add a site**, enter the hostname, and copy the token out of the snippet it gives you into that same constant. Cloudflare only records traffic for hostnames registered there, so when the custom domain goes live it needs adding alongside the current one.

While that value is empty, no analytics script is added to the site at all. It also only loads in the production build, so local development never shows up in the numbers.

Worth knowing: `/thank-you` is only reachable after a successful reservation submission, so its page-view count doubles as a count of reservation requests.

## Deployment

Deployment is automatic: pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the site and publishes it to GitHub Pages.

`astro.config.mjs` currently has `site` and `base` set for GitHub's default project-page URL (`https://jacobsmit.github.io/liv-cafe-website`). **If the site moves to a custom domain**, update both of those, add a `public/CNAME` file containing the new domain, and point DNS at GitHub Pages — every internal link in the site is built from `import.meta.env.BASE_URL`, so once those two config values are correct, no page needs to be touched individually.
