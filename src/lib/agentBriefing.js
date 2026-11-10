// The investigating agent. One Claude agent per batch of accounts: it is given
// the batch's figures, queries the sales data itself to work out what is
// behind each decline, and writes a briefing for the person who owns the
// batch. Server-only.
import Anthropic from '@anthropic-ai/sdk';
import { getAdminDb, withTimeout } from './firebase-admin';
import { getVolumeWatch } from './bigquery';
import { runSql } from './readOnlySql';
import { assessAccount, asIsoDate } from './declineAlerts';
import { segmentLabel } from './segments';

// Mid-tier model: enough judgement to investigate, well below the top-tier
// price. Change this one line to trade cost against depth.
const MODEL = 'claude-sonnet-5-5';
const MAX_QUERY_ROUNDS = 12;
const COLLECTION = 'alert_briefings';
// Bump when the briefing format changes, so stored briefings in the old
// format are rewritten on the next run instead of being reused.
const FORMAT_VERSION = 2;

const SYSTEM_PROMPT = `You are a volume-watch agent inside "CDV Sales Intelligence", an internal app for an LPG (cooking gas) distributor in the Philippines. You look after one batch of customer accounts in one sales channel. Your single job is volume decline: find which accounts in your batch are really losing volume, work out what changed in how they buy, and tell the person who owns the batch who to call first and what to ask.

You are given a roster of your batch with figures already measured: each account's normal pace and recent pace (both in kg per 30 days), the change, its usual days between orders, days since its last order, and whether a fixed rule flagged it. The rule flags an account running 20% or more below its own earlier pace, or clearly overdue to order.

Investigate with the run_sql tool before you write. The rule only measures; you explain.

Data:
- Table: \`accounts-recieva.SALES.SALES2023\` (it holds all years). One row per sales line.
- Columns you can rely on: Customer_No_ (the account id in your roster, a string), Customer_Name, Channel, Item_Description (product; names the cylinder size), Quantity, Total_KGS_Sold (kg), Net_Sales_Amount (PHP), Date, Transaction_No_ (one delivery).
- For a bulk line Quantity is kilograms; for a cylinder line it is a cylinder count.
- The newest month is incomplete. Never treat a low newest month as a drop on its own; compare like-for-like day ranges instead.

How to investigate:
- Only SELECT / WITH. Aggregate in SQL. Query several accounts at once with Customer_No_ IN (...) rather than one account per query. You have at most ${MAX_QUERY_ROUNDS} rounds of queries, so plan them.
- For flagged accounts, find what changed: fewer deliveries, smaller deliveries, one product stopped while others continue, a shift to smaller cylinders, a complete stop, or a baseline inflated by one unusually large order (which makes the "decline" not real).
- Also scan the accounts the rule did NOT flag for a decline it would miss, for example volume sliding month after month but not yet 20% down.
- Look for something shared: several accounts dropping the same product, or starting to drop in the same week.

Rules for what you write:
- Every number must come from the roster or your query results. Never invent figures.
- You have no CRM notes and no competitor or pricing intelligence. Do not state an outside cause (a competitor, a price change, a closure) as fact; you may name it as something to ask the customer.
- Rank by kilograms at stake, not by percentage.

Write the briefing in Markdown for a busy sales manager who will skim it. It is an action list, not a report: no narration of what you checked, no month-by-month history. At most 120 words in total. Use exactly these sections, and leave out any that would be empty:

## Action plan
A numbered list of at most five accounts, most kilograms at stake first. Each item is one line of at most 22 words in this shape:
**Account name** — the action to take or question to ask. *(kg per 30 days at stake; the one change that matters, e.g. "deliveries 6 → 3 a month")*
Start the action with a verb: Call, Visit, Ask, Confirm.

## Watch
At most three bullets: accounts the rule did not flag that are sliding. Name, then one short clause with one number.

## Ignore
One line: the flagged accounts whose decline is not real, as a comma-separated list, then the shared reason in a few words.

Use short account names (drop suffixes like "(DEALER)" and "LPG TRADING" when the name stays unambiguous). Round every figure. One number per clause.

If nothing in the batch is declining, say so in one sentence instead.`;

const TOOLS = [
  {
    name: 'run_sql',
    description:
      'Run a read-only BigQuery Standard SQL query (SELECT or WITH only) and return the rows as JSON. ' +
      'Results are capped at 200 rows; aggregate in SQL.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'BigQuery Standard SQL. SELECT or WITH only.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    strict: true,
  },
];

export async function getStoredBriefings() {
  try {
    const snap = await withTimeout(getAdminDb().collection(COLLECTION).get());
    const out = {};
    snap.forEach(doc => {
      const data = doc.data();
      if (data?.agentKey) out[data.agentKey] = data;
    });
    return out;
  } catch (err) {
    console.error('[alerts] Could not read briefings:', err.message);
    return {};
  }
}

