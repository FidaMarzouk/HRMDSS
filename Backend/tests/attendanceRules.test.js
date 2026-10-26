process.env.TZ = 'Africa/Tunis';
const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../services/attendanceRules');

const t = (s) => new Date(`2026-10-14T${s}:00+01:00`); // Wednesday

test('recompute: late first session, overtime after 18:00, breaks subtracted', () => {
  const r = rules.recomputeSession({
    checkIn: t('09:02'), checkOut: t('18:42'),
    breaks: [{ startTime: t('12:30'), endTime: t('13:19'), duration: 49 }],
  });
  assert.equal(r.status, 'Late');
  assert.equal(r.lateBy, 32);
  assert.equal(r.overtime, 42);
  assert.equal(r.productionHours, 8.85); // 9:40 worked span minus 49 min
});

test('recompute: early arrival counts as overtime; later sessions are never late', () => {
  const r = rules.recomputeSession({ checkIn: t('07:47'), checkOut: t('17:00'), sessionNumber: 1 });
  assert.equal(r.status, 'Present');
  assert.equal(r.earlyBy, 13);
  assert.equal(r.overtime, 13);
  const second = rules.recomputeSession({ checkIn: t('14:30'), checkOut: t('17:00'), sessionNumber: 2, previousStatus: 'Late' });
  assert.equal(second.lateBy, 0);
  assert.equal(second.status, 'Late'); // keeps the day's status
});

test('recompute: a break left open closes at punch-out', () => {
  const r = rules.recomputeSession({ checkIn: t('08:00'), checkOut: t('13:30'), breaks: [{ startTime: t('12:30') }] });
  assert.equal(r.breaks[0].duration, 60);
  assert.equal(r.productionHours, 4.5);
});

test('anomalies: late, long break, missing punch-out on a past day', () => {
  const sessions = [{ _id: 's1', checkIn: t('08:49'), status: 'Late', lateBy: 19, breaks: [{ startTime: t('12:30'), endTime: t('14:15') }] }];
  const found = rules.dayAnomalies({ sessions, day: t('00:00'), now: new Date('2026-10-15T10:00:00+01:00') });
  assert.deepEqual(found.map((a) => a.kind), ['late', 'missing_punch_out', 'long_break']);
  assert.equal(found[1].sessionId, 's1');
  assert.equal(found[2].label, 'Break 105m');
});

test('anomalies: an open session today is only missing after 20:00', () => {
  const sessions = [{ checkIn: t('08:10'), status: 'Present', breaks: [] }];
  assert.deepEqual(rules.dayAnomalies({ sessions, day: t('00:00'), now: t('17:00') }), []);
  assert.equal(rules.dayAnomalies({ sessions, day: t('00:00'), now: t('20:30') })[0].kind, 'missing_punch_out');
});

test('anomalies: absence only when not on leave', () => {
  const absent = [{ status: 'Absent' }];
  assert.equal(rules.dayAnomalies({ sessions: absent, day: t('00:00') })[0].kind, 'absent');
  assert.deepEqual(rules.dayAnomalies({ sessions: absent, day: t('00:00'), onLeave: true }), []);
});

test('repeated lateness: 3 late days within the last 10 working days', () => {
  const day = new Date('2026-10-16T12:00:00+01:00'); // Friday
  const late = ['2026-10-05', '2026-10-12', '2026-10-15'].map((d) => new Date(`${d}T09:00:00+01:00`));
  assert.equal(rules.repeatedLateness(late, day).count, 3);
  assert.equal(rules.repeatedLateness(late.slice(1), day), null);
  // 2 Oct is outside the 10-working-day window ending 16 Oct
  assert.equal(rules.repeatedLateness([new Date('2026-10-02T09:00:00+01:00'), ...late.slice(1)], day), null);
});

test('punch source from the user agent', () => {
  assert.equal(rules.detectSource('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), 'mobile');
  assert.equal(rules.detectSource('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130'), 'web');
});
