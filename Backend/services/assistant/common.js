// Helpers shared by the assistant's tools: company-time parsing, formatting,
// and a typed error whose message is safe to show to the model.
const { z } = require('zod');
const User = require('../../Models/User');
const { dayKey } = require('../../utils/time');

// A refusal or a precondition the model should explain to the person.
class ToolError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ToolError';
  }
}

// Tools take company days and times as plain strings, so the model never has
// to reason about time zones. Africa/Tunis is UTC+1 all year.
const DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').describe('A company day, YYYY-MM-DD');
const TIME = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24 h)').describe('A company time, HH:MM (24 h)');
const ID = z.string().regex(/^[a-f0-9]{24}$/i, 'Use an id returned by another tool').describe('An id returned by another tool');

const at = (day, hhmm) => new Date(`${day}T${hhmm}:00+01:00`);
const dayOf = (day) => new Date(`${day}T00:00:00+01:00`);

const fmtDay = (d) => new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = (d) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const fmtRange = (a, b) => (dayKey(a) === dayKey(b) ? fmtDay(a) : `${fmtDay(a)} → ${fmtDay(b)}`);
const fullName = (u) => (u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '');

// Active people by (part of) their name, for invitations and messages.
const findPeopleByName = async (query, { limit = 8, excludeId } = {}) => {
  const words = String(query || '').trim().split(/\s+/).filter(Boolean).slice(0, 3);
  if (!words.length) return [];
  const rx = (w) => new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const people = await User.find({
    ...User.ACTIVE,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    $and: words.map((w) => ({ $or: [{ firstName: rx(w) }, { lastName: rx(w) }] })),
  })
    .select('firstName lastName position role departmentId')
    .populate('departmentId', 'name')
    .limit(limit)
    .lean();
  return people.map((p) => ({ id: String(p._id), name: fullName(p), position: p.position, department: p.departmentId?.name || null }));
};

module.exports = { z, ToolError, DAY, TIME, ID, at, dayOf, fmtDay, fmtTime, fmtRange, fullName, findPeopleByName };