const round = (n) => Math.round(Number(n) || 0);

// The batch as the agent sees it: one compact line per account.
function buildRoster(accounts) {
  return accounts.map(a => ({
    id: a.id,
    name: a.name,
    normalKgPer30d: round(a.base30),
    recentKgPer30d: round(a.recent30),
    changePct: a.change == null ? null : Math.round(a.change * 100),
    usualDaysBetweenOrders: a.cycleDays,
    daysSinceLastOrder: a.daysSinceLast,
    flagged: a.alert ? a.alert.reasons : null,
  }));
}

// Run one agent over its batch and store the briefing. Returns the stored
// record; `cached: true` when a briefing already exists for the current data.
export async function runAgentBriefing(agentKey, { force = false } = {}) {
  const rows = await getVolumeWatch();
  const accounts = rows
    .map(assessAccount)
    .filter(a => `${a.segment}-${a.batch}` === agentKey);
  if (accounts.length === 0) {
    const err = new Error('That agent has no accounts.');
    err.status = 404;
    throw err;
  }
  const dataThrough = asIsoDate(rows[0].dataThrough);

  if (!force) {
    const existing = (await getStoredBriefings())[agentKey];
    if (existing && existing.dataThrough === dataThrough && existing.version === FORMAT_VERSION) {
      return { briefing: existing, cached: true };
    }
  }

  const { segment, batch } = accounts[0];
  const task =
    `You are ${segmentLabel(segment)} Agent ${batch}. Sales data runs through ${dataThrough}. ` +
    `Your batch has ${accounts.length} accounts, ${accounts.filter(a => a.alert).length} flagged by the rule.\n\n` +
    `Roster:\n${JSON.stringify(buildRoster(accounts))}`;

  const client = new Anthropic();
  const messages = [{ role: 'user', content: task }];
  const usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };
  let queries = 0;
  let text = '';

  for (let round_ = 0; round_ <= MAX_QUERY_ROUNDS; round_++) {
    const response = await client.beta.messages
      .stream({
        model: MODEL,
        max_tokens: 32000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium' },
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        tools: TOOLS,
        messages,
      })
      .finalMessage();

    usage.inputTokens += response.usage?.input_tokens || 0;
    usage.outputTokens += response.usage?.output_tokens || 0;
    usage.cacheReadTokens += response.usage?.cache_read_input_tokens || 0;

    if (response.stop_reason === 'refusal') {
      throw new Error('The model declined to analyse this batch.');
    }

    text = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    if (response.stop_reason !== 'tool_use') break;

    messages.push({ role: 'assistant', content: response.content });
    const toolUses = response.content.filter(b => b.type === 'tool_use');
    const lastRound = round_ === MAX_QUERY_ROUNDS - 1;
    const results = await Promise.all(
      toolUses.map(async b => {
        if (b.name !== 'run_sql') {
          return { type: 'tool_result', tool_use_id: b.id, content: `Unknown tool ${b.name}`, is_error: true };
        }
        queries += 1;
        const r = await runSql(b.input?.query);
        return r.error
          ? { type: 'tool_result', tool_use_id: b.id, content: r.error, is_error: true }
          : { type: 'tool_result', tool_use_id: b.id, content: r.json };
      }),
    );
    if (lastRound) {
      results.push({ type: 'text', text: 'That was your last round of queries. Write the briefing now from what you have.' });
    }
    messages.push({ role: 'user', content: results });
    text = '';
  }

  if (!text) throw new Error('The agent did not produce a briefing.');

  const briefing = {
    agentKey,
    version: FORMAT_VERSION,
    text,
    dataThrough,
    model: MODEL,
    createdAt: new Date().toISOString(),
    queries,
    usage,
  };
  try {
    await withTimeout(getAdminDb().collection(COLLECTION).doc(agentKey).set(briefing));
  } catch (err) {
    console.error('[alerts] Could not store briefing:', err.message);
  }
  return { briefing, cached: false };
}

// Turn a failure from runAgentBriefing into { status, error } for a route.
export function briefingError(error) {
  if (error instanceof Anthropic.AuthenticationError) {
    return { status: 502, error: 'The Claude API key was rejected. Check ANTHROPIC_API_KEY.' };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return { status: 429, error: 'Claude is rate-limited right now. Try again in a minute.' };
  }
  if (error instanceof Anthropic.APIError) {
    return { status: 502, error: `Claude API error (${error.status}): ${error.message}` };
  }
  return { status: error.status || 500, error: error.message || 'Something went wrong.' };
}
