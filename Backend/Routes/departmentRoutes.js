const express = require('express');
const router = express.Router();
const departmentController = require('../Controllers/departmentController');
const authMiddleware = require('../Middlewares/authMiddleware');
const roleMiddleware = require('../Middlewares/roleMiddleware');

router.use(authMiddleware);

const admins = roleMiddleware('admin');

// Department names and members are directory information visible to every signed-in user.
router.get('/', departmentController.getAllDepartments);
router.get('/available-managers', admins, departmentController.getAvailableManagers);
router.get('/assignable-employees', admins, departmentController.getAssignableEmployees);

router.post('/', admins, departmentController.createDepartment);
router.put('/:id', admins, departmentController.updateDepartment);
router.delete('/:id', admins, departmentController.deleteDepartment);

module.exports = router;
