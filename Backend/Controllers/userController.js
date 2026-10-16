const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../Models/User');
const Department = require('../Models/Department');
const leaveHelper = require('../Middlewares/leaveCalculationHelper');
const emailService = require('../services/emailService');
const { ACCOUNT_SETUP_TTL_MS, issuePasswordToken, passwordLink } = require('../utils/passwordTokens');
const { mergeSkillNames } = require('../utils/skills');
const audit = require('../services/audit');

// Fields a manager may see about their team (no salary, personal email, birthdate...).
const TEAM_SAFE_FIELDS = 'firstName lastName email phone position departmentId managerId hireDate skills role profilePicture leaveRequestAllowed remainingLeaveDays';

// Fields users may change on their own profile.
const SELF_EDITABLE_FIELDS = ['firstName', 'lastName', 'phone', 'personalEmail', 'skills', 'birthdate'];

const parseSkills = (skills) => {
  if (Array.isArray(skills)) return skills;
  if (typeof skills !== 'string') return undefined;
  try {
    const parsed = JSON.parse(skills);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // comma-separated string
  }
  return skills.split(',').map((s) => s.trim()).filter(Boolean);
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const updateData = {};
    for (const field of SELF_EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }
    if (updateData.skills !== undefined) {
      const current = await User.findById(userId).select('skills');
      updateData.skills = mergeSkillNames(current?.skills, parseSkills(updateData.skills) || []);
    }
    if (req.file) {
      updateData.profilePicture = `/uploads/${req.file.filename}`;
    }

    // Changing the password requires the current one.
    if (req.body.password) {
      if (!req.body.currentPassword) {
        return res.status(400).json({ message: 'Please enter your current password to set a new one.' });
      }
      const user = await User.findById(userId).select('+password');
      const matches = user && await bcrypt.compare(req.body.currentPassword, user.password);
      if (!matches) {
        return res.status(400).json({ message: 'Your current password is incorrect.' });
      }
      updateData.password = await bcrypt.hash(req.body.password, 10);
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true, runValidators: true })
      .populate('departmentId', 'name');

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate({ path: 'departmentId', select: 'name' })
      .populate({ path: 'managerId', select: 'firstName lastName email' });

    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(user);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getRemainingLeaveDays = async (req, res) => {
  try {
    const balance = await leaveHelper.updateUserLeaveBalance(req.user.id);
    res.json({ remainingLeaveDays: balance.remainingDays, ...balance });
  } catch (err) {
    console.error('Error fetching remaining leave days:', err);
    res.status(500).json({ message: "Server error" });
  }
};

