// The ENOVA Assistant's tool registry. Every tool declares its skill (tool
// group loaded on demand), its effect ("read" or "prepare": prepare tools only
// create drafts the person confirms), the roles allowed to use it, and a zod
// schema for its arguments. Handlers reuse the services the screens use, so a
// rule enforced in the UI is enforced here too.
const { z } = require('zod');
const User = require('../../Models/User');
const { ToolError } = require('./common');

const TOOLS = [
  ...require('./tools/other'),
  ...require('./tools/leave'),
  ...require('./tools/calendar'),
  ...require('./tools/time'),
];

const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

const SKILLS = {
  core: 'Handbook search, own profile and data, colleague lookup (always loaded)',
  leave: 'Leave: check dates, prepare requests, answer proposed dates, review requests (reviewers)',
  calendar: 'Calendar: people, resources and free slots, bookings, meetings, missions, invitations, event approvals (HR)',
  time: 'Time: punch state, punches, attendance corrections, correction reviews (reviewers)',
  inbox: 'Inbox: what needs action, prepare chat messages',
  insight: 'Insight (managers, HR, CEO): who is in, Analytics signals',
};

const allowed = (tool, role) => !tool.roles || tool.roles.includes(role);

/** Tools available to a role, as JSON-schema function definitions for the model. */
const manifestFor = (role) =>
  TOOLS.filter((t) => allowed(t, role)).map((t) => ({
    name: t.name,
    skill: t.skill,
    effect: t.effect,
    description: t.description,
    parameters: (({ $schema, ...rest }) => rest)(z.toJSONSchema(t.schema)),
  }));

/**
 * Run a tool for the person the delegated token belongs to.
 * Returns { ok: true, data } or { ok: false, error } (errors are safe to show the model).
 */
const execute = async ({ user, threadId }, name, rawArgs) => {
  const tool = BY_NAME.get(name);
  if (!tool) return { ok: false, error: `Unknown tool ${name}.` };
  if (!allowed(tool, user.role)) return { ok: false, error: 'This tool is not available for your role.' };
  const parsed = tool.schema.safeParse(rawArgs || {});
  if (!parsed.success) {
    return { ok: false, error: `Invalid arguments: ${parsed.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; ')}` };
  }
  const me = await User.findOne({ _id: user.id, ...User.ACTIVE }).select('firstName lastName role departmentId managerId hireDate').lean();
  if (!me) return { ok: false, error: 'Account not available.' };
  try {
    const data = await tool.handler({ user, me, threadId }, parsed.data);
    return { ok: true, data, effect: tool.effect };
  } catch (error) {
    if (error instanceof ToolError) return { ok: false, error: error.message };
    console.error(`Assistant tool ${name} failed:`, error);
    return { ok: false, error: 'The tool failed; try again or ask differently.' };
  }
};

module.exports = { TOOLS, SKILLS, manifestFor, execute };
