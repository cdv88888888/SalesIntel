import { GoogleGenAI } from '@google/genai';
import { getBigQueryClient } from '../../../lib/bigquery';

const systemInstruction = `
You are a highly capable data assistant for an application called "CDV-sales-intelligence".
Your job is to answer the user's questions by querying the BigQuery database and presenting the results.
You have access to a tool called "runBigQuery" that executes a standard SQL query and returns the JSON result.

Schema of the primary table: \`accounts-recieva.SALES.SALES2023\`
Columns:
- Customer_No_ (STRING): The unique ID of the customer/dealer.
- Customer_Name (STRING): The name of the customer/dealer.
- Classification (STRING): e.g., 'A', 'B', 'C'.
- Total_KGS_Sold (FLOAT64): Volume of LPG sold in kilograms.
- Net_Sales_Amount (FLOAT64): Revenue in PHP.
- Date (TIMESTAMP): The date of the transaction.
- Channel (STRING): The sales channel (e.g., 'DEALER', 'COMMERCIAL', 'RETAIL').
- Transaction_No_ (STRING): Unique transaction identifier.

When the user asks a question, write a BigQuery SQL query to find the answer.
Call the runBigQuery tool with the SQL string.
When you receive the result, format it beautifully as a Markdown table (unless it's a single value, then just state the value).
Make sure to explain what the data shows briefly.

IMPORTANT FORMATTING RULES:
1. When returning figures in the table header, ALWAYS indicate what they are, e.g., "(kgs)" or "(Php)".
2. Remove all centavos/decimals from figures (round to nearest whole number).
3. ALWAYS include commas per thousand (e.g., 1,000 instead of 1000).

For example, to get month on month kg sales for a user, you should group by EXTRACT(MONTH from Date).
Limit the number of rows returned by SQL to 50 unless the user specifically asks for more, to prevent massive text blocks.
`;

export async function POST(req) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set in the environment variables. Please add it to your .env file.");
    }
    const ai = new GoogleGenAI({ apiKey: apiKey });
    const { history, message } = await req.json();


    const tools = [{
      functionDeclarations: [
        {
          name: 'runBigQuery',
          description: 'Executes a BigQuery SQL query and returns the results as JSON string.',
          parameters: {
            type: 'OBJECT',
            properties: {
              query: {
                type: 'STRING',
                description: 'The standard SQL query to execute in BigQuery.'
              }
            },
            required: ['query']
          }
        }
      ]
    }];

    // Format history for the SDK, ensuring turn alternation starting with a user turn
    const rawHistory = Array.isArray(history) ? history : [];
    // Drop initial model messages if history starts with model role
    let firstUserIdx = rawHistory.findIndex(h => h.role === 'user');
    const validHistory = firstUserIdx >= 0 ? rawHistory.slice(firstUserIdx) : [];

    const formattedHistory = validHistory.map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: String(h.content || '') }]
    }));

    const chatWithHistory = ai.chats.create({
      model: 'gemini-2.5-flash',
      history: formattedHistory,
      config: {
        systemInstruction: systemInstruction,
        tools: tools,
        temperature: 0.1,
      }
    });

    console.log("Sending message to Gemini...");
    let result = await chatWithHistory.sendMessage({ message: message });

    let finalResponseText = result.text || '';
    
    // Process function call turns in a loop (up to 5 iterations)
    let turns = 0;
    while (result.functionCalls && result.functionCalls.length > 0 && turns < 5) {
       turns++;
       const call = result.functionCalls[0];
       if (call.name === 'runBigQuery') {
          const sqlQuery = call.args.query;
          console.log(`[Turn ${turns}] Gemini generated SQL:`, sqlQuery);
          
          let queryResultJSON = '[]';
          try {
             const bq = getBigQueryClient();
             const [rows] = await bq.query({ query: sqlQuery });
             
             // Sanitize values to prevent BigQuery types (Date objects, BigInt, custom objects) from crashing JSON.stringify
             const sanitizedRows = rows.map(row => {
               const newRow = {};
               for (const key in row) {
                 const val = row[key];
                 if (val === null || val === undefined) {
                   newRow[key] = val;
                 } else if (val instanceof Date) {
                   newRow[key] = val.toISOString();
                 } else if (typeof val === 'object' && val.value !== undefined) {
                   newRow[key] = val.value;
                 } else if (typeof val === 'bigint') {
                   newRow[key] = Number(val);
                 } else {
                   newRow[key] = val;
                 }
               }
               return newRow;
             });
             queryResultJSON = JSON.stringify(sanitizedRows);
          } catch (bqError) {
             console.error('BigQuery execution error:', bqError);
             queryResultJSON = JSON.stringify({ error: bqError.message });
          }

          console.log(`[Turn ${turns}] Sending query results back to Gemini...`);
          result = await chatWithHistory.sendMessage({
            message: [{
              functionResponse: {
                name: 'runBigQuery',
                response: { result: queryResultJSON }
              }
            }]
          });
          
          if (result.text) {
             finalResponseText = result.text;
          }
       } else {
          break;
       }
    }

    if (!finalResponseText && result.text) {
      finalResponseText = result.text;
    }

    if (!finalResponseText) {
      finalResponseText = "No text content was returned by the AI. Please rephrase your query.";
    }

    return new Response(JSON.stringify({ text: finalResponseText }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Chat API Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
