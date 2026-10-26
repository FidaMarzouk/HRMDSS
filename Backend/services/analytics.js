// Pure computations behind Analytics: periods, arrivals (swarm), attendance
// barcode, leave tide, hours budget, tickers and ranked signals.
// The controller loads the data; everything here is tested in tests/analytics.test.js.
const { FINAL_APPROVED, IN_PROGRESS } = require('../constants/leave');
const { EXPECTED_WORK_MINUTES } = require('../constants/attendance');
const { LATE_CLUSTER, LATE_RISE, OVERTIME_HOURS_PER_PERSON_WEEK, WAITING_DAYS, LOW_READ_RATE } = require('../constants/analytics');
const { startOfDay, dayKey, isWeekend } = require('../utils/time');
const { idOf } = require('./policies');

const DAY = 24 * 60 * 60 * 1000;
const EXPECTED_HOURS = EXPECTED_WORK_MINUTES / 60;
const WEEKDAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

const minutesOfDay = (d) => {
  const x = new Date(d);
  return x.getHours() * 60 + x.getMinutes();
};
const clock = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;
const shortDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const round1 = (n) => Math.round(n * 10) / 10;

const workdays = (from, to) => {
  const out = [];
  for (const d = startOfDay(from); d <= startOfDay(to); d.setDate(d.getDate() + 1)) if (!isWeekend(d)) out.push(new Date(d));
  return out;
};

const nextWorkdays = (from, n) => {
  const out = [];
  for (const d = startOfDay(from); out.length < n; d.setDate(d.getDate() + 1)) if (!isWeekend(d)) out.push(new Date(d));
  return out;
};

// { from, to } and the previous period of the same length, ending the day before.
const periods = (from, to) => {
  const start = startOfDay(from);
  const end = startOfDay(to);
  const days = Math.round((end - start) / DAY) + 1;
  const prevEnd = new Date(start.getTime() - DAY);
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * DAY);
  return { current: { from: start, to: end }, previous: { from: startOfDay(prevStart), to: startOfDay(prevEnd) }, days };
};

const median = (values) => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const quantile = (values, q) => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

// First session of each person-day with a punch-in: the "arrivals".
const arrivals = (sessions) =>
  sessions
    .filter((s) => s.checkIn && (s.sessionNumber || 1) === 1)
    .map((s) => ({ userId: idOf(s.userId), date: startOfDay(s.date), minutes: minutesOfDay(s.checkIn), late: s.status === 'Late' }));

/**
 * Swarm per department: arrival minutes this period and the previous one,
 * with medians and late counts. people: [{ id, departmentId, department }]
 */
