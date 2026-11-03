# ernestmoyo

Ernest Moyo's CV in your terminal, and an MCP server your agent can ask.

Ernest is an epidemiologist and health data scientist in Dar es Salaam: Bayesian malaria risk mapping (Malaria Atlas Project, Ifakara Health Institute), PhD researcher with the Vector Atlas (registered at NM-AIST), and Co-Founder of 7Square Inc., which builds AI agents for African institutions.

```sh
npx ernestmoyo                    # the CV
npx ernestmoyo --search malaria   # find lines
npx ernestmoyo --json             # JSON Resume v1
npx ernestmoyo --md               # Markdown
```

## As an MCP server

```sh
claude mcp add ernestmoyo -- npx -y ernestmoyo --mcp
```

Tools: `get_profile`, `get_cv` (optional `section`), `search_cv` (`query`).

Data comes live from https://ernestmoyo.com/cv.json, with a bundled snapshot as an offline fallback. Website: https://ernestmoyo.com · Contact: hello@ernestmoyo.com
