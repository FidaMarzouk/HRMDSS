// Fills the database with a synthetic Enova Robotics company for testing.
//
//   npm run seed                      -> only runs on an empty database
//   npm run seed -- --reset           -> DELETES all HRMS data first, then seeds
//   npm run seed -- --reset --my-email you@example.com
//                                     -> also sets the HR demo account's personal email,
//                                        so password-reset emails reach you
//
// All dates are relative to today, so dashboards always show recent activity.
// Every account uses the same password (printed at the end).

process.env.TZ = 'Africa/Tunis';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../Models/User');
const Department = require('../Models/Department');
const LeaveRequest = require('../Models/LeaveRequest');
const Attendance = require('../Models/Attendance');
const CalendarEvent = require('../Models/CalendarEvent');
const Resource = require('../Models/Resource');
const Notification = require('../Models/Notification');
const TeamChat = require('../Models/TeamChat');
const { updateUserLeaveBalance, calculateAccruedLeaveDays } = require('../Middlewares/leaveCalculationHelper');
const { countWorkingDays, isWeekend, startOfDay } = require('../utils/time');

const PASSWORD = 'Enova@2026';
const DOMAIN = 'enova.test'; // reserved test domain: no real mailbox can receive these
const args = process.argv.slice(2);
const RESET = args.includes('--reset');
const myEmailIndex = args.indexOf('--my-email');
const MY_EMAIL = myEmailIndex >= 0 ? args[myEmailIndex + 1] : null;

// ---------------------------------------------------------------------------
// Deterministic randomness, so every run produces the same company
let seed = 20261015;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => a + Math.floor(rand() * (b - a + 1));
const chance = (p) => rand() < p;
const sample = (arr, n) => [...arr].sort(() => rand() - 0.5).slice(0, n);

const NOW = new Date();
const TODAY = startOfDay(NOW);
const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };
const at = (date, h, m = 0) => { const d = new Date(date); d.setHours(h, m, 0, 0); return d; };
const minutes = (a, b) => Math.round((b - a) / 60000);
const workdaysFrom = (start, count) => {
  // returns the date reached after `count` working days, starting on `start` (inclusive)
  let d = new Date(start);
  while (isWeekend(d)) d = addDays(d, 1);
  let left = count - 1;
  while (left > 0) { d = addDays(d, 1); if (!isWeekend(d)) left--; }
  return d;
};
const nextWorkday = (date) => { let d = new Date(date); while (isWeekend(d)) d = addDays(d, 1); return d; };

// ---------------------------------------------------------------------------
// Company structure
const FEMALE = ['Amira', 'Sarra', 'Yasmine', 'Ines', 'Mariem', 'Rania', 'Nour', 'Emna', 'Asma', 'Khaoula', 'Hela', 'Olfa', 'Salma', 'Chaima', 'Fatma', 'Rim', 'Wiem', 'Ons'];
const MALE = ['Ahmed', 'Mohamed', 'Youssef', 'Aymen', 'Karim', 'Mehdi', 'Hamza', 'Bilel', 'Oussama', 'Skander', 'Walid', 'Firas', 'Anis', 'Nizar', 'Haythem', 'Slim', 'Amine', 'Zied', 'Fares', 'Rami'];
const LAST = ['Trabelsi', 'Ben Ali', 'Gharbi', 'Jaziri', 'Mejri', 'Bouazizi', 'Hammami', 'Chaabane', 'Ayari', 'Sassi', 'Khelifi', 'Mansouri', 'Ben Salah', 'Dridi', 'Baccouche', 'Ferchichi', 'Zouari', 'Kammoun', 'Belhadj', 'Masmoudi', 'Saidi', 'Haddad', 'Ellouze', 'Jebali', 'Rekik', 'Ouertani', 'Karray', 'Chtourou'];

