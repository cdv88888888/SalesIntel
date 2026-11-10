import Anthropic from '@anthropic-ai/sdk';
import { runSql } from '../../../lib/readOnlySql';

// Chat assistant: Claude answers questions about the sales data by writing and
// running read-only BigQuery SQL through the `run_sql` tool.

const MODEL = 'claude-opus-5-5';
const MAX_TOOL_TURNS = 10;
const SYSTEM_PROMPT = `You are the data assistant inside "CDV Sales Intelligence", an internal app for an LPG (liquefied petroleum gas) distributor in the Philippines. Answer any question about the company's sales data by querying BigQuery with the run_sql tool.

Data:
- Main table: \`accounts-recieva.SALES.SALES2023\` (despite the name, it holds all years). One row per sales line.
- Known columns include Customer_No_, Customer_Name, Classification, Channel, Area, Item_Description, Quantity, Total_KGS_Sold (kg), Net_Sales_Amount (PHP), Date, Transaction_No_. There may be more.
- If you are unsure of a column name or type, or a question may need another table, first query \`accounts-recieva.SALES.INFORMATION_SCHEMA.COLUMNS\` (or \`accounts-recieva.SALES.INFORMATION_SCHEMA.TABLES\`). Do not guess column names.
- Segments used in the app are groups of Channel values:
  - Dealer: MGSA, MARKETER, DEALER, CODO, DEALER - COBANKIAT, DEALER-EXMARKETER, RETAIL
  - Commercial: COMMERCIAL, commercial, Commercial, PHILGEPS, philgeps
  - Bulk: BULK, bulk, Bulk
- The latest month in the data may be incomplete; say so when it affects an answer.

How to work:
- Only SELECT / WITH queries are allowed. Use fully qualified table names.
- Aggregate in SQL rather than pulling raw rows; return at most ~50 rows unless the user asks for more.
- If a query errors, read the error, fix the SQL and retry.
- Base every number on query results. Never invent figures. If the data cannot answer the question, say what is missing.

Answer format:
- Lead with the answer in one or two sentences, then a Markdown table if there is more than one figure.
- Put units in table headers, e.g. "Volume (kg)" or "Sales (PHP)".
- Round to whole numbers and use thousands separators (1,234,567).
- Keep it short. Briefly note any assumption (date range, segment) you made.`;

const TOOLS = [
  {
    name: 'run_sql',
    description:
      'Run a read-only BigQuery Standard SQL query (SELECT or WITH only) and return the rows as JSON. ' +
      'Results are capped at 200 rows; aggregate in SQL for large data.',
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

// The widget keeps history as [{ role: 'user' | 'model', content: string }].
// Convert it into alternating user/assistant turns starting with a user turn.
function toMessages(history, message) {
  const turns = [];
  for (const h of Array.isArray(history) ? history : []) {
    const text = String(h?.content ?? '').trim();
    if (!text) continue;
    const role = h.role === 'user' ? 'user' : 'assistant';
    if (turns.length === 0 && role !== 'user') continue;
    const last = turns[turns.length - 1];
    if (last && last.role === role) last.content += `\n\n${text}`;
    else turns.push({ role, content: text });
  }
  const userText = String(message ?? '').trim();
  const last = turns[turns.length - 1];
  if (last && last.role === 'user') last.content += `\n\n${userText}`;
  else turns.push({ role: 'user', content: userText });
  return turns;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// A question can take several query rounds; give it time.
export const maxDuration = 300;

export async function POST(req) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ error: 'ANTHROPIC_API_KEY is not set on the server.' }, 503);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }
  if (!String(body?.message ?? '').trim()) {
    return json({ error: 'Message is empty.' }, 400);
  }

  const client = new Anthropic();
  const messages = toMessages(body.history, body.message);

  try {
    for (let turn = 0; turn <= MAX_TOOL_TURNS; turn++) {
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

      if (response.stop_reason === 'refusal') {
        return json({ text: "I can't help with that request." });
      }

      const text = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('\n')
        .trim();

      if (response.stop_reason !== 'tool_use') {
        return json({ text: text || 'No answer was returned. Please rephrase your question.' });
      }

      messages.push({ role: 'assistant', content: response.content });

      const toolUses = response.content.filter(b => b.type === 'tool_use');
      const results = await Promise.all(
        toolUses.map(async b => {
          if (b.name !== 'run_sql') {
            return { type: 'tool_result', tool_use_id: b.id, content: `Unknown tool ${b.name}`, is_error: true };
          }
          console.log('[chat] SQL:', b.input?.query);
          const r = await runSql(b.input?.query);
          return r.error
            ? { type: 'tool_result', tool_use_id: b.id, content: r.error, is_error: true }
            : { type: 'tool_result', tool_use_id: b.id, content: r.json };
        }),
      );
      messages.push({ role: 'user', content: results });
    }

    return json({ text: 'That question needed too many queries. Please try narrowing it down.' });
  } catch (error) {
    console.error('Chat API error:', error);
    if (error instanceof Anthropic.AuthenticationError) {
      return json({ error: 'The Claude API key was rejected. Check ANTHROPIC_API_KEY.' }, 502);
    }
    if (error instanceof Anthropic.RateLimitError) {
      return json({ error: 'Claude is rate-limited right now. Try again in a minute.' }, 429);
    }
    if (error instanceof Anthropic.APIError) {
      return json({ error: `Claude API error (${error.status}): ${error.message}` }, 502);
    }
    return json({ error: error.message || 'Something went wrong.' }, 500);
  }
}
