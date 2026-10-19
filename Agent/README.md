# ENOVA Assistant agent

The agent behind the ENOVA Assistant panel. It is a LangGraph.js graph that turns a person's message into answers
and **prepared actions** (drafts) using the HRMS's tools, and pauses until the person confirms. It has no database
or HR access of its own: every tool call goes back to the backend, as the person, with a short-lived delegated token.

```
 browser ── /api/assistant/messages ──▶ backend ──(shared secret)──▶ gateway :8090 ──▶ agent
                                          ▲                                             │
                                          └── /api/assistant/tools/* ◀── gateway :8443 ◀┘── /groq ──▶ api.groq.com
                                              (delegated JWT, 10 min)                     /langsmith ─▶ LangSmith
```

## How a turn runs

`guard → route → compact → agent ⇄ tools → gate`

| Node | What it does |
|---|---|
| guard | Llama Prompt Guard 2 scores the message; at ≥ 0.9 the turn is **read-only** (no prepare tools). |
| route | A small model picks the skills (leave, calendar, time, inbox, insight) the turn needs; falls back to keywords plus the current page. Only those tools are offered (progressive disclosure). |
| compact | When the conversation passes ~24 000 characters, older turns are summarised; the last 8 messages stay verbatim. |
| agent | The main model, with a layered system prompt (rules, person, company time and a 15-day calendar, page, skills). At most 7 model calls per turn; the last one gets no tools. |
| tools | Calls the backend tool API. Results are cut to 5 000 characters and are treated as data, not instructions. |
| gate | If drafts were prepared, the graph **interrupts**. The backend resumes it with the person's decision (`confirmed`, `failed`, `cancelled`), or with `superseded` when they send a new message instead. |

Tools are declared once in the backend (`Backend/services/assistant/registry.js`) with a skill, an effect
(`read` or `prepare`), the roles allowed and a zod schema; the agent fetches the manifest for the person's role.
Prepare tools create an `AssistantDraft`; only `POST /api/assistant/drafts/:id/confirm`, called by the person,
runs the real route handler (`services/assistant/drafts.js`). Decisions on someone else's request are prepared only
for its designated reviewer.

Models (Groq): router `openai/gpt-oss-20b`; main chain `openai/gpt-oss-120b` → `qwen/qwen3.8-27b` on rate limit
(waits up to 12 s for a retry before falling back); guard `meta-llama/llama-prompt-guard-2-86m`. Override with
`AGENT_MAIN_MODELS`, `AGENT_ROUTER_MODEL`, `AGENT_GUARD_MODEL`.

Conversation state is checkpointed in MongoDB (`enova_agent`, separate from the HR database). Per-run secrets (the
delegated token) live only in memory for the duration of the run, never in checkpoints.

## Running it

### Locally (development)
```bash
cp .env.example .env        # GROQ_API_KEY, AGENT_SHARED_SECRET (same value as Backend/.env)
npm install
npm run dev                 # http://localhost:8090
```
`Backend/.env` needs `AGENT_URL=http://localhost:8090` and the same `AGENT_SHARED_SECRET`. Without `AGENT_URL`
the assistant panel falls back to handbook-only answers.

### Isolated in Docker (recommended)
```bash
docker compose up -d --build     # from the repository root; reads Agent/.env
```
The agent runs on an internal network with **no internet access**, a read-only filesystem, no Linux capabilities,
and memory/CPU limits. Its only way out is the gateway, which allows exactly three destinations: Groq, the backend's
`/api/assistant/*` routes, and LangSmith. Everything else gets 403, and each request is logged as one JSON line
(`docker compose logs gateway`). The backend (your normal `npm start` on port 8081) reaches the agent at
`http://localhost:8090`.

### Sandbox and evaluation
`docker-compose.sandbox.yml` starts a complete throwaway copy: an in-memory MongoDB seeded with the demo company, the
backend, the gateway and the agent. Actions are carried out for real there and checked in the database.
```bash
docker compose -f docker-compose.sandbox.yml --env-file Agent/.env up -d --build --wait
docker compose -f docker-compose.sandbox.yml --env-file Agent/.env run --rm eval
docker compose -f docker-compose.sandbox.yml down
```
The sandbox backend is on http://localhost:18081 (demo accounts `employee@`, `manager@`, `hr@`, `ceo@enova.test`,
password `Enova@2026`). The eval (`eval/tasks.js`) covers answers from data and the handbook, French, bookings,
meetings, leave requests and cancellations, reviewer-only decisions, corrections, messages, a clarification turn and
a prompt injection. Reports go to `eval/reports/`. Options: `EVAL_ONLY=balance,meeting`, `EVAL_LABEL=name`,
`EVAL_PAUSE_MS=20000` (pause between tasks for the rate limit), and model overrides such as
`AGENT_MAIN_MODELS=qwen/qwen3.8-27b`. The eval refuses to run unless its database URI names the sandbox.

#### Results (19 October 2026, Groq free tier)
| Run | Passed | Median / p90 turn | Tokens (15 tasks) | Model fallbacks |
|---|---|---|---|---|
| gpt-oss-120b → qwen3.8-27b, 20 s pauses | 9/15 | 3.9 s / 21.7 s | 89 600 | 13 |
| same, after fixing routing and handbook warm-up, 30 s pauses | **14/15** | 3.4 s / 19.0 s | 124 800 | 10 |
| qwen3.8-27b alone, 30 s pauses | 6/15 | 1.9 s / 12.1 s | 71 600 | 10 |

The one remaining failure, and most of the Qwen-alone failures, are **rate limits**, not wrong behaviour: a turn uses
4 000–18 000 tokens (system prompt and tool schemas are re-sent on every model call), while the free tier allows
8 000 tokens per minute per model. Real use by more than one person at a time needs Groq's paid Developer tier (same
models, much higher limits, pay per token).

### Tracing (LangSmith)
Set `LANGSMITH_TRACING=true` and `LANGSMITH_API_KEY` in `.env`. In normal use inputs and outputs are hidden
(`LANGSMITH_HIDE_INPUTS/OUTPUTS=true`), so traces show the graph, timings, tools and tokens but not what people wrote.
The sandbox shows them, since its data is fake.

### Tests
```bash
npm test            # harness tests with scripted models and a fake tool API (no network)
```
Backend tests for the tool registry and delegation are in `Backend/tests/assistant.test.js`.

## Observability in the app
Each turn posts a metadata-only summary to the backend (`AssistantRun`: page, skills, models, tools and timings,
drafts, steps, fallbacks, tokens, latency, outcome, guard, feedback; deleted after 90 days). HR and the CEO can read
totals at `GET /api/assistant/stats`.
