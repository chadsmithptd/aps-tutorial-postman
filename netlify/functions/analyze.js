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

  const { apiKey, imageBlock, systemPrompt, reconciliationText } = body;
  if (!apiKey) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing apiKey' }) };
  }
  if (!imageBlock) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing imageBlock' }) };
  }

  // If step-1 reconciliation was provided, inject it before the final JSON instruction
  // so the model builds from already-verified, cross-checked dimensions.
  const finalUserText = reconciliationText
    ? `Multi-view blueprint analysis (pre-verified):\n\n${reconciliationText}\n\n---\nUsing the verified analysis above, now produce the final CadQuery JSON. Honour all confirmed dimensions exactly.`
    : 'Analyze this blueprint sketch and return the JSON.';

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-8',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [
          imageBlock,
          { type: 'text', text: finalUserText }
        ]
      }]
    })
  });

  const data = await anthropicRes.json();

  return {
    statusCode: anthropicRes.status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  };
};
