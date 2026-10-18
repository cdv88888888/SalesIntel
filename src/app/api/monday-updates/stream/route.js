import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function getMondayMappings() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'monday-mappings.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Failed to load monday-mappings.json:", err);
  }
  return {};
}

function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '');
}

function getMockStream() {
  const updates = [];
  try {
    const filePath = path.join(process.cwd(), 'data', 'monday-updates.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      const mockDb = JSON.parse(data);
      const mappings = getMondayMappings();

      for (const [dealerId, ups] of Object.entries(mockDb)) {
        const dealerName = mappings[dealerId]?.mondayName || (dealerId === 'default' ? 'System Integration' : `Dealer ${dealerId}`);
        const mondayItemId = mappings[dealerId]?.mondayItemId || '9763751807';
        
        for (const up of ups) {
          updates.push({
            id: up.id,
            itemName: dealerName,
            body: sanitizeHtml(up.body),
            createdAt: up.createdAt,
            creator: {
              name: up.author?.name || 'Unknown User',
              photo_original: up.author?.photo || null
            },
            mondayUrl: `https://masaganagas.monday.com/boards/1244621950/pulses/${mondayItemId}/posts/${up.id}`
          });
        }
      }
    }
  } catch (err) {
    console.error("Failed to load mock stream updates:", err);
  }
  return updates.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function GET() {
  const token = process.env.MONDAY_API_TOKEN;
  const boardsString = process.env.MONDAY_BOARD_ID;

  // If credentials are not configured, fall back to mock data
  const isConfigured = token && 
                      token !== 'ADD_YOUR_MONDAY_API_TOKEN_HERE' && 
                      boardsString && 
                      boardsString !== 'ADD_YOUR_MONDAY_BOARD_ID_HERE';

  if (!isConfigured) {
    console.log("Monday.com credentials not configured, falling back to mock stream");
    const mockUpdates = getMockStream();
    return NextResponse.json({ updates: mockUpdates, source: 'mock' });
  }

  const boardIds = boardsString.split(',').map(id => id.trim()).filter(id => id.length > 0);

  try {
    const updatesResponse = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token,
        "API-Version": "2024-04"
      },
      body: JSON.stringify({
        query: `
          query {
            me {
              account {
                slug
              }
            }
            boards (ids: [${boardIds.join(",")}]) {
              id
              name
              items_page (limit: 50) {
                items {
                  id
                  name
                  updates (limit: 5) {
                    id
                    body
                    created_at
                    creator {
                      name
                      photo_original
                    }
                  }
                }
              }
            }
          }
        `
      })
    });

    const data = await updatesResponse.json();
    if (data.errors) {
      console.error("Monday.com GraphQL stream errors:", data.errors);
      throw new Error("Monday.com GraphQL execution failed");
    }

    const slug = data.data?.me?.account?.slug || 'masaganagas';
    const updates = [];
    const boards = data.data?.boards || [];

    for (const board of boards) {
      const items = board.items_page?.items || [];
      for (const item of items) {
        const itemUpdates = item.updates || [];
        for (const up of itemUpdates) {
          updates.push({
            id: up.id,
            itemName: item.name,
            body: sanitizeHtml(up.body),
            createdAt: up.created_at,
            creator: {
              name: up.creator?.name || 'Unknown User',
              photo_original: up.creator?.photo_original || null
            },
            mondayUrl: `https://${slug}.monday.com/boards/${board.id}/pulses/${item.id}/posts/${up.id}`
          });
        }
      }
    }

    // Sort by date descending
    updates.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return NextResponse.json({ updates, source: 'live' });

  } catch (err) {
    console.error("Live Monday.com stream fetch failed, falling back to mock data:", err);
    const mockUpdates = getMockStream();
    return NextResponse.json({ updates: mockUpdates, source: 'mock_fallback' });
  }
}
