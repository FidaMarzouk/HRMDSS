const test = require('node:test');
const assert = require('node:assert/strict');
const { chunkMarkdown } = require('../services/rag/chunker');
const { BM25, tokenize } = require('../services/rag/bm25');
const { extractCitations } = require('../services/rag/assistant');
const { createTools, definitions } = require('../services/rag/tools');

test('chunker keeps the heading path and splits long sections', () => {
  const md = [
    '# Handbook',
    '## Leave policy',
    '### Approval chain',
    'Employees go to their manager.',
    '## Working hours',
    ...Array.from({ length: 12 }, (_, i) => `Paragraph ${i} ${'x'.repeat(120)}\n`),
  ].join('\n');
  const chunks = chunkMarkdown(md, 'handbook.md', { maxChars: 600 });

  const approval = chunks.find((c) => c.heading === 'Leave policy > Approval chain');
  assert.ok(approval, 'heading path is recorded');
  assert.match(approval.text, /^Handbook — Leave policy > Approval chain/);
  assert.ok(chunks.filter((c) => c.heading === 'Working hours').length > 1, 'long section is split');
  assert.ok(chunks.every((c) => c.file === 'handbook.md'));
});

test('BM25 ranks the matching document first and stems simple suffixes', () => {
  const docs = [
    'Lunch break runs from 12:30 to 14:00.',
    'Booking a robot requires a resource reservation.',
    'Leave accrual per month.',
  ];
  const bm25 = new BM25(docs);
  assert.equal(bm25.search('when is the lunch break')[0].index, 0);
  assert.equal(bm25.search('can I book robots')[0].index, 1);
  assert.deepEqual(tokenize('Booking booked books'), ['book', 'book', 'book']);
  assert.ok(tokenize('12:30').includes('12:30'));
});

test('citations are mapped to sources and removed from the answer', () => {
  const passages = [
    { chunk: { file: 'a.md', heading: 'Leave policy > Approval chain' } },
    { chunk: { file: 'a.md', heading: 'Working hours > Lunch break' } },
  ];
  const { answer, sources } = extractCitations('Your manager reviews it first [1]. Lunch is at 12:30 [2][1].', passages);
  assert.equal(answer, 'Your manager reviews it first. Lunch is at 12:30.');
  assert.deepEqual(sources, [
    { file: 'a.md', heading: 'Leave policy > Approval chain' },
    { file: 'a.md', heading: 'Working hours > Lunch break' },
  ]);
  // Out-of-range markers are left alone
  assert.equal(extractCitations('See [7].', passages).answer, 'See [7].');
});

test('assistant tools never accept a user identifier', () => {
  for (const def of definitions) {
    const props = Object.keys(def.function.parameters.properties || {});
    assert.ok(!props.some((p) => /user|employee|id$/i.test(p)), `${def.function.name} must not take a user id`);
  }
});

test('unknown tools are rejected', async () => {
  const tools = createTools('507f1f77bcf86cd799439011');
  assert.deepEqual(await tools.execute('get_all_salaries', '{}'), { error: 'Unknown tool: get_all_salaries' });
});
