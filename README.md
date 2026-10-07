# Job Application Status Board

Local: `npm install && npm run dev`.

Deploy by importing this repo on Vercel Hobby (build: `npm run build`, output: `dist`).

A calm, shareable board for where each application stands. Visitors get a read-only page. Saving on `/manage` publishes that one application to the shared file.

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
| `/manage` | Add, edit, and delete applications. Each save publishes that one change. |
| `/?embed=1` | Same board with tighter padding for an iframe. |

Production build:

```bash
npm run build
npm run preview
```

## Update what other people see

The shared page reads `public/data/applications.json`. Saving or deleting on `/manage` commits only that application to the file on GitHub. Visitors see it about a minute later, when the new deployment finishes. An edit that can't reach GitHub stays in this browser, under **Local edits not on the shared board**, until you publish that one application or discard it.

**Export JSON**, **Copy JSON**, and **Import** are backups. Import loads a file into this browser only and does not replace the shared file. **Discard local edits** returns to the published file. You can still edit `public/data/applications.json` in a pull request. A Manage save reads the latest file and changes one id, so it does not overwrite the other applications.

Keep `version` at `1`.

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

`vercel.json` sends client routes to `index.html` and leaves `/api` for the save function.

### GitHub Pages

Deploy the contents of `dist/` to the root of a user or organization site (`https://<user>.github.io/`). `404.html` restores paths like `/manage` after a refresh.

For a project site (`https://<user>.github.io/<repo>/`), set `base` in `vite.config.ts` to `/<repo>/` and use that prefix in `404.html` as well. Netlify or Vercel is simpler if you want `/manage` without extra config.

## Shared saving setup

Manage publishes through a serverless function that commits to this repo. It needs a GitHub token on the Vercel project.

1. On GitHub, open **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Limit repository access to **Only select repositories**, and choose **LEED337/job-status-board**.
3. Under **Permissions**, set **Contents** to **Read and write**. Leave every other permission at no access.
4. Generate the token and copy it. GitHub shows it once.
5. On Vercel, open the project, then **Settings → Environment Variables**.
6. Add `GITHUB_TOKEN` and paste the token. Choose the **Production** environment. Save.
7. Redeploy production so the function can see the variable.

`GITHUB_REPO` defaults to `LEED337/job-status-board` and `GITHUB_BRANCH` defaults to `main`. Without `GITHUB_TOKEN`, Manage still stores the edit in this browser and says it was not published. `npm run dev` does not run the function, so local saves stay in the browser too.

## Privacy

Notes are omitted from the share page. They still live in `public/data/applications.json`, which ships with the site. Anyone who opens that file can read them. Do not put secrets, compensation, or private contact details in notes.

`/manage` asks for a password. Someone who knows it can publish one application at a time. They cannot replace the rest of the file from the browser.
