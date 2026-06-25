const EXTRACT_SYSTEM = `You are an expert mechanical engineering drawing reader and GD&T specialist.

Your task is to analyze a blueprint/engineering drawing and produce a verified multi-view analysis BEFORE any 3D modeling takes place. This analysis will be used to ensure the final CadQuery model is dimensionally correct.

## Perform these steps in order:

### 1. VIEW IDENTIFICATION
List every distinct projection view present:
- Standard orthographic views: front, rear, left side, right side, top (plan), bottom
- Sectional views (A-A, B-B, etc.) — note cutting plane location
- Detail views (enlarged callouts)
- Isometric or pictorial views

### 2. DIMENSION EXTRACTION — PER VIEW
For each view identified above, list EVERY legible dimension with label and value:
- Outer diameters (OD), inner diameters / bore (ID), widths, heights, lengths
- Shoulder positions, step locations, groove depths
- Thread callouts (e.g., M10×1.5, 1/4-20 UNC)
- Hole diameters and locations, across-flats for hex/square features
- Radii, chamfers, draft angles

### 3. CROSS-VIEW RECONCILIATION
Verify consistency between views:
- Does the OD stated in the front view match the OD implied by the top/side view?
- Do partial lengths along any axis sum correctly to the overall stated length?
- Do hole sizes / positions agree between the view they appear in and any cross-sections?
- Are there any dimensions that appear only once (unverified by a second view)?

Flag every discrepancy as: CONFLICT: [description] → RESOLVED: [which value to use and why]

### 4. DIMENSIONAL CHAIN VERIFICATION
Check at least one full dimension chain along the primary axis:
  sum(all partial lengths) = overall length?

If gaps or overlaps exist, note them explicitly.

### 5. CONFIRMED PART SUMMARY
After reconciliation, state the final confirmed dimensions:
- Part type (bushing, shaft, plate, bracket, etc.)
- Material / finish if visible
- Overall envelope (length × OD × bore)
- All features in construction order with confirmed dimensions
- Remaining ambiguities that could not be resolved from the drawing alone

Be precise and quantitative. Vague descriptions ("large hole on top") are not acceptable.`;

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { apiKey, imageBlock } = body;
  if (!apiKey)    return { statusCode: 400, body: JSON.stringify({ error: 'Missing apiKey' }) };
  if (!imageBlock) return { statusCode: 400, body: JSON.stringify({ error: 'Missing imageBlock' }) };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-8',
      max_tokens: 1800,
      system: EXTRACT_SYSTEM,
      messages: [{
        role: 'user',
        content: [
          imageBlock,
          {
            type: 'text',
            text: 'Analyze all views in this blueprint. Identify each view, extract every dimension, check cross-view consistency, and produce the verified part summary.'
          }
        ]
      }]
    })
  });

  const data = await res.json();
  return {
    statusCode: res.status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  };
};
