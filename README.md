# Job Application Status Board

Local: `npm install && npm run dev`.

Deploy by importing this repo on Vercel Hobby (build: `npm run build`, output: `dist`).

A calm, shareable board for where each application stands. Visitors get a read-only page. You edit locally, export one JSON file, and redeploy.

Statuses are **Applied**, **Haven't heard back**, **Interviewing** (interview count and next interview), and **Not hired**.

The first load uses sample applications so the page looks finished. Replace them before you share it as your own search.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:4327](http://127.0.0.1:4327).

| URL | What it is |
| --- | --- |
| `/` or `/share` | Public read-only board. No edit controls. Private notes are not shown. |
| `/manage` | Add, edit, and delete applications in this browser, then export JSON. |
| `/?embed=1` | Same board with tighter padding for an iframe. |

Production build:

```bash
npm run build
npm run preview
```

## Update what other people see

Edits on `/manage` stay in this browser (`localStorage`). The shared page always reads `public/data/applications.json`.

1. Open `/manage`.
2. Add or edit applications. Set interview dates so **Interviewing** rows can show a count and a next interview.
3. Click **Export JSON**. That downloads `applications.json`.
4. Replace `public/data/applications.json` with that file.
5. Rebuild and redeploy.

**Copy JSON** does the same thing on the clipboard. **Import** loads a file back into this browser. **Discard local edits** returns to the published file.

You can also edit `public/data/applications.json` by hand. Keep `version` at `1`.

```json
{
  "version": 1,
  "owner": "Lee Denning",
  "updatedAt": "2026-10-07T15:00:00.000Z",
  "applications": [
    {
      "id": "app_example",
      "company": "Example",
      "role": "Product Designer",
      "status": "Interviewing",
      "appliedOn": "2026-10-01",
      "location": "Remote",
      "notes": "Optional. Hidden on the share page, but still inside this public file.",
      "interviews": [
        { "id": "int_example_1", "at": "2026-10-08T10:00", "kind": "Recruiter screen" }
      ]
    }
  ]
}
```

`status` must be one of: `Applied`, `Haven't heard back`, `Interviewing`, `Not hired`.

`appliedOn` is `YYYY-MM-DD`. Interview `at` is `YYYY-MM-DDTHH:MM` with no timezone, so 10:00 displays as 10:00.

## Share it

The site is a static `dist/` folder. Share the deployed URL. Send `/?embed=1` if the board will sit in an iframe.

### Netlify

One command after the build (the CLI will ask you to log in the first time):

```bash
npm run build
npx netlify deploy --dir=dist --prod
```

`public/_redirects` is copied into `dist`, so `/manage` keeps working on refresh.

### Vercel

Import this repo on Vercel Hobby. Build command: `npm run build`. Output directory: `dist`.

```bash
npx vercel --prod
```

`vercel.json` sends client routes to `index.html`.

### GitHub Pages

Deploy the contents of `dist/` to the root of a user or organization site (`https://<user>.github.io/`). `404.html` restores paths like `/manage` after a refresh.

For a project site (`https://<user>.github.io/<repo>/`), set `base` in `vite.config.ts` to `/<repo>/` and use that prefix in `404.html` as well. Netlify or Vercel is simpler if you want `/manage` without extra config.

## Privacy

Notes are omitted from the share page. They still live in `public/data/applications.json`, which ships with the site. Anyone who opens that file can read them. Do not put secrets, compensation, or private contact details in notes.

`/manage` has no login. Someone who opens it can edit a copy in their own browser. They cannot change the shared board unless they can replace the file and redeploy.