const DEPARTMENTS = [
  { name: 'Robotics Engineering', head: 'Head of Robotics Engineering', size: 6,
    positions: ['Mechatronics Engineer', 'Mechanical Design Engineer', 'Robotics Engineer', 'CAD Technician'],
    skills: ['SolidWorks', 'ROS', 'Kinematics', 'CATIA', 'Prototyping', 'FEA', '3D printing'] },
  { name: 'Embedded Systems & Electronics', head: 'Head of Embedded Systems', size: 5,
    positions: ['Embedded Software Engineer', 'Electronics Engineer', 'PCB Designer', 'Firmware Engineer'],
    skills: ['Embedded C', 'STM32', 'PCB design', 'Altium', 'FreeRTOS', 'CAN bus', 'Battery management'] },
  { name: 'Software & AI', head: 'Head of Software & AI', size: 6,
    positions: ['Software Engineer', 'Computer Vision Engineer', 'Full-Stack Developer', 'Data Scientist'],
    skills: ['Python', 'C++', 'ROS 2', 'OpenCV', 'PyTorch', 'React', 'Node.js', 'Docker', 'SLAM'] },
  { name: 'Production & Assembly', head: 'Production Manager', size: 5,
    positions: ['Assembly Technician', 'Production Planner', 'Supply Chain Officer', 'Workshop Technician'],
    skills: ['Assembly', 'Soldering', 'Lean manufacturing', 'ERP', 'Inventory management', 'Wiring'] },
  { name: 'Quality & Testing', head: 'Quality Manager', size: 4,
    positions: ['Test Engineer', 'Quality Engineer', 'Validation Technician'],
    skills: ['Test automation', 'ISO 9001', 'Field testing', 'Root cause analysis', 'Metrology'] },
  { name: 'Field Operations & Support', head: 'Field Operations Manager', size: 4,
    positions: ['Field Service Engineer', 'Support Technician', 'Deployment Specialist'],
    skills: ['Robot deployment', 'Customer support', 'Networking', 'Troubleshooting', 'Client training'] },
  { name: 'Sales & Business Development', head: 'Business Development Manager', size: 3,
    positions: ['Business Developer', 'Sales Engineer', 'Marketing Specialist'],
    skills: ['B2B sales', 'Public tenders', 'CRM', 'French', 'English', 'Arabic', 'Trade shows'] },
];

const RESOURCES = [
  ['PGuard Unit 01', 'robot', 'Outdoor security patrol robot, demo and test unit'],
  ['PGuard Unit 02', 'robot', 'Outdoor security patrol robot, demo and test unit'],
  ['PGuard Unit 03', 'robot', 'Field-test unit, drivetrain being serviced', 'maintenance'],
  ['Mini-Lab 01', 'robot', 'Research and education mobile robot platform'],
  ['Mini-Lab 02', 'robot', 'Research and education mobile robot platform'],
  ['Delivery Robot Prototype v2', 'prototype', 'Indoor delivery robot prototype'],
  ['Meeting Room A — Atlas', 'meetingRoom', '8 seats, screen and video-conference kit'],
  ['Meeting Room B — Orion', 'meetingRoom', '6 seats, whiteboard'],
  ['Board Room', 'meetingRoom', '16 seats, projector'],
  ['Hot Desk 1', 'desktop', 'Workstation in the open space'],
  ['Hot Desk 2', 'desktop', 'Workstation in the open space'],
  ['CAD Workstation', 'desktop', 'High-end GPU workstation for CAD and simulation'],
  ['Visitor Office', 'office', 'Private office for visitors and interviews'],
  ['Electronics Tool Kit', 'toolKit', 'Soldering station, multimeter, crimping tools'],
  ['Mechanical Tool Kit', 'toolKit', 'Torque wrenches, drivers, measuring tools'],
  ['Oscilloscope & Logic Analyzer Bench', 'testingEquipment', '4-channel scope and 16-channel logic analyzer'],
  ['Environmental Test Chamber', 'testingEquipment', 'Temperature and humidity chamber, recalibration in progress', 'maintenance'],
  ['LiDAR Calibration Rig', 'testingEquipment', 'Calibration target and turntable for LiDAR sensors'],
];

const MISSIONS = [
  ['PGuard deployment', 'Logistics platform, Radès'],
  ['Client demo', 'Technopole de Sousse'],
  ['Preventive maintenance visit', 'Industrial zone, Sfax'],
  ['Site survey for patrol robot', 'Solar plant, Tozeur'],
  ['Robotics trade show', 'Exhibition park, Le Kram, Tunis'],
  ['Operator training', 'Client warehouse, Bizerte'],
  ['Pilot installation', 'Port area, La Goulette'],
];

const LEAVE_WEIGHTS = [['Vacation Leave', 50], ['Sick Leave', 22], ['Personal Leave', 15], ['Emergency Leave', 8], ['Unpaid Leave', 5]];
const pickLeaveType = () => {
  let r = rand() * LEAVE_WEIGHTS.reduce((n, [, w]) => n + w, 0);
  for (const [type, w] of LEAVE_WEIGHTS) { if ((r -= w) < 0) return type; }
  return 'Vacation Leave';
};