// Create a new user (admin only)
exports.createUser = async (req, res) => {
  try {
    const {
      firstName, lastName, email, phone, position, departmentId,
      hireDate, salary, skills, password, role, personalEmail,
    } = req.body;

    if (await User.exists({ email })) {
      return res.status(400).json({ message: "User with this email already exists" });
    }
    if (await User.exists({ phone })) {
      return res.status(400).json({ message: "User with this phone number already exists" });
    }

    let managerId;
    if (role === "employee" && departmentId) {
      const department = await Department.findById(departmentId, { managerId: 1 });
      if (!department || !department.managerId) {
        return res.status(400).json({
          message: "The selected department does not have a manager assigned. Please assign a manager to the department first."
        });
      }
      managerId = department.managerId;
    }

    const accrued = leaveHelper.calculateAccruedLeaveDays(hireDate, role);

    // Without an admin-chosen password the account gets an unguessable one;
    // the user sets their own through the emailed setup link.
    const initialPassword = password || crypto.randomBytes(24).toString('hex');

    const user = new User({
      firstName,
      lastName,
      email,
      phone,
      position,
      departmentId: departmentId || undefined,
      managerId,
      hireDate,
      salary,
      skills: parseSkills(skills) || [],
      password: await bcrypt.hash(initialPassword, 10),
      role,
      leaveRequestAllowed: accrued,
      remainingLeaveDays: accrued,
      profilePicture: req.file ? `/uploads/${req.file.filename}` : "",
      personalEmail,
    });
    const setupToken = issuePasswordToken(user, ACCOUNT_SETUP_TTL_MS);
    const savedUser = await user.save();

    if (departmentId) {
      if (role === "manager") {
        await Department.findByIdAndUpdate(departmentId, { managerId: savedUser._id });
      } else if (role === "employee") {
        await Department.findByIdAndUpdate(departmentId, { $addToSet: { employees: savedUser._id } });
      }
    }

    // Email is best-effort; account creation already succeeded.
    emailService.sendAccountSetupEmail({
      email: savedUser.personalEmail || savedUser.email,
      firstName: savedUser.firstName,
      loginEmail: savedUser.email,
      setupUrl: passwordLink(setupToken),
    }).catch((emailError) => console.error("Error sending welcome email:", emailError));

    await audit.record({
      actor: req.user,
      action: 'user.create',
      entity: 'User',
      entityId: savedUser._id,
      subject: savedUser._id,
      summary: `${savedUser.firstName} ${savedUser.lastName} added as ${savedUser.position}`,
      req,
    });

    const result = savedUser.toObject();
    delete result.password;
    delete result.salary;
    delete result.passwordResetTokenHash;
    delete result.passwordResetExpires;
    return res.status(201).json({ message: "User created successfully", user: result });
  } catch (err) {
    console.error("Error creating user:", err);
    if (err.name === 'ValidationError') {
      const errorMessages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ message: errorMessages.join(', ') });
    }
    return res.status(500).json({ message: "Server error" });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const userRole = req.user.role;

    if (userRole === 'admin' || userRole === 'superAdmin') {
      // Salary is never listed; it is revealed one person at a time (audited).
      const status = userRole === 'admin' && req.query.status === 'archived' ? { status: 'archived' } : User.ACTIVE;
      const users = await User.find({ ...status, role: { $nin: ['admin', 'superAdmin'] } })
        .select('-salary')
        .populate({ path: "departmentId", select: "name" })
        .populate({ path: "managerId", select: "firstName lastName" });
      return res.status(200).json({ users });
    }

    if (userRole === 'manager') {
      const employees = await User.find({ ...User.ACTIVE, managerId: req.user.id })
        .select(TEAM_SAFE_FIELDS)
        .populate('departmentId', 'name');
      return res.status(200).json({ employees });
    }

    return res.status(403).json({ message: 'Unauthorized access: Insufficient permissions' });
  } catch (err) {
    console.error('Error retrieving users:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update user (admin only)
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updateData = { ...req.body };
    // Never accept these from the request body.
    delete updateData.passwordResetTokenHash;
    delete updateData.passwordResetExpires;
    delete updateData.leaveRequestAllowed;
    delete updateData.remainingLeaveDays;
    // Archiving has its own audited endpoint (POST /api/people/:id/archive).
    delete updateData.status;
    delete updateData.archivedAt;
    delete updateData.archivedBy;
    delete updateData.archiveReason;
    // Salary is not sent to the edit form; an empty field keeps the current value.
    if (updateData.salary === '' || updateData.salary === undefined || updateData.salary === null) delete updateData.salary;

    let newLoginEmail = null;
    let passwordChanged = false;

    if (updateData.email && updateData.email !== user.email) {
      if (await User.exists({ email: updateData.email })) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }
      newLoginEmail = updateData.email;
    }
    if (updateData.phone && updateData.phone !== user.phone) {
      if (await User.exists({ phone: updateData.phone, _id: { $ne: id } })) {
        return res.status(400).json({ message: 'User with this phone number already exists' });
      }
    }

    if (req.file) {
      updateData.profilePicture = `/uploads/${req.file.filename}`;
    }

    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
      passwordChanged = true;
    } else {
      delete updateData.password;
    }

    if (updateData.departmentId) {
      await handleDepartmentChange(id, user, updateData);
    } else {
      delete updateData.departmentId;
      delete updateData.managerId;
    }

    if (updateData.skills !== undefined) {
      updateData.skills = mergeSkillNames(user.skills, parseSkills(updateData.skills) || []);
    }

    const before = await User.findById(id).select('+salary').lean();
    await User.findByIdAndUpdate(id, updateData, { new: true });

    const changes = audit.diff(before, { ...updateData, ...(passwordChanged ? { password: 'changed' } : {}) }, [
      'firstName', 'lastName', 'email', 'personalEmail', 'phone', 'position', 'departmentId', 'managerId',
      'hireDate', 'salary', 'skills', 'role', 'profilePicture', 'password',
    ]);
    if (changes.length) {
      await audit.record({
        actor: req.user,
        action: 'user.update',
        entity: 'User',
        entityId: user._id,
        subject: user._id,
        summary: `Profile of ${user.firstName} ${user.lastName} edited: ${audit.describeChanges(changes)}`,
        changes,
        req,
      });
    }

    // Hire date or role changes affect accrual: recompute from approved requests.
    const hireDateChanged = updateData.hireDate &&
      new Date(updateData.hireDate).getTime() !== new Date(user.hireDate).getTime();
    const roleChanged = updateData.role && updateData.role !== user.role;
    if (hireDateChanged || roleChanged) {
      await leaveHelper.updateUserLeaveBalance(id);
    }

    const updatedUser = await User.findById(id)
      .select('-salary')
      .populate('departmentId', 'name employees')
      .populate('managerId', 'firstName lastName');

    if (newLoginEmail || passwordChanged) {
      emailService.sendCredentialUpdateNotification({
        email: updatedUser.personalEmail || updatedUser.email,
        firstName: updatedUser.firstName,
        newLoginEmail,
        passwordChanged,
      }).catch((error) => console.error("Error sending credential update email:", error));
    }

    res.status(200).json({ message: 'User updated successfully', user: updatedUser });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Keeps department membership and manager links consistent when a user moves.
