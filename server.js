import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const currency = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Build a readable plain-text summary of the budget for the model.
function describeBudget(b) {
  const lines = [];
  const job = b.job || {};
  lines.push(`JOB`);
  lines.push(`- Title: ${job.title || 'n/a'}`);
  lines.push(`- Employer: ${job.employer || 'n/a'}`);
  lines.push(`- Rank/level: ${job.rank || 'n/a'}`);
  lines.push(`- Pay: ${currency(job.hourlyWage)}/hour, ${job.hoursPerWeek || 0} hours/week`);

  lines.push(`\nCAR`);
  if (b.car && b.car.hasCar) {
    lines.push(`- Type: ${b.car.type || 'n/a'}`);
    lines.push(`- Monthly car note: ${currency(b.car.carNote)}`);
  } else {
    lines.push(`- No car`);
  }

  lines.push(`\nSUBSCRIPTIONS`);
  if (b.subscriptions && b.subscriptions.length) {
    b.subscriptions.forEach(s => lines.push(`- ${s.name || 'Subscription'}: ${currency(s.cost)}/month`));
  } else {
    lines.push(`- None`);
  }

  const home = b.home || {};
  lines.push(`\nHOME`);
  lines.push(`- Rent/Mortgage: ${currency(home.rent)}/month`);
  lines.push(`- Gas & Electric: ${currency(home.utilities)}/month`);

  lines.push(`\nEXTRA EXPENSES`);
  const extra = b.extra || {};
  lines.push(`- Groceries: ${currency(extra.groceries)}/month`);
  lines.push(`- Gas for car: ${currency(extra.carGas)}/month`);
  if (extra.custom && extra.custom.length) {
    extra.custom.forEach(c => lines.push(`- ${c.name || 'Other'}: ${currency(c.cost)}/month`));
  }

  const t = b.totals || {};
  lines.push(`\nTOTALS (calculated)`);
  lines.push(`- Estimated gross monthly income: ${currency(t.grossIncome)}`);
  lines.push(`- Estimated take-home (after ~20% taxes): ${currency(t.netIncome)}`);
  lines.push(`- Total monthly expenses: ${currency(t.totalExpenses)}`);
  lines.push(`- Monthly leftover: ${currency(t.leftover)}`);

  return lines.join('\n');
}

app.post('/api/verdict', async (req, res) => {
  const { budget } = req.body;

  if (!budget || typeof budget !== 'object') {
    return res.status(400).json({ error: 'Invalid budget data' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const summary = describeBudget(budget);

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: `You are a sharp, friendly personal-finance coach inside a "Budget Planner" simulator game. The player has built out their simulated monthly finances. Your job is to look at the numbers and tell them, in a fun but honest way, whether they're going to MAKE IT in life or end up BROKE.

Rules:
- Start with a clear verdict headline, one of: "🟢 YOU'RE GOING TO MAKE IT", "🟡 YOU'RE CUTTING IT CLOSE", or "🔴 YOU'RE GOING TO BE BROKE" — pick based on the monthly leftover (comfortably positive = make it, near zero or thin = cutting it close, zero or negative = broke).
- Then give a short, punchy breakdown: what's eating their money, what's good, what's risky.
- Give 2-4 specific, actionable tips to improve their situation.
- Mention their rough savings rate and how many months of runway they'd build in a year if leftover stays the same.
- Keep it lively and encouraging even when the news is bad. Use a little humor. Use markdown with short paragraphs and bullet points. Keep it under ~250 words.`,
      messages: [
        { role: 'user', content: `Here is my simulated monthly budget. Tell me if I'm going to make it or be broke:\n\n${summary}` },
      ],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    const message = err instanceof Anthropic.APIError
      ? `API error ${err.status}: ${err.message}`
      : 'An unexpected error occurred';
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Budget Planner running at http://localhost:${PORT}`);
});
