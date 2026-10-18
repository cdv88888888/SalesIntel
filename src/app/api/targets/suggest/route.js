import { NextResponse } from 'next/server';
import { getAvailableMonths, getDealerAggregates } from '@/lib/bigquery';
import { getSettings } from '@/lib/settings';
import { cookies } from "next/headers";

function getPreviousMonthStr(monthStr) {
  if (!monthStr) return null;
  const [year, month] = monthStr.split('-').map(Number);
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear -= 1;
  }
  return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const globalTarget = parseInt(searchParams.get('globalTarget'), 10);
    const month = searchParams.get('month');

    if (isNaN(globalTarget)) {
      return NextResponse.json({ error: "Invalid globalTarget provided" }, { status: 400 });
    }

    const availableMonths = await getAvailableMonths();
    if (availableMonths.length === 0) {
      return NextResponse.json({ error: "No historical data found in BigQuery" }, { status: 404 });
    }

    const segment = searchParams.get('segment') || 'dealer';

    const latest = availableMonths[0];
    const currentPeriod = `${latest.year}-${String(latest.month).padStart(2, '0')}`;
    const dealers = await getDealerAggregates(currentPeriod, currentPeriod, [], segment);

    // Get previous month targets
    const prevMonth = getPreviousMonthStr(month) || currentPeriod;
    const prevSettings = await getSettings(prevMonth, segment);
    const prevTargets = prevSettings?.dealerTargets || {};

    const validDealers = dealers.filter(d => d.avgMonthKgs && d.avgMonthKgs > 0);

    const projectedTargets = {};
    let totalProjected = 0;

    validDealers.forEach(d => {
      // 1. Determine Base (previous target or historical average)
      let baseTarget = prevTargets[d.id] || d.avgMonthKgs; 

      // 2. Calculate MoM Growth
      let avgMoM = 0;
      if (d.monthlyHistory) {
        try {
          const history = JSON.parse(d.monthlyHistory);
          // Use up to 6 most recent months
          const recent = history.slice(0, 6).reverse(); // oldest to newest
          let sumMoM = 0;
          let countMoM = 0;
          for (let i = 1; i < recent.length; i++) {
            if (recent[i-1].monthlyKgs > 0) {
              const mom = (recent[i].monthlyKgs / recent[i-1].monthlyKgs) - 1;
              sumMoM += mom;
              countMoM++;
            }
          }
          if (countMoM > 0) {
            avgMoM = sumMoM / countMoM;
            // Cap MoM between -50% and +50%
            avgMoM = Math.max(-0.5, Math.min(0.5, avgMoM));
          }
        } catch(e) {}
      }

      // 3. Apply Growth
      const projected = baseTarget * (1 + avgMoM);
      projectedTargets[d.id] = projected;
      totalProjected += projected;
    });

    if (totalProjected === 0) {
      return NextResponse.json({ error: "Total projected volume is 0" }, { status: 400 });
    }

    const suggestions = {};
    validDealers.forEach(d => {
      const projected = projectedTargets[d.id];
      const proportion = projected / totalProjected;
      const suggestedTarget = Math.round(proportion * globalTarget);
      
      suggestions[d.id] = {
        name: d.name,
        avgMonthKgs: d.avgMonthKgs,
        highestMonthKgs: d.highestMonthKgs,
        lowestMonthKgs: d.lowestMonthKgs,
        suggestedTarget
      };
    });

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Error in /api/targets/suggest:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