async function handleDepartmentChange(userId, user, updateData) {
  const newDepartment = await Department.findById(updateData.departmentId);
  const oldDepartmentId = user.departmentId ? user.departmentId.toString() : null;
  const newDepartmentId = updateData.departmentId.toString();

  if (updateData.role === 'manager' || (user.role === 'manager' && updateData.role !== 'employee')) {
    if (oldDepartmentId && oldDepartmentId !== newDepartmentId) {
      const oldDepartment = await Department.findById(oldDepartmentId);
      if (oldDepartment && oldDepartment.managerId && oldDepartment.managerId.toString() === userId) {
        await Promise.all([
          Department.findByIdAndUpdate(oldDepartmentId, { managerId: null, $pull: { employees: userId } }),
          User.updateMany({ departmentId: oldDepartmentId, managerId: userId }, { managerId: null })
        ]);
      }
    }

    if (!oldDepartmentId || oldDepartmentId !== newDepartmentId) {
      await Promise.all([
        Department.findByIdAndUpdate(newDepartmentId, { managerId: userId }),
        User.updateMany({ departmentId: newDepartmentId, role: { $ne: 'manager' } }, { managerId: userId })
      ]);
    }

    // Managers don't have managers
    delete updateData.managerId;
  } else {
    updateData.managerId = newDepartment && newDepartment.managerId ? newDepartment.managerId : null;

    if (oldDepartmentId && oldDepartmentId !== newDepartmentId) {
      await Promise.all([
        Department.findByIdAndUpdate(oldDepartmentId, { $pull: { employees: userId } }),
        Department.findByIdAndUpdate(newDepartmentId, { $addToSet: { employees: userId } })
      ]);
    } else if (!oldDepartmentId) {
      await Department.findByIdAndUpdate(newDepartmentId, { $addToSet: { employees: userId } });
    }
  }
}

exports.getCurrentUser = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: currentUser._id,
      _id: currentUser._id,
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      email: currentUser.email,
      profilePicture: currentUser.profilePicture,
      position: currentUser.position,
      role: currentUser.role
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
