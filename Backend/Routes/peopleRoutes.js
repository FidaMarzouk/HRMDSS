const express = require('express');
const { getPerson, revealSalary, updateSkills, archive, restore, getHistory } = require('../Controllers/peopleController');
const authMiddleware = require('../Middlewares/authMiddleware');
const roleMiddleware = require('../Middlewares/roleMiddleware');

// Profiles are scoped in the controller (policies.canSeePerson).
const router = express.Router();
router.use(authMiddleware);

router.get('/:id', getPerson);
router.get('/:id/history', getHistory);
router.get('/:id/salary', roleMiddleware(['admin', 'superAdmin']), revealSalary);
router.put('/:id/skills', roleMiddleware(['admin', 'manager']), updateSkills);
router.post('/:id/archive', roleMiddleware('admin'), archive);
router.post('/:id/restore', roleMiddleware('admin'), restore);

module.exports = router;
