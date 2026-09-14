// Cylinder size, class and variant, derived from what a sales line actually
// carries.
//
// The sales table records CONTENT - the kilos of gas - not the cylinder. A
// 50 kg cylinder holding 45 kg is a Class C, and reading "45 kg" as a cylinder
// size would invent a product that does not exist. This table is the price
// list: content in kilos -> the cylinder it came out of, and its class.
//
// Where one content weight covers more than one product (11 kg is both MGas
// and Sulit; 2.7 kg is both Sulit and non-Sulit), the item description settles
// it. Where the description cannot settle it - 22 kg Regular against Forklift,
// which share both weights - the variant is left unknown rather than guessed.

const CONTENT_TABLE = [
  // A. 50 kg cylinder
  { content: 50, cylinder: '50 kg', className: 'Class A' },
  { content: 47, cylinder: '50 kg', className: 'Class B' },
  { content: 45, cylinder: '50 kg', className: 'Class C' },

  // B. 22 kg cylinder - Regular and Forklift share these weights, so the
  //    variant is only known when the description names it.
  { content: 22, cylinder: '22 kg', className: 'Class A', ambiguousVariant: ['Regular', 'Forklift'] },
  { content: 20, cylinder: '22 kg', className: 'Class B', ambiguousVariant: ['Regular', 'Forklift'] },

  // C. 11 kg cylinder. Pick-up classes are discontinued but still in history.
  { content: 11, cylinder: '11 kg', className: null, byDescription: { sulit: 'Sulit', default: 'MGas' } },
  { content: 10.5, cylinder: '11 kg', className: 'Class B', variant: 'Pick-up', discontinued: true },
  { content: 10, cylinder: '11 kg', className: 'Class C', variant: 'Pick-up', discontinued: true },

  // D. Mini
  { content: 9, cylinder: 'Mini 9', className: null },

  // E. Sulit Gas 5 kg
  { content: 5, cylinder: '5 kg', className: 'Class A', variant: 'Sulit Gas' },

  // F. Sulit Gas 2.7 kg
  { content: 2.7, cylinder: '2.7 kg', className: null, byDescription: { sulit: 'Sulit', default: 'Non-Sulit' } },
];

// Bulk is sold by volume bracket: Quantity holds kilograms, so content per
// unit lands on 1 and there is no cylinder to name.
const BULK_CONTENT_CEILING = 1.5;

/**
 * Describe one sales line's packaging.
 *
 * @param {number} contentKg  Total_KGS_Sold / Quantity for the line.
 * @param {string} description  Item_Description, used only to pick a variant.
 * @returns {{ isBulk: boolean, cylinder: string|null, className: string|null,
 *             variant: string|null, discontinued: boolean, label: string,
 *             known: boolean }}
 */
export function describeCylinder(contentKg, description = '') {
  const content = Number(contentKg);
  const desc = String(description || '').toLowerCase();

  if (!Number.isFinite(content) || content <= BULK_CONTENT_CEILING) {
    return {
      isBulk: true, cylinder: null, className: null, variant: null,
      discontinued: false, label: 'Bulk', known: true,
    };
  }

  const entry = CONTENT_TABLE.find(e => Math.abs(e.content - content) < 0.05);
  if (!entry) {
    // An unlisted weight is real data - show it plainly rather than forcing it
    // into the nearest class.
    return {
      isBulk: false, cylinder: `${trim(content)} kg`, className: null, variant: null,
      discontinued: false, label: `${trim(content)} kg`, known: false,
    };
  }

  let variant = entry.variant || null;
  if (entry.byDescription) {
    variant = Object.entries(entry.byDescription)
      .find(([key]) => key !== 'default' && desc.includes(key))?.[1]
      || entry.byDescription.default;
  } else if (entry.ambiguousVariant) {
    variant = entry.ambiguousVariant.find(v => desc.includes(v.toLowerCase())) || null;
  }

  const parts = [entry.cylinder];
  if (variant) parts.push(variant);
  if (entry.className) parts.push(entry.className);

  return {
    isBulk: false,
    cylinder: entry.cylinder,
    className: entry.className || null,
    variant,
    discontinued: Boolean(entry.discontinued),
    label: parts.join(' '),
    known: true,
  };
}

function trim(n) {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(1)));
}
