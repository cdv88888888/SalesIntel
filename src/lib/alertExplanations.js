// AI explanations for volume alerts: why an account is likely declining and
// what to do next. One short Claude call per flagged account, written from the
// account's own order history and stored in Firestore so it is paid for once
// per data refresh, not once per page view. Server-only.
import Anthropic from '@anthropic-ai/sdk';
import { getAdminDb, withTimeout } from './firebase-admin';
import { asIsoDate } from './declineAlerts';

// The low-cost model: this is a short summary over a few dozen numbers.
const MODEL = 'claude-haiku-5-5';
const COLLECTION = 'alert_explanations';

const SYSTEM_PROMPT = `You explain volume-decline warnings inside a sales app for an LPG (cooking gas) distributor in the Philippines. The reader is a salesperson deciding whether to call the account.

You are given one account's figures: its normal and recent pace, its ordering cycle, kilograms and delivery days per month per product for about seven months, and each delivery day in the last 120 days.

Work out what changed in how the account buys. Typical patterns: it orders less often, each delivery is smaller, one product stopped while others continue, it shifted to a smaller cylinder size, it stopped completely, or the drop is a one-off after an unusually large earlier month.

Rules:
- Use only the figures given. You have no CRM notes, prices or competitor information, so do not state an outside cause (a competitor, pricing, a closure) as fact. You may name one as something to ask about.
- The newest month is usually incomplete; do not read a low newest month as a drop on its own.
- If the figures show the decline is probably not real (for example the baseline held one unusually large order), say so plainly.
- Quote at most two or three numbers, rounded, in kg.

Reply in exactly this form, plain text, no Markdown, under 70 words in total:
Likely cause: <one or two sentences on what changed in the ordering pattern>
Next step: <one sentence: the single most useful thing the salesperson should do or ask>`;

const docId = (accountId) => encodeURIComponent(String(accountId));

// Every stored explanation, keyed by account id. Returns {} when Firestore is
// unreachable so the Alerts page still renders.
export async function getStoredExplanations() {
  try {
    const snap = await withTimeout(getAdminDb().collection(COLLECTION).get());
    const out = {};
    snap.forEach(doc => {
      const data = doc.data();
      if (data?.accountId) out[data.accountId] = data;
    });
    return out;
  } catch (err) {
    console.error('[alerts] Could not read stored explanations:', err.message);
    return {};
  }
}

async function saveExplanation(record) {
  try {
    await withTimeout(getAdminDb().collection(COLLECTION).doc(docId(record.accountId)).set(record));
  } catch (err) {
    // Not fatal: the explanation is still returned, it just is not remembered.
    console.error('[alerts] Could not store explanation:', err.message);
  }
}

const round = (n) => Math.round(Number(n) || 0);

// The compact fact sheet sent to the model.
function buildFacts(account, detail) {
  const months = {};
  for (const row of detail.monthly) {
    (months[row.month] ||= []).push({
      product: row.item,
      kg: round(row.kgs),
      deliveryDays: round(row.deliveryDays),
    });
  }
  return {
    account: account.name,
    channel: account.channel,
    warnings: account.alert.reasons,
    normalKgPer30Days: round(account.base30),
    recentKgPer30Days: round(account.recent30),
    recentWindowDays: account.windowDays,
    usualDaysBetweenOrders: account.cycleDays,
    lastOrderDate: account.lastOrderDate,
    daysSinceLastOrder: account.daysSinceLast,
    salesDataThrough: account.dataThrough,
    byMonthAndProduct: months,
    deliveriesLast120Days: detail.deliveries.map(d => `${asIsoDate(d.orderDate)}: ${round(d.kgs)} kg`),
  };
}

// Ask Claude for the explanation and store it. Throws on API failure; the
// route turns that into a readable error.
export async function explainAccount(account, detail) {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: 'low' },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(buildFacts(account, detail)) }],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('The model declined to explain this account.');
  }
  const text = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim();
  if (!text) throw new Error('The model returned no explanation.');

  const record = {
    accountId: account.id,
    text,
    dataThrough: account.dataThrough,
    model: MODEL,
    createdAt: new Date().toISOString(),
  };
  await saveExplanation(record);
  return record;
}
