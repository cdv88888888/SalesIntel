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

    // Format history for the SDK
    const formattedHistory = (history || []).map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.content }]
    }));

    // We can't set history directly on the object easily in some versions, 
    // but the new SDK supports it in create() via `history` property.
    // If not, we'll just prepend the history to the prompt if needed, 
    // but let's try the standard history param.
    // Actually, the new SDK expects `history` in the create options.
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

    let finalResponseText = result.text;
    
    // Check if the model decided to call a function
    if (result.functionCalls && result.functionCalls.length > 0) {
       const call = result.functionCalls[0];
       if (call.name === 'runBigQuery') {
          const sqlQuery = call.args.query;
          console.log('Gemini generated SQL:', sqlQuery);
          
          let queryResultJSON = '[]';
          try {
             const bq = getBigQueryClient();
             const [rows] = await bq.query({ query: sqlQuery });
             // Sanitize values to prevent BigQuery types (like BigQuery Date objects) from crashing JSON.stringify
             const sanitizedRows = rows.map(row => {
               const newRow = {};
               for (const key in row) {
                 if (row[key] && typeof row[key].value === 'string') {
                    newRow[key] = row[key].value;
                 } else {
                    newRow[key] = row[key];
                 }
               }
               return newRow;
             });
             queryResultJSON = JSON.stringify(sanitizedRows);
          } catch (bqError) {
             console.error('BigQuery execution error:', bqError);
             queryResultJSON = JSON.stringify({ error: bqError.message });
          }

          console.log("Sending query results back to Gemini...");
          // Send the result back to the model
          const toolResult = await chatWithHistory.sendMessage({
            message: [{
              functionResponse: {
                name: 'runBigQuery',
                response: { result: queryResultJSON }
              }
            }]
          });
          
          finalResponseText = toolResult.text;
       }
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
