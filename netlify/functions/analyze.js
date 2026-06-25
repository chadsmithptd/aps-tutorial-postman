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

  const { apiKey, imageBlock, systemPrompt } = body;
  if (!apiKey) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing apiKey' }) };
  }
  if (!imageBlock) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing imageBlock' }) };
  }

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-8',
      max_tokens: 1200,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [
          imageBlock,
          { type: 'text', text: 'Analyze this blueprint sketch and return the JSON.' }
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
