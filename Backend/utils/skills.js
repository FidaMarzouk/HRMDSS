// Skills are stored as { name, level, validatedBy, validatedAt }. Older code,
// forms and the seed send plain names; these helpers accept both.

const MAX_LEVEL = 5;

const cleanName = (name) => String(name || '').trim().replace(/\s+/g, ' ').slice(0, 60);

// "ROS, Embedded C" | ["ROS"] | [{ name, level }] -> [{ name, level?, ... }], deduplicated by name.
const normalizeSkills = (input) => {
  if (input === undefined || input === null) return input;
  let list = input;
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      list = Array.isArray(parsed) ? parsed : input.split(',');
    } catch {
      list = input.split(',');
    }
  }
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const isObject = item && typeof item === 'object';
    // Mongoose subdocuments: read plain values
    const raw = isObject && typeof item.toObject === 'function' ? item.toObject() : item;
    const name = cleanName(isObject ? raw.name : raw);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const skill = { name };
    if (isObject) {
      const level = Number(raw.level);
      if (Number.isInteger(level) && level >= 1 && level <= MAX_LEVEL) skill.level = level;
      if (raw.validatedBy) skill.validatedBy = raw.validatedBy;
      if (raw.validatedAt) skill.validatedAt = raw.validatedAt;
    }
    out.push(skill);
  }
  return out;
};

// Plain names, for search, charts and the assistant.
const skillNames = (skills) => (skills || []).map((s) => (typeof s === 'string' ? s : s?.name)).filter(Boolean);

// Apply a new list of names while keeping the levels already recorded for them.
const mergeSkillNames = (existing, names) => {
  const byName = new Map(normalizeSkills(existing || []).map((s) => [s.name.toLowerCase(), s]));
  return normalizeSkills(names).map((s) => byName.get(s.name.toLowerCase()) || s);
};

module.exports = { MAX_LEVEL, normalizeSkills, skillNames, mergeSkillNames };
