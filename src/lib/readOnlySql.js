// Read-only BigQuery access for the AI features: one SELECT/WITH statement,
// capped in rows, output size and bytes scanned. Server-only.
import { getBigQueryClient } from './bigquery';

const MAX_ROWS_TO_MODEL = 200;
const MAX_RESULT_CHARS = 60000;
// Hard cap on bytes a single query may scan (10 GB), so a runaway query cannot
// run up a BigQuery bill.
const MAX_BYTES_BILLED = String(10 * 1024 ** 3);

function toPlain(val) {
  if (val === null || val === undefined) return val;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'bigint') return Number(val);
  if (Buffer.isBuffer(val)) return val.toString('base64');
  if (Array.isArray(val)) return val.map(toPlain);
  if (typeof val === 'object') {
    if (val.value !== undefined && Object.keys(val).length === 1) return val.value;
    const out = {};
    for (const k in val) out[k] = toPlain(val[k]);
    return out;
  }
  return val;
}

function isReadOnly(sql) {
  const stripped = sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim()
    .replace(/^\(+\s*/, '');
  if (!/^(select|with)\b/i.test(stripped)) return false;
  // Reject multi-statement scripts and DML/DDL anywhere in the text.
  if (/;\s*\S/.test(stripped)) return false;
  return !/\b(insert|update|delete|merge|create|drop|alter|truncate|grant|revoke|call|execute|declare|set)\s/i.test(
    stripped.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`[^`]*`/g, "''"),
  );
}

export async function runSql(query) {
  if (typeof query !== 'string' || !isReadOnly(query)) {
    return { error: 'Only a single read-only SELECT or WITH query is allowed.' };
  }
  try {
    const [rows] = await getBigQueryClient().query({
      query,
      maximumBytesBilled: MAX_BYTES_BILLED,
      jobTimeoutMs: 60000,
    });
    const plain = rows.slice(0, MAX_ROWS_TO_MODEL).map(toPlain);
    let json = JSON.stringify({
      total_rows: rows.length,
      returned_rows: plain.length,
      truncated: rows.length > plain.length,
      rows: plain,
    });
    if (json.length > MAX_RESULT_CHARS) {
      json = json.slice(0, MAX_RESULT_CHARS) + '... [output cut; aggregate further or select fewer columns]';
    }
    return { json };
  } catch (err) {
    return { error: err.message };
  }
}
