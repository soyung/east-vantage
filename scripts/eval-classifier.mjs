#!/usr/bin/env node
// Evaluation harness for the LLM classifier. Reads
// evals/classifier-set.jsonl, sends each item through the classifier
// path, and reports precision/recall vs. expected_keep.
//
// Requires ANTHROPIC_API_KEY env var. Run with:
//   node scripts/eval-classifier.mjs

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const setPath = join(__dirname, '..', 'evals', 'classifier-set.jsonl');

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('ANTHROPIC_API_KEY not set. Cannot run evaluation.');
  process.exit(1);
}

const items = readFileSync(setPath, 'utf-8')
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l));

const SYSTEM = `You are a strict East Asia OSINT triager.

Input items may be in English, Korean, Chinese (Traditional/Simplified), or Japanese.

For each item, decide whether it describes a CONCRETE, ALREADY-OCCURRED OR IN-PROGRESS kinetic / sensor event in the Taiwan Strait or Korean peninsula region. Categories to keep:
- air (PLA aircraft incursion, scramble, ADIZ crossing, military flight)
- naval (warship/CCG movement, exercise, intercept)
- missile (test launch, projectile, ICBM/SRBM, launch detection)
- cyber (intrusion, breach, APT attribution to PRC/DPRK)
- satellite (FIRMS thermal anomaly, imagery analysis, reactor activity)
- seismic (earthquake near Punggye-ri, possible nuclear test)

Drop everything else: opinion pieces, diplomatic talks, sports, entertainment, business, anniversary commemorations, generic tensions pieces.

Default to drop when ambiguous.

Reply ONLY with valid JSON:
{"items":[{"id":"...","keep":true|false,"confidence":0-1,"category":"...","reason":"..."}]}`;

const client = new Anthropic({ apiKey });

const msg = await client.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 3000,
  system: SYSTEM,
  messages: [
    {
      role: 'user',
      content: JSON.stringify({
        items: items.map((it) => ({ id: it.id, title: it.title, summary: it.summary })),
      }),
    },
  ],
});

const text = msg.content
  .filter((b) => b.type === 'text')
  .map((b) => b.text)
  .join('');
const jsonMatch = text.match(/\{[\s\S]*\}/);
if (!jsonMatch) {
  console.error('Non-JSON output:', text.slice(0, 500));
  process.exit(2);
}
const out = JSON.parse(jsonMatch[0]);

const byId = new Map(out.items.map((r) => [r.id, r]));
let tp = 0, fp = 0, tn = 0, fn = 0;
const errors = [];
for (const it of items) {
  const r = byId.get(it.id);
  if (!r) {
    errors.push({ id: it.id, issue: 'no result' });
    continue;
  }
  const predicted = r.keep;
  const actual = it.expected_keep;
  if (actual && predicted) tp++;
  else if (!actual && !predicted) tn++;
  else if (!actual && predicted) {
    fp++;
    errors.push({ id: it.id, type: 'FP', title: it.title.slice(0, 80), reason: r.reason });
  } else {
    fn++;
    errors.push({ id: it.id, type: 'FN', title: it.title.slice(0, 80), reason: r.reason });
  }
}

const precision = tp / (tp + fp || 1);
const recall = tp / (tp + fn || 1);
const accuracy = (tp + tn) / items.length;

console.log('\nClassifier evaluation results:');
console.log(`  TP=${tp}  FP=${fp}  FN=${fn}  TN=${tn}`);
console.log(`  Precision: ${(precision * 100).toFixed(1)}%  (target ≥90%)`);
console.log(`  Recall:    ${(recall * 100).toFixed(1)}%  (target ≥80%)`);
console.log(`  Accuracy:  ${(accuracy * 100).toFixed(1)}%`);

if (errors.length) {
  console.log('\nErrors:');
  for (const e of errors) {
    console.log(`  [${e.type ?? '?'}] ${e.id}: ${e.title} -- "${e.reason ?? ''}"`);
  }
}

const passes = precision >= 0.9 && recall >= 0.8;
console.log(passes ? '\n PASS\n' : '\n FAIL (precision <90% or recall <80%)\n');
process.exit(passes ? 0 : 3);