// ---------------------------------------------------------------------------
// Builders
const usedEmails = new Set();
const usedPhones = new Set();
const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
const makeEmail = (first, last) => {
  let base = `${slug(first)}.${slug(last)}`;
  let email = `${base}@${DOMAIN}`;
  for (let i = 2; usedEmails.has(email); i++) email = `${base}${i}@${DOMAIN}`;
  usedEmails.add(email);
  return email;
};
const makePhone = () => {
  let phone;
  do { phone = `${pick(['2', '5', '9'])}${between(1000000, 9999999)}`; } while (usedPhones.has(phone));
  usedPhones.add(phone);
  return phone;
};
const makePerson = (gender) => {
  const first = pick(gender === 'F' ? FEMALE : MALE);
  return { first, last: pick(LAST), gender };
};

// Validates with Mongoose, then inserts raw so explicit createdAt values are kept.
const bulkInsert = async (Model, docs) => {
  if (docs.length === 0) return [];
  const prepared = [];
  for (const raw of docs) {
    const doc = new Model(raw);
    await doc.validate();
    const obj = doc.toObject({ depopulate: true });
    if (raw.createdAt) obj.createdAt = raw.createdAt;
    if (raw.updatedAt || raw.createdAt) obj.updatedAt = raw.updatedAt || raw.createdAt;
    prepared.push(obj);
  }
  await Model.collection.insertMany(prepared);
  return prepared;
};

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed a production database.');
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set in Backend/.env');

  await mongoose.connect(process.env.MONGO_URI);
  const dbName = mongoose.connection.db.databaseName;

  const existingUsers = await User.countDocuments();
  if (existingUsers > 0 && !RESET) {
    console.log(`Database "${dbName}" already has ${existingUsers} users. Re-run with --reset to wipe it and seed again.`);
    await mongoose.disconnect();
    process.exit(1);
  }
  if (RESET) {
    console.log(`Wiping HRMS collections in database "${dbName}"…`);
    for (const Model of [User, Department, LeaveRequest, Attendance, CalendarEvent, Resource, Notification, TeamChat]) {
      await Model.deleteMany({});
    }
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const users = [];
  const newUser = (fields) => {
    const user = {
      _id: new mongoose.Types.ObjectId(),
      phone: makePhone(),
      password: passwordHash,
      skills: [],
      profilePicture: '',
      ...fields,
    };
    user.personalEmail = user.personalEmail || `${slug(user.firstName)}.${slug(user.lastName)}@example.com`;
    users.push(user);
    return user;
  };
  const yearsAgo = (y, m = 0) => addDays(TODAY, -Math.round(y * 365 + m * 30));

  // --- Leadership and HR
  const ceo = newUser({ firstName: 'Karim', lastName: 'Sahnoun', email: `ceo@${DOMAIN}`, role: 'superAdmin', position: 'Chief Executive Officer', salary: 9500, hireDate: new Date('2014-03-03'), gender: 'M', skills: ['Leadership', 'Robotics', 'Strategy'] });
  usedEmails.add(ceo.email);
  const hrDept = { _id: new mongoose.Types.ObjectId(), name: 'Human Resources & Administration', managerId: null, employees: [] };
  const hr = newUser({ firstName: 'Leila', lastName: 'Mabrouk', email: `hr@${DOMAIN}`, role: 'admin', position: 'HR Manager', salary: 4200, hireDate: yearsAgo(7, 2), gender: 'F', departmentId: hrDept._id, skills: ['Recruitment', 'Payroll', 'Labour law'], personalEmail: MY_EMAIL || undefined });
  const hr2 = newUser({ ...(() => { const p = makePerson('M'); return { firstName: p.first, lastName: p.last, gender: 'M' }; })(), role: 'admin', position: 'HR Officer', salary: 3000, hireDate: yearsAgo(3, 4), departmentId: hrDept._id, skills: ['Onboarding', 'Training', 'Administration'] });
  hr2.email = makeEmail(hr2.firstName, hr2.lastName);
  usedEmails.add(hr.email);
  hrDept.employees = [hr._id, hr2._id];

  // --- Departments, managers and employees
  const departments = [hrDept];
  const teams = [];
  DEPARTMENTS.forEach((def, index) => {
    const deptId = new mongoose.Types.ObjectId();
    const mp = makePerson(chance(0.35) ? 'F' : 'M');
    const manager = newUser({
      firstName: mp.first, lastName: mp.last, gender: mp.gender,
      email: index === 0 ? `manager@${DOMAIN}` : makeEmail(mp.first, mp.last),
      role: 'manager', position: def.head, salary: between(42, 60) * 100,
      hireDate: yearsAgo(between(4, 9), between(0, 11)), departmentId: deptId,
      skills: sample(def.skills, 3).concat(['Team management']),
    });
    if (index === 0) usedEmails.add(manager.email);

    const members = [];
    for (let i = 0; i < def.size; i++) {
      const p = makePerson(chance(0.4) ? 'F' : 'M');
      const isDemo = index === 0 && i === 0;
      // One recent hire (index 0, i === def.size - 1) to test a small leave balance
      const recentHire = index === 0 && i === def.size - 1;
      members.push(newUser({
        firstName: p.first, lastName: p.last, gender: p.gender,
        email: isDemo ? `employee@${DOMAIN}` : makeEmail(p.first, p.last),
        role: 'employee', position: pick(def.positions), salary: between(14, 36) * 100,
        hireDate: recentHire ? addDays(TODAY, -between(100, 140)) : yearsAgo(between(1, 6), between(0, 11)),
        departmentId: deptId, managerId: manager._id, skills: sample(def.skills, between(2, 4)),
      }));
      if (isDemo) usedEmails.add(`employee@${DOMAIN}`);
    }
    departments.push({ _id: deptId, name: def.name, managerId: manager._id, employees: members.map((m) => m._id) });
    teams.push({ def, deptId, manager, members });
  });

  const demoEmployee = teams[0].members[0];
  const demoManager = teams[0].manager;
  const admins = [hr, hr2];
  const allEmployees = teams.flatMap((t) => t.members);

  // --- Leave requests
  const leaves = [];
  const leaveRanges = new Map(); // userId -> [[start, end]]
  const overlaps = (userId, start, end) =>
    (leaveRanges.get(String(userId)) || []).some(([s, e]) => start <= e && end >= s);
  const approverFor = (user) => {
    if (user.role === 'employee') return { approver: user.managerId, createdBy: 'Employee', final: 'Admin Approved', reject: 'Admin Rejected' };
    if (user.role === 'manager') return { approver: pick(admins)._id, createdBy: 'Manager', final: 'Admin Approved', reject: 'Admin Rejected' };
    return { approver: ceo._id, createdBy: 'Admin', final: 'CEO Approved', reject: 'CEO Rejected' };
  };
  const addLeave = (user, start, workdays, status, reason = pickLeaveType()) => {
    start = nextWorkday(startOfDay(start));
    const end = workdaysFrom(start, workdays);
    if (overlaps(user._id, start, end)) return null;
    const route = approverFor(user);
    const created = new Date(Math.min(addDays(start, -between(3, 20)).getTime(), NOW.getTime() - between(1, 48) * 3600e3));
    const leave = {
      _id: new mongoose.Types.ObjectId(),
      employeeId: user._id, managerId: route.approver, createdBy: route.createdBy,
      startDate: start, endDate: end, reason, status,
      adminId: ['Admin Approved', 'Admin Rejected'].includes(status) ? pick(admins)._id : undefined,
      createdAt: created, updatedAt: status === 'Pending' ? created : new Date(Math.min(addDays(created, between(1, 3)).getTime(), NOW.getTime())),
    };
    leaves.push(leave);
    leaveRanges.set(String(user._id), [...(leaveRanges.get(String(user._id)) || []), [start, end]]);
    return leave;
  };

  for (const user of users.filter((u) => u.role !== 'superAdmin')) {
    const route = approverFor(user);
    let budget = calculateAccruedLeaveDays(user.hireDate, user.role);

    // Past requests (last ~8 months)
    for (let i = 0, n = between(1, 3); i < n; i++) {
      const start = addDays(TODAY, -between(15, 240));
      if (start < user.hireDate) continue;
      const days = between(1, 5);
      const roll = rand();
      let status = roll < 0.8 ? route.final : roll < 0.9 ? (user.role === 'employee' ? 'Manager Rejected' : route.reject) : route.reject;
      if (status === route.final && days > budget) status = route.reject;
      const leave = addLeave(user, start, days, status);
      if (leave && status === route.final) budget -= countWorkingDays(leave.startDate, leave.endDate);
    }

    // Upcoming requests in various states
    if (chance(0.35)) addLeave(user, addDays(TODAY, between(5, 40)), Math.min(between(1, 5), Math.max(1, budget)), 'Pending');
    if (user.role === 'employee' && chance(0.18)) addLeave(user, addDays(TODAY, between(8, 45)), between(1, 4), 'Manager Approved');
    if (chance(0.12) && budget >= 3) addLeave(user, addDays(TODAY, between(10, 60)), 3, route.final, 'Vacation Leave');
  }

  // Guaranteed scenarios for the demo accounts and dashboards
  addLeave(demoEmployee, addDays(TODAY, 14), 3, 'Pending', 'Vacation Leave');           // manager@ has something to approve
  addLeave(teams[0].members[1], addDays(TODAY, 21), 2, 'Manager Approved', 'Personal Leave'); // hr@ has something to finalise
  addLeave(demoManager, addDays(TODAY, 30), 2, 'Pending', 'Vacation Leave');            // manager -> HR
  addLeave(hr2, addDays(TODAY, 25), 2, 'Pending', 'Personal Leave');                    // HR officer -> CEO
  if (!isWeekend(TODAY)) {
    // Two people on approved leave today, so "who is away" views have data
    for (const user of sample(allEmployees.slice(2), 2)) {
      const leave = { start: addDays(TODAY, -1), days: 3 };
      const route = approverFor(user);
      if (!overlaps(user._id, addDays(TODAY, -3), addDays(TODAY, 3))) addLeave(user, nextWorkday(leave.start) > TODAY ? TODAY : leave.start, leave.days, route.final, 'Sick Leave');
    }
  }

  const isOnLeave = (userId, day) => leaves.some((l) =>
    String(l.employeeId) === String(userId) && ['Admin Approved', 'CEO Approved'].includes(l.status) && day >= startOfDay(l.startDate) && day <= startOfDay(l.endDate));

  // --- Attendance: the last 45 working days (today is added further down)
  const attendance = [];
  const profiles = new Map(users.map((u) => [String(u._id), {
    punctuality: u.role === 'superAdmin' ? 0.95 : 0.72 + rand() * 0.26,
    early: rand() < 0.3,
    stayLate: rand() < 0.35,
  }]));
  let day = addDays(TODAY, -1);
  let counted = 0;
  while (counted < 45) {
    if (!isWeekend(day)) {
      counted++;
      for (const user of users) {
        if (day < startOfDay(user.hireDate) || isOnLeave(user._id, day)) continue;
        const profile = profiles.get(String(user._id));
        if (chance(0.025)) {
          attendance.push({ userId: user._id, date: day, sessionNumber: 1, status: 'Absent', productionHours: 0 });
          continue;
        }
        const late = !chance(profile.punctuality);
        const checkIn = late ? at(day, 8, 31 + between(0, 55)) : at(day, profile.early ? 7 : 8, profile.early ? between(35, 59) : between(0, 29));
        const leaveAt = at(day, profile.stayLate && chance(0.6) ? 18 : 17, profile.stayLate ? between(5, 59) : between(0, 59));
        const split = chance(0.05); // site visit: two sessions
        const sessions = split
          ? [[checkIn, at(day, 11, between(0, 30))], [at(day, 14, between(0, 30)), leaveAt]]
          : [[checkIn, leaveAt]];

        sessions.forEach(([inTime, outTime], idx) => {
          const breaks = [];
          if (!split && chance(0.85)) {
            const bStart = at(day, 12, 30 + between(0, 40));
            const duration = between(30, 75);
            breaks.push({ startTime: bStart, endTime: new Date(bStart.getTime() + duration * 60000), duration });
          }
          const earlyBy = idx === 0 && inTime < at(day, 8) ? minutes(inTime, at(day, 8)) : 0;
          const lateBy = idx === 0 && inTime > at(day, 8, 30) ? minutes(at(day, 8, 30), inTime) : 0;
          const overtime = earlyBy + (outTime > at(day, 18) ? minutes(at(day, 18), outTime) : 0);
          const worked = minutes(inTime, outTime) - breaks.reduce((n, b) => n + b.duration, 0);
          attendance.push({
            userId: user._id, date: day, sessionNumber: idx + 1, checkIn: inTime, checkOut: outTime,
            status: idx === 0 ? (lateBy > 0 ? 'Late' : 'Present') : (lateBy > 0 ? 'Late' : 'Present'),
            breaks, earlyBy, lateBy, overtime, productionHours: Number((Math.max(0, worked) / 60).toFixed(2)),
            source: chance(0.2) ? 'mobile' : 'web',
          });
        });
      }
    }
    day = addDays(day, -1);
  }

  // --- Today so far, so the Today view's "On the floor" has people on it.
  // The demo accounts are left unpunched so you can punch in yourself.
  const DEMO_EMAILS = new Set(['ceo', 'hr', 'manager', 'employee'].map((n) => `${n}@${DOMAIN}`));
  if (!isWeekend(TODAY)) {
    for (const user of users) {
      if (DEMO_EMAILS.has(user.email) || isOnLeave(user._id, TODAY) || TODAY < startOfDay(user.hireDate) || chance(0.08)) continue;
      const profile = profiles.get(String(user._id));
      const late = !chance(profile.punctuality);
      const checkIn = late ? at(TODAY, 8, 31 + between(0, 40)) : at(TODAY, profile.early ? 7 : 8, profile.early ? between(35, 59) : between(0, 29));
      if (checkIn > NOW) continue; // not in yet
      const lateBy = late ? minutes(at(TODAY, 8, 30), checkIn) : 0;
      const breaks = [];
      const bStart = at(TODAY, 12, 30 + between(0, 30));
      if (NOW > bStart && chance(0.85)) {
        const duration = between(30, 60);
        const bEnd = new Date(bStart.getTime() + duration * 60000);
        breaks.push(NOW > bEnd ? { startTime: bStart, endTime: bEnd, duration } : { startTime: bStart });
      }
      const goneHome = NOW > at(TODAY, 17, 30) && chance(0.7);
      const checkOut = goneHome ? at(TODAY, 17, between(30, 59)) : undefined;
      attendance.push({
        userId: user._id, date: TODAY, sessionNumber: 1, checkIn, checkOut,
        status: lateBy > 0 ? 'Late' : 'Present', breaks, lateBy,
        earlyBy: checkIn < at(TODAY, 8) ? minutes(checkIn, at(TODAY, 8)) : 0,
        overtime: 0, productionHours: 0, source: chance(0.2) ? 'mobile' : 'web',
      });
    }
  }

  // --- Resources
  const resources = RESOURCES.map(([name, type, description, status]) => ({
    _id: new mongoose.Types.ObjectId(), name, type, description, status: status || 'available',
    createdAt: addDays(TODAY, -between(200, 900)),
  }));
  const bookable = resources.filter((r) => r.status === 'available');

  // --- Calendar events
  const events = [];
  const resourceSlots = new Map();
  const approval = (status, by = pick(admins)) => (status === 'approved'
    ? { approvedBy: by._id, approvedAt: NOW }
    : status === 'declined' ? { declinedBy: by._id, declinedAt: NOW } : {});
  const responses = (people, past) => people.map((p) => ({
    userId: p._id,
    status: past ? (chance(0.88) ? 'accepted' : 'declined') : pick(['pending', 'pending', 'accepted', 'accepted', 'declined']),
  }));
  const addEvent = (e) => { events.push({ _id: new mongoose.Types.ObjectId(), createdAt: addDays(e.startDateTime, -between(2, 10)), ...e }); return events[events.length - 1]; };

  // Weekly department syncs, Mondays from 4 weeks ago to 4 weeks ahead
  const firstMonday = addDays(TODAY, -((TODAY.getDay() + 6) % 7) - 28);
  for (let w = 0; w < 9; w++) {
    const monday = addDays(firstMonday, w * 7);
    teams.forEach((team, i) => {
      const start = at(monday, 9 + (i % 3), i % 2 ? 30 : 0);
      addEvent({
        title: `${team.def.name}: weekly sync`, eventType: 'meeting', startDateTime: start, endDateTime: new Date(start.getTime() + 45 * 60000),
        createdBy: team.manager._id, visibility: 'department', status: 'approved', departmentId: team.deptId,
        description: 'Weekly progress review, blockers and priorities.', location: i % 2 ? 'Meeting Room B — Orion' : 'Meeting Room A — Atlas',
        usersInvolved: responses(team.members, monday < TODAY), adminActions: approval('approved'),
      });
    });
  }

  // Monthly all-hands
  for (const offset of [-25, 5]) {
    const date = nextWorkday(addDays(TODAY, offset));
    addEvent({
      title: 'All-hands meeting', eventType: 'meeting', startDateTime: at(date, 15), endDateTime: at(date, 16),
      createdBy: ceo._id, visibility: 'public', status: 'approved', description: 'Company results, product roadmap and Q&A with the CEO.',
      location: 'Board Room', usersInvolved: responses(teams.map((t) => t.manager).concat(admins), offset < 0), adminActions: approval('approved', ceo),
    });
  }

  // Missions
  const fieldTeam = teams.find((t) => t.def.name.startsWith('Field')).members.concat(teams.find((t) => t.def.name.startsWith('Sales')).members);
  MISSIONS.forEach(([title, destination], i) => {
    const start = at(nextWorkday(addDays(TODAY, -30 + i * 9 + between(0, 3))), 8);
    const end = at(workdaysFrom(start, between(1, 3)), 17);
    const creator = pick(fieldTeam);
    const past = end < NOW;
    const status = past ? 'approved' : pick(['pending', 'approved', 'approved', 'declined']);
    addEvent({
      title: `${title}`, eventType: 'mission', startDateTime: start, endDateTime: end, createdBy: creator._id,
      visibility: 'department', status, departmentId: creator.departmentId,
      description: `${title} at ${destination}. Bring the deployment checklist and spare batteries.`, destination,
      usersInvolved: responses(sample(fieldTeam.filter((p) => p !== creator), between(1, 2)), past), adminActions: approval(status),
    });
  });

  // Resource reservations without double booking
  const reserve = (creator, resource, start, durationMin, status, title) => {
    const end = new Date(start.getTime() + durationMin * 60000);
    const slots = resourceSlots.get(String(resource._id)) || [];
    if (slots.some(([s, e]) => start < e && end > s)) return null;
    resourceSlots.set(String(resource._id), [...slots, [start, end]]);
    return addEvent({
      title, eventType: 'resourceReservation', startDateTime: start, endDateTime: end, createdBy: creator._id,
      visibility: 'public', status, departmentId: creator.departmentId, resource: resource._id,
      description: `Reserved for: ${title.toLowerCase()}`, usersInvolved: [], adminActions: approval(status),
    });
  };
  for (let i = 0; i < 26; i++) {
    const resource = pick(bookable);
    const creator = pick(allEmployees.concat(teams.map((t) => t.manager)));
    const date = nextWorkday(addDays(TODAY, between(-20, 25)));
    const start = at(date, between(9, 15), pick([0, 30]));
    const status = start < NOW ? 'approved' : pick(['approved', 'approved', 'pending']);
    const label = resource.type === 'robot' || resource.type === 'prototype' ? `Test session on ${resource.name}`
      : resource.type === 'meetingRoom' ? 'Client call' : `Using ${resource.name}`;
    reserve(creator, resource, start, pick([60, 90, 120, 180]), status, label);
  }

  // Demo scenarios
  const demoStart = at(nextWorkday(addDays(TODAY, 2)), 10);
  addEvent({ // demo employee created a meeting that HR still has to approve, inviting their manager
    title: 'Gripper design review', eventType: 'meeting', startDateTime: demoStart, endDateTime: new Date(demoStart.getTime() + 60 * 60000),
    createdBy: demoEmployee._id, visibility: 'private', status: 'pending', departmentId: demoEmployee.departmentId,
    description: 'Review of the new gripper CAD before ordering parts.', location: 'Meeting Room B — Orion',
    usersInvolved: [{ userId: demoManager._id, status: 'pending' }, { userId: teams[0].members[2]._id, status: 'accepted' }], adminActions: {},
  });
  const inviteStart = at(nextWorkday(addDays(TODAY, 3)), 14);
  addEvent({ // demo employee has an invitation to answer
    title: 'LiDAR calibration workshop', eventType: 'meeting', startDateTime: inviteStart, endDateTime: new Date(inviteStart.getTime() + 90 * 60000),
    createdBy: teams[2].manager._id, visibility: 'public', status: 'approved', description: 'Hands-on session on the new calibration procedure.',
    location: 'Testing area', usersInvolved: [{ userId: demoEmployee._id, status: 'pending' }, { userId: teams[2].members[0]._id, status: 'accepted' }],
    adminActions: approval('approved'),
  });
  reserve(demoEmployee, resources.find((r) => r.name === 'PGuard Unit 01'), at(nextWorkday(addDays(TODAY, 4)), 9), 180, 'pending', 'Obstacle-avoidance field test');

  // --- Team chat
  const chats = [];
  const conversation = (a, b, lines, startHoursAgo, unreadForLast = true) => {
    lines.forEach((text, i) => {
      const fromA = i % 2 === 0;
      const createdAt = new Date(NOW.getTime() - (startHoursAgo - i * 0.4) * 3600e3);
      chats.push({
        sender: fromA ? a._id : b._id, receiver: fromA ? b._id : a._id, message: text,
        isRead: !(unreadForLast && i === lines.length - 1), createdAt, updatedAt: createdAt,
      });
    });
  };
  conversation(demoEmployee, demoManager, [
    'Hi! The new gripper parts arrived this morning.',
    'Great news. Can you run the first assembly tests this week?',
    'Yes, I booked PGuard Unit 01 for a field test on Thursday.',
    'Perfect. Send me the results before Friday\'s sync.',
    'Will do. I also submitted a leave request for later this month, could you have a look?',
  ], 26);
  conversation(demoManager, hr, [
    'Hello Leila, we need to plan the onboarding of our new CAD technician.',
    'Sure, I will prepare the welcome pack and the account. Which day suits you?',
    'Monday morning would be ideal.',
  ], 50, false);
  conversation(hr, ceo, [
    'Karim, the Q3 attendance report is ready for review.',
    'Thanks, I will look at it before the all-hands.',
  ], 70, false);
  conversation(teams[0].members[2], demoEmployee, [
    'Are you joining the LiDAR workshop?',
    'Probably, I still need to accept the invite.',
    'Ok, see you there!',
  ], 8);

  // --- Notifications (recent, within the 30-day retention)
  const notifications = [];
  const notify = (recipient, title, message, type, relatedId, isRead) => {
    const createdAt = new Date(NOW.getTime() - between(1, 20 * 24) * 3600e3);
    notifications.push({ recipient, title, message, type, relatedId, isRead, createdAt });
  };
  const byId = new Map(users.map((u) => [String(u._id), u]));
  const name = (u) => `${u.firstName} ${u.lastName}`;
  const range = (l) => `${l.startDate.toLocaleDateString()} to ${l.endDate.toLocaleDateString()}`;
  for (const l of leaves) {
    const requester = byId.get(String(l.employeeId));
    if (l.status === 'Pending') {
      notify(l.managerId, 'New Leave Request', `${name(requester)} has requested leave from ${range(l)}.`, 'leave_request', l._id, false);
    } else if (l.updatedAt > addDays(NOW, -20)) {
      const approved = l.status.endsWith('Approved');
      notify(l.employeeId, `Leave Request ${approved ? 'Approved' : 'Rejected'}`, `Your leave request from ${range(l)} has been ${approved ? 'approved' : 'rejected'} (${l.status}).`, approved ? 'leave_approved' : 'leave_rejected', l._id, chance(0.6));
    }
  }
  for (const e of events.filter((ev) => ev.startDateTime > NOW)) {
    for (const p of e.usersInvolved.filter((u) => u.status === 'pending')) {
      notify(p.userId, `New ${e.eventType} Invitation`, `You have been invited to "${e.title}" on ${e.startDateTime.toLocaleDateString()}.`, 'event_invitation', e._id, false);
    }
    if (e.status === 'pending') {
      admins.forEach((a) => notify(a._id, 'New Event Created', `${name(byId.get(String(e.createdBy)))} created "${e.title}", which needs approval.`, 'event', e._id, false));
    }
  }

  // --- Write everything
  console.log('Writing data…');
  await bulkInsert(User, users.map(({ gender, ...u }) => ({ ...u, createdAt: u.hireDate }))); // gender is only used for generation
  await bulkInsert(Department, departments.map((d) => ({ ...d, createdAt: addDays(TODAY, -900) })));
  await bulkInsert(Resource, resources);
  await bulkInsert(LeaveRequest, leaves);
  await Attendance.collection.insertMany(attendance.map((a) => ({ earlyBy: 0, lateBy: 0, overtime: 0, breaks: [], ...a })));
  await bulkInsert(CalendarEvent, events);
  await bulkInsert(TeamChat, chats);
  await bulkInsert(Notification, notifications);

  // Balances are always recomputed from approved requests
  for (const user of users) await updateUserLeaveBalance(user._id);

  const demo = await User.findById(demoEmployee._id).lean();
  console.log(`
Seeded database "${dbName}":
  ${users.length} users in ${departments.length} departments, ${resources.length} resources
  ${leaves.length} leave requests, ${attendance.length} attendance records, ${events.length} calendar events
  ${chats.length} chat messages, ${notifications.length} notifications

Sign in at http://localhost:5173 with password: ${PASSWORD}

  Role                 Email                    Notes
  CEO (superAdmin)     ceo@${DOMAIN}           reviews HR's own leave requests
  HR admin             hr@${DOMAIN}            final leave approvals, event approvals, employee admin${MY_EMAIL ? `\n                                                personal email set to ${MY_EMAIL} (password reset emails go there)` : ''}
  Manager              manager@${DOMAIN}       leads ${teams[0].def.name}; has a pending request to approve
  Employee             employee@${DOMAIN}      ${name(demoEmployee)}; ${demo.remainingLeaveDays} leave days left, pending request + invitation

Every other person uses firstname.lastname@${DOMAIN} with the same password.
`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Seeding failed:', err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
