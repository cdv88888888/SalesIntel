import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifySession } from '@/lib/session';

// Helper to load settings mappings
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

function getSafeUrl(url) {
  if (!url || typeof url !== 'string') return '#';
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
  } catch (e) {}
  return '#';
}

// Helper to load mock updates
function getMockUpdates(dealerId) {
  try {
    const filePath = path.join(process.cwd(), 'data', 'monday-updates.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      const mockDb = JSON.parse(data);
      const updates = mockDb[dealerId] || mockDb['default'] || [];
      return updates.map(up => ({
        ...up,
        body: sanitizeHtml(up.body),
        attachments: (up.attachments || []).map(a => ({ ...a, url: getSafeUrl(a.url) }))
      }));
    }
  } catch (err) {
    console.error("Failed to load mock updates:", err);
  }
  return [];
}

// Helper to add mondayUrl to formatted updates (useful for both live and mock updates)
function addMondayUrlToUpdates(updates, dealerId, liveSlug, liveBoardId, liveItemId) {
  const mappings = getMondayMappings();
  const resolvedItemId = liveItemId || mappings[dealerId]?.mondayItemId || '9763751807';
  const resolvedBoardId = liveBoardId || (process.env.MONDAY_BOARD_ID || '').split(',')[0].trim() || '1244621950';
  const resolvedSlug = liveSlug || 'masaganagas';

  return updates.map(up => ({
    ...up,
    mondayUrl: `https://${resolvedSlug}.monday.com/boards/${resolvedBoardId}/pulses/${resolvedItemId}/posts/${up.id}`
  }));
}

export async function GET(request) {
  const cookieToken = request.cookies.get('__session')?.value;
  const session = await verifySession(cookieToken);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dealerId = searchParams.get('dealerId');
  const dealerName = searchParams.get('dealerName') || '';

  if (!dealerId) {
    return NextResponse.json({ error: 'Missing dealerId parameter' }, { status: 400 });
  }

  const token = process.env.MONDAY_API_TOKEN;
  const boardsString = process.env.MONDAY_BOARD_ID;

  // If credentials are not configured or are placeholders, fall back to mock data
  const isConfigured = token && 
                      token !== 'ADD_YOUR_MONDAY_API_TOKEN_HERE' && 
                      boardsString && 
                      boardsString !== 'ADD_YOUR_MONDAY_BOARD_ID_HERE';

  if (!isConfigured) {
    console.log(`Monday.com credentials not configured, falling back to mock data for dealer: ${dealerId}`);
    const mockUpdates = getMockUpdates(dealerId);
    const updatesWithUrl = addMondayUrlToUpdates(mockUpdates, dealerId);
    return NextResponse.json({ updates: updatesWithUrl, source: 'mock' });
  }

  const boardIds = boardsString.split(',').map(id => id.trim()).filter(id => id.length > 0);

  try {
    // 1. Resolve Monday Item ID
    const mappings = getMondayMappings();
    let mondayItemId = mappings[dealerId]?.mondayItemId;
    
    // If not mapped, search the boards for an item matching the dealer name
    if (!mondayItemId) {
      console.log(`Mapping not found for ${dealerId}. Searching boards...`);
      
      // Clean up dealer name for searching
      const cleanSearchName = dealerName
        .replace(/(LPG|TRADING|CORP\.?|FOOD|SUMMIT|CO\.|INC\.?|ENTERPRISES?)/gi, '')
        .trim();
        
      if (cleanSearchName.length >= 2) {
        const boardQueryResponse = await fetch("https://api.monday.com/v2", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": token,
            "API-Version": "2024-04"
          },
          body: JSON.stringify({
            query: `
              query {
                boards (ids: [${boardIds.join(",")}]) {
                  id
                  name
                  items_page (limit: 100) {
                    items {
                      id
                      name
                    }
                  }
                }
              }
            `
          })
        });

        const boardData = await boardQueryResponse.json();
        if (!boardData.errors && boardData.data?.boards) {
          // Look for an item containing the cleaned search name
          for (const board of boardData.data.boards) {
            const items = board.items_page?.items || [];
            const match = items.find(item => 
              item.name.toLowerCase().includes(cleanSearchName.toLowerCase()) ||
              cleanSearchName.toLowerCase().includes(item.name.toLowerCase())
            );
            if (match) {
              mondayItemId = match.id;
              console.log(`Fuzzy matched dealer name "${dealerName}" to Monday.com item: "${match.name}" (ID: ${match.id})`);
              break;
            }
          }
        }
      }
    }

    if (!mondayItemId) {
      console.log(`Could not find Monday.com item for ${dealerId} (${dealerName}). Showing empty/fallback list.`);
      return NextResponse.json({ updates: [], source: 'live_empty' });
    }

    // 2. Fetch updates for the Monday Item (along with account slug and board ID)
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
            items (ids: [${mondayItemId}]) {
              id
              name
              board {
                id
              }
              updates {
                id
                body
                created_at
                creator {
                  name
                  photo_original
                }
                assets {
                  id
                  name
                  public_url
                }
                replies {
                  id
                  body
                  created_at
                  creator {
                    name
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
      console.error("Monday.com GraphQL errors:", data.errors);
      throw new Error("Monday.com GraphQL execution failed");
    }

    const item = data.data?.items?.[0];
    if (!item) {
      return NextResponse.json({ updates: [], source: 'live_not_found' });
    }

    const liveSlug = data.data?.me?.account?.slug || 'masaganagas';
    const liveBoardId = item.board?.id || boardIds[0] || '1244621950';
    const liveItemId = item.id;

    // Format the updates for our UI
    const formattedUpdates = (item.updates || []).map(up => {
      // Calculate a relative time helper (mocking the look)
      const date = new Date(up.created_at);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      let relativeTime = 'Just now';
      if (diffDays > 0) relativeTime = `${diffDays}d`;
      else if (diffHours > 0) relativeTime = `${diffHours}h`;
      else if (diffMins > 0) relativeTime = `${diffMins}m`;

      // Get initials for avatar
      const initials = (up.creator?.name || 'User')
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

      // Pick a semi-random but stable color based on name length
      const colors = ['#10b981', '#8b5cf6', '#3b82f6', '#f59e0b', '#ec4899', '#14b8a6'];
      const avatarColor = colors[(up.creator?.name?.length || 0) % colors.length];

      return {
        id: up.id,
        author: {
          name: up.creator?.name || 'Unknown User',
          photo: up.creator?.photo_original || null,
          initials,
          avatarColor
        },
        createdAt: up.created_at,
        relativeTime,
        body: sanitizeHtml(up.body), // Live HTML body
        attachments: (up.assets || []).map(asset => ({
          name: asset.name,
          url: getSafeUrl(asset.public_url),
          type: asset.name.toLowerCase().match(/\.(jpeg|jpg|gif|png)$/) ? 'image' : 'file'
        })),
        replies: (up.replies || []).map(r => ({
          id: r.id,
          body: r.body,
          createdAt: r.created_at,
          author: {
            name: r.creator?.name || 'Unknown User'
          }
        }))
      };
    });

    const updatesWithUrl = addMondayUrlToUpdates(formattedUpdates, dealerId, liveSlug, liveBoardId, liveItemId);
    return NextResponse.json({ updates: updatesWithUrl, source: 'live' });

  } catch (err) {
    console.error("Live Monday.com fetch failed, falling back to mock data:", err);
    const mockUpdates = getMockUpdates(dealerId);
    const updatesWithUrl = addMondayUrlToUpdates(mockUpdates, dealerId);
    return NextResponse.json({ updates: updatesWithUrl, source: 'mock_fallback' });
  }
}
