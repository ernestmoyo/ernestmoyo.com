# ernestmoyo.com

Agent-first digital CV of **Ernest Moyo**, epidemiologist, Bayesian malaria modeller and AI builder in Dar es Salaam.

Everything is generated from one file, [`data/cv.json`](data/cv.json) (JSON Resume v1), so the web page, structured data, LLM files, API and CLI can never disagree.

| Surface | For |
| --- | --- |
| `/` | Humans. Static HTML with a schema.org `ProfilePage` / `Person` JSON-LD graph. Press <kbd>`</kbd> to see the agent view. |
| `/llms.txt`, `/llms-full.txt` | LLMs and coding agents |
| `/cv.json`, `/cv.md`, `/cv.txt` | Machines, Markdown readers, terminals |
| `/api/v1/*.json` + `/openapi.json` | Agent tools, ChatGPT Actions |
| `npx ernestmoyo` | Terminal; `--mcp` runs an MCP server |

Hero map: Malaria Atlas Project *Pf*PR<sub>2-10</sub> 2022 surface (CC BY 3.0), sampled to a 0.9° hex grid by `scripts/gen-map.mjs`.

## Update the CV

1. Edit `data/cv.json` (dates as `YYYY-MM`; leave a date out rather than guess). Bump `meta.lastModified`.
2. `node scripts/build.mjs && node scripts/validate.mjs`
3. Commit (including `cli/cv.snapshot.json`) and push. CI validates, then deploys to GitHub Pages.
4. To refresh the npm CLI: bump `cli/package.json` version, then `cd cli && npm publish`.

Preview locally: `npx http-server dist -p 4173`.

## Writing articles

1. Copy `content/articles/_template.md` to `content/articles/<web-address>.md` (for example `malaria-maps-for-ministries.md`).
2. Fill in the front matter (`title`, `date`, `summary`, `tags`) and write the article in Markdown below it.
   - Already published on LinkedIn or elsewhere? Add `url:` and leave the body empty to just link out, or paste the text too.
   - `draft: true` keeps it off the site.
3. Images go in `content/articles/images/` and are referenced as `/articles/images/<file>`.
4. Commit and push. The build adds the article to the home page, `/articles`, `/feed.xml`, `llms.txt` and `/api/v1/articles.json`.