const swarm = (people, current, previous) => {
  const deptOf = new Map(people.map((p) => [p.id, p.departmentId]));
  const groups = new Map();
  people.forEach((p) => {
    if (!groups.has(p.departmentId)) groups.set(p.departmentId, { id: p.departmentId, name: p.department, current: [], previous: [], lateCurrent: 0, latePrevious: 0 });
  });
  const add = (list, key, lateKey) =>
    list.forEach((a) => {
      const g = groups.get(deptOf.get(a.userId));
      if (!g) return;
      g[key].push(a.minutes);
      if (a.late) g[lateKey]++;
    });
  add(current, 'current', 'lateCurrent');
  add(previous, 'previous', 'latePrevious');
  return [...groups.values()]
    .filter((g) => g.current.length || g.previous.length)
    .map((g) => ({ ...g, medianCurrent: median(g.current), medianPrevious: median(g.previous) }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
};

/**
 * Attendance barcode: one cell per working day per person.
 * Cell: "present" | "late" | "absent" | "leave" | null (no record or before hire).
 */
const barcode = ({ people, days, sessions, leaves }) => {
  const byKey = new Map();
  sessions.forEach((s) => {
    const key = `${idOf(s.userId)}|${dayKey(s.date)}`;
    const list = byKey.get(key) || [];
    list.push(s);
    byKey.set(key, list);
  });
  const onLeave = (personId, day) =>
    leaves.some((l) => idOf(l.employeeId) === personId && startOfDay(l.startDate) <= day && day <= startOfDay(l.endDate));
  return people.map((p) => {
    const cells = days.map((day) => {
      if (p.hireDate && startOfDay(p.hireDate) > day) return null;
      if (onLeave(p.id, day)) return 'leave';
      const list = byKey.get(`${p.id}|${dayKey(day)}`) || [];
      const first = list.filter((s) => s.checkIn).sort((a, b) => a.checkIn - b.checkIn)[0];
      if (first) return first.status === 'Late' ? 'late' : 'present';
      if (list.some((s) => s.status === 'Absent')) return 'absent';
      return null;
    });
    const expected = cells.filter((c) => c && c !== 'leave').length;
    const attended = cells.filter((c) => c === 'present' || c === 'late').length;
    return { id: p.id, name: p.name, department: p.department, cells, rate: expected ? round1((attended / expected) * 100) : null };
  });
};

/**
 * Leave tide: for each coming working day, people away with approved leave and
 * with leave still in progress, against the coverage limit.
 */
const tide = ({ days, leaves, limit }) => {
  const columns = days.map((day) => {
    const approved = new Set();
    const pending = new Set();
    leaves.forEach((l) => {
      if (startOfDay(l.startDate) > day || day > startOfDay(l.endDate)) return;
      if (FINAL_APPROVED.includes(l.status)) approved.add(idOf(l.employeeId));
      else if (IN_PROGRESS.includes(l.status)) pending.add(idOf(l.employeeId));
    });
    approved.forEach((id) => pending.delete(id));
    return { date: dayKey(day), approved: approved.size, pending: pending.size, total: approved.size + pending.size };
  });
  const peak = columns.reduce((best, c) => (c.total > (best?.total ?? -1) ? c : best), null);
  return { columns, limit, peak, overLimit: columns.filter((c) => c.total > limit).map((c) => c.date) };
};

/**
 * Hours budget per department: production hours worked vs contracted
 * (8 h 30 per expected working day), and overtime.
 * expectedDays: Map(personId -> working days they were expected, leave excluded)
 */
const hoursBudget = ({ people, sessions, expectedDays }) => {
  const byDept = new Map();
  people.forEach((p) => {
    if (!byDept.has(p.departmentId)) byDept.set(p.departmentId, { id: p.departmentId, name: p.department, headcount: 0, worked: 0, contracted: 0, overtime: 0 });
    const g = byDept.get(p.departmentId);
    g.headcount++;
    g.contracted += (expectedDays.get(p.id) || 0) * EXPECTED_HOURS;
  });
  const deptOf = new Map(people.map((p) => [p.id, p.departmentId]));
  sessions.forEach((s) => {
    const g = byDept.get(deptOf.get(idOf(s.userId)));
    if (!g) return;
    g.worked += s.productionHours || 0;
    g.overtime += (s.overtime || 0) / 60;
  });
  return [...byDept.values()]
    .map((g) => ({ ...g, worked: round1(g.worked), contracted: round1(g.contracted), overtime: round1(g.overtime), delta: round1(g.worked - g.contracted) }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
};

// Rates per working day and for the whole period, from barcode rows.
const tickerFromBarcode = (rows, days) => {
  const perDay = days.map((_, i) => {
    const cells = rows.map((r) => r.cells[i]).filter((c) => c && c !== 'leave');
    const attended = cells.filter((c) => c === 'present' || c === 'late').length;
    const onTime = cells.filter((c) => c === 'present').length;
    return { expected: cells.length, attended, onTime, absent: cells.filter((c) => c === 'absent').length };
  });
  const sum = (k) => perDay.reduce((n, d) => n + d[k], 0);
  const expected = sum('expected');
  const attended = sum('attended');
  return {
    attendanceRate: expected ? round1((attended / expected) * 100) : null,
    punctuality: attended ? round1((sum('onTime') / attended) * 100) : null,
    absences: sum('absent'),
    daily: perDay.map((d, i) => ({
      date: dayKey(days[i]),
      attendanceRate: d.expected ? round1((d.attended / d.expected) * 100) : null,
      punctuality: d.attended ? round1((d.onTime / d.attended) * 100) : null,
    })),
  };
};

// --- Signals ------------------------------------------------------------------------

const TONE_RANK = { red: 0, amber: 1, teal: 2 };
// Within a tone, what someone can act on today comes first.
const KIND_RANK = { coverage: 0, leave: 1, time: 2, overtime: 3, lateness: 4, engagement: 5 };

/**
 * Ranked signals, each with evidence and one action. Inputs are already scoped.
 *  coverage: [{ department, limit, teamSize, days: [{ date, approved, pending, names }] }]
 *  lateCurrent / latePrevious: arrivals marked late this and last period
 *  hours: hoursBudget() rows; weeks: length of the period in weeks
 *  missingPunchOuts: count; waiting: [{ name, days }]; notifications: { sent, read, byType }
 */
const signals = ({ coverage = [], lateCurrent = [], latePrevious = [], hours = [], weeks = 1, missingPunchOuts = 0, waiting = [], notifications }) => {
  const out = [];

  // Coverage risk: the first day each department would exceed its limit.
  coverage.forEach((c) => {
    const over = c.days.find((d) => d.approved + d.pending > c.limit);
    if (!over) return;
    const away = over.approved + over.pending;
    const d = new Date(`${over.date}T12:00:00`);
    out.push({
      id: `coverage:${c.departmentId}`,
      kind: 'coverage',
      tone: 'red',
      label: 'Coverage risk',
      title: `${c.department} goes over its coverage limit on ${shortDate(d)}`,
      evidence: `${away} of ${c.teamSize} away${over.pending ? ` if ${over.pending} pending request${over.pending === 1 ? ' is' : 's are'} approved` : ''} (limit ${c.limit})${over.names?.length ? `: ${over.names.join(', ')}` : ''}.`,
      weight: away - c.limit,
      action: { label: 'Plan coverage', to: '/app/leave' },
    });
  });

  // Lateness concentrated on one weekday.
  if (lateCurrent.length >= LATE_CLUSTER.minLate) {
    const byWeekday = new Map();
    lateCurrent.forEach((a) => byWeekday.set(a.date.getDay(), [...(byWeekday.get(a.date.getDay()) || []), a.minutes]));
    const [weekday, minutes] = [...byWeekday.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    if (minutes.length / lateCurrent.length >= LATE_CLUSTER.share && minutes.length >= LATE_CLUSTER.minLate) {
      out.push({
        id: 'lateness:cluster',
        kind: 'lateness',
        tone: 'amber',
        label: 'Punctuality',
        title: `Late arrivals cluster on ${WEEKDAYS[weekday]}`,
        evidence: `${minutes.length} of ${lateCurrent.length} late arrivals this period were on ${WEEKDAYS[weekday]}, mostly ${clock(quantile(minutes, 0.25))}–${clock(quantile(minutes, 0.75))}.`,
        weight: minutes.length,
        action: { label: 'See arrivals', to: '#arrivals' },
      });
    }
  }

  // Lateness rising against the previous period.
  if (lateCurrent.length >= latePrevious.length * LATE_RISE.factor && lateCurrent.length - latePrevious.length >= LATE_RISE.minExtra) {
    out.push({
      id: 'lateness:rise',
      kind: 'lateness',
      tone: 'amber',
      label: 'Punctuality',
      title: 'Late arrivals are rising',
      evidence: `${lateCurrent.length} late arrivals this period against ${latePrevious.length} in the previous one.`,
      weight: lateCurrent.length - latePrevious.length,
      action: { label: 'See arrivals', to: '#arrivals' },
    });
  }

  // Overtime per person per week, by department.
  hours
    .filter((h) => h.headcount && h.overtime / h.headcount / Math.max(1, weeks) > OVERTIME_HOURS_PER_PERSON_WEEK)
    .forEach((h) => {
      const perWeek = round1(h.overtime / h.headcount / Math.max(1, weeks));
      out.push({
        id: `overtime:${h.id}`,
        kind: 'overtime',
        tone: 'amber',
        label: 'Overtime',
        title: `${h.name} averages ${perWeek} h overtime per person per week`,
        evidence: `${h.overtime} h of overtime across ${h.headcount} people this period (threshold ${OVERTIME_HOURS_PER_PERSON_WEEK} h per person per week).`,
        weight: perWeek,
        action: { label: 'Open Time', to: '/app/time' },
      });
    });

  if (missingPunchOuts > 0) {
    out.push({
      id: 'time:missing',
      kind: 'time',
      tone: 'amber',
      label: 'Time records',
      title: `${missingPunchOuts} punch-out${missingPunchOuts === 1 ? ' is' : 's are'} missing this period`,
      evidence: 'Open sessions on past days distort hours and overtime until they are corrected.',
      weight: missingPunchOuts,
      action: { label: 'Review exceptions', to: '/app/time' },
    });
  }

  const longWaits = waiting.filter((w) => w.days > WAITING_DAYS);
  if (longWaits.length) {
    out.push({
      id: 'leave:waiting',
      kind: 'leave',
      tone: 'amber',
      label: 'Leave decisions',
      title: `${longWaits.length} leave request${longWaits.length === 1 ? ' has' : 's have'} waited more than ${WAITING_DAYS} days`,
      evidence: `Longest: ${longWaits.sort((a, b) => b.days - a.days).slice(0, 3).map((w) => `${w.name} (${w.days} days)`).join(', ')}.`,
      weight: longWaits.length,
      action: { label: 'Open Leave', to: '/app/leave' },
    });
  }

  if (notifications && notifications.sent >= LOW_READ_RATE.minSent && notifications.read / notifications.sent < LOW_READ_RATE.rate) {
    const rate = Math.round((notifications.read / notifications.sent) * 100);
    const top = [...(notifications.byType || [])].sort((a, b) => b.sent - a.sent)[0];
    out.push({
      id: 'engagement:notifications',
      kind: 'engagement',
      tone: 'teal',
      label: 'Engagement',
      title: `Only ${rate}% of notifications are read`,
      evidence: `${notifications.read} of ${notifications.sent} read this period${top ? `; ${top.label} make up ${Math.round((top.sent / notifications.sent) * 100)}% of them` : ''}.`,
      weight: 1 - notifications.read / notifications.sent,
      action: { label: 'Open notifications', to: '/app/notifications' },
    });
  }

  return out.sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone] || KIND_RANK[a.kind] - KIND_RANK[b.kind] || b.weight - a.weight);
};

module.exports = {
  dayKey,
  workdays,
  nextWorkdays,
  periods,
  median,
  arrivals,
  swarm,
  barcode,
  tide,
  hoursBudget,
  tickerFromBarcode,
  signals,
};
