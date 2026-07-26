import { BigQuery } from '@google-cloud/bigquery';
import { NextResponse } from 'next/server';
import path from 'path';

export async function GET() {
  try {
    // Initialize BigQuery client with the downloaded credentials
    const bq = new BigQuery({
      keyFilename: path.join(process.cwd(), 'bq-credentials.json'),
    });

    // Query to aggregate dealer data: total KGS sold, total net sales, and get the latest transaction date
    // We filter out null Customer_No_ to ensure clean data
    const query = `
      SELECT 
        Customer_No_ as id, 
        MAX(Customer_Name) as name, 
        MAX(Location) as location,
        MAX(Classification) as classification,
        SUM(Total_KGS_Sold) as kgsSold,
        SUM(Net_Sales_Amount) as netSales,
        MAX(Date) as lastOrderDate,
        COUNT(Transaction_No_) as transactionCount
      FROM \`accounts-recieva.SALES.SALES2023\`
      WHERE Customer_No_ IS NOT NULL
      GROUP BY Customer_No_
      ORDER BY kgsSold DESC
      LIMIT 100
    `;

    const options = {
      query: query,
      location: 'US', // default location
    };

    const [rows] = await bq.query(options);

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("BigQuery API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
