// Who must act on something a person asks for (leave, attendance corrections).
// Derived server-side so requesters cannot route a request to an approver of
// their choice:  employee -> their manager, manager -> an HR administrator,
// HR administrator -> the CEO.
const User = require('../Models/User');

const resolveApprover = async (user) => {
  switch (user.role) {
    case 'employee':
      return user.managerId ? User.findOne({ _id: user.managerId, ...User.ACTIVE }).select('firstName lastName role') : null;
    case 'manager':
      return User.findOne({ ...User.ACTIVE, role: 'admin' }).select('firstName lastName role');
    case 'admin':
      return User.findOne({ ...User.ACTIVE, role: 'superAdmin' }).select('firstName lastName role');
    default:
      return null;
  }
};

module.exports = { resolveApprover };
