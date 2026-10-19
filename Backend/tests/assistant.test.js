process.env.TZ = 'Africa/Tunis';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.AGENT_SHARED_SECRET = 'agent-secret-for-tests';
const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const registry = require('../services/assistant/registry');
const delegation = require('../services/assistant/delegation');
const authMiddleware = require('../Middlewares/authMiddleware');
const { at } = require('../services/assistant/common');

const names = (role) => registry.manifestFor(role).map((t) => t.name);

test('every tool declares a skill, an effect and a JSON schema without $schema', () => {
  for (const t of registry.TOOLS) {
    assert.ok(registry.SKILLS[t.skill], `${t.name} skill`);
    assert.ok(['read', 'prepare'].includes(t.effect), `${t.name} effect`);
  }
  registry.manifestFor('admin').forEach((t) => {
    assert.equal(t.parameters.type, 'object');
    assert.equal('$schema' in t.parameters, false);
  });
});

test('reviewer tools only for reviewer roles; event decisions for HR only; punches not for the CEO', () => {
  assert.ok(!names('employee').includes('prepare_leave_decision'));
  assert.ok(!names('employee').includes('prepare_correction_decision'));
  assert.ok(names('manager').includes('prepare_leave_decision'));
  assert.ok(!names('manager').includes('prepare_event_decision'));
  assert.ok(names('admin').includes('prepare_event_decision'));
  assert.ok(!names('superAdmin').includes('prepare_punch'));
  assert.ok(!names('employee').includes('get_who_is_in'));
});

test('execute refuses unknown tools, tools outside the role and invalid arguments before touching data', async () => {
  const ctx = { user: { id: '000000000000000000000001', role: 'employee' }, threadId: 't' };
  assert.match((await registry.execute(ctx, 'nope', {})).error, /Unknown tool/);
  assert.match((await registry.execute(ctx, 'prepare_leave_decision', { requestId: '000000000000000000000002', decision: 'approve' })).error, /not available for your role/);
  const bad = await registry.execute(ctx, 'check_leave_dates', { startDate: '15/03/2027', endDate: '2027-03-16', type: 'Vacation Leave' });
  assert.match(bad.error, /startDate: Use YYYY-MM-DD/);
  const badType = await registry.execute(ctx, 'check_leave_dates', { startDate: '2027-03-15', endDate: '2027-03-16', type: 'Holiday' });
  assert.match(badType.error, /type/);
});

test('delegated tokens: valid only with the assistant scope, refused by the normal API', () => {
  const token = delegation.mint({ id: 'u1', role: 'employee', sid: 's1' }, 'thread1');
  const decoded = delegation.verify(token);
  assert.equal(decoded.scope, 'assistant');
  assert.equal(decoded.thread, 'thread1');
  const normal = jwt.sign({ id: 'u1', role: 'employee' }, process.env.JWT_SECRET);
  assert.equal(delegation.verify(normal), null);

  let status = 0;
  const res = { status: (s) => ((status = s), { json: () => {} }) };
  let passed = false;
  authMiddleware({ cookies: { authToken: token }, header: () => null }, res, () => (passed = true));
  assert.equal(passed, false);
  assert.equal(status, 401);
});

test('the agent proves itself with the shared secret', () => {
  const req = (v) => ({ get: (h) => (h === 'x-agent-secret' ? v : undefined) });
  assert.equal(delegation.isAgent(req('agent-secret-for-tests')), true);
  assert.equal(delegation.isAgent(req('wrong-secret-of-same-length!!')), false);
  assert.equal(delegation.isAgent(req('')), false);
});

test('tool times are company time', () => {
  assert.equal(at('2026-10-20', '10:00').toISOString(), '2026-10-20T09:00:00.000Z');
});
