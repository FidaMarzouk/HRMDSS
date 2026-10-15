const { body, validationResult } = require('express-validator');

// Validation rules for adding a user
const addUserValidationRules = [
  body('firstName')
    .notEmpty().withMessage('First name is required.')
    .matches(/^[\p{L}\s'-]+$/u).withMessage('First name should only contain letters.'),
  
  body('lastName')
    .notEmpty().withMessage('Last name is required.')
    .matches(/^[\p{L}\s'-]+$/u).withMessage('Last name should only contain letters.'),
  
  body('email')
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Invalid email format.'),
  
  body('phone')
    .notEmpty().withMessage('Phone number is required.')
    .matches(/^\d+$/).withMessage('Phone number should only contain numbers.'),
  
  body('password')
    .optional({ values: 'falsy' })
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
  
  body('role')
    .notEmpty().withMessage('Role is required.'),
  
  body('personalEmail')
    .notEmpty().withMessage('Personal email is required.')
    .isEmail().withMessage('Invalid personal email format.'),
  
  body('salary')
    .notEmpty().withMessage('Salary is required.')
    .isFloat({ min: 0.01 }).withMessage('Salary must be a positive number greater than zero.'),
    body('hireDate')
    .notEmpty().withMessage('Hire date is required.')
    .custom(value => {
      const hireDate = new Date(value);
      const today = new Date();
      
      // Remove time part for comparison (set to midnight)
      today.setHours(0, 0, 0, 0);
      
      if (hireDate > today) {
        throw new Error('Hire date cannot be in the future.');
      }
      return true;
    }),
];

// Validation rules for updating a user
const updateUserValidationRules = [
  body('firstName')
    .optional()
    .matches(/^[\p{L}\s'-]+$/u).withMessage('First name should only contain letters.'),
  
  body('lastName')
    .optional()
    .matches(/^[\p{L}\s'-]+$/u).withMessage('Last name should only contain letters.'),
  
  body('email')
    .optional()
    .isEmail().withMessage('Invalid email format.'),
  
  body('phone')
    .optional()
    .matches(/^\d+$/).withMessage('Phone number should only contain numbers.'),
  
  body('password')
    .optional()
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.'),
  
  body('personalEmail')
    .optional()
    .isEmail().withMessage('Invalid personal email format.'),
  
  body('salary')
    .optional()
    .isFloat({ min: 0.01 }).withMessage('Salary must be a positive number greater than zero.'),

    body('hireDate')
    .optional()
    .custom(value => {
      const hireDate = new Date(value);
      const today = new Date();
      
      // Remove time part for comparison (set to midnight)
      today.setHours(0, 0, 0, 0);
      
      if (hireDate > today) {
        throw new Error('Hire date cannot be in the future.');
      }
      return true;
    }),
];

// Validation rules for updating user profile
const updateProfileValidationRules = [
  body('firstName')
    .optional()
    .matches(/^[\p{L}\s'-]+$/u).withMessage('First name should only contain letters.'),
  
  body('lastName')
    .optional()
    .matches(/^[\p{L}\s'-]+$/u).withMessage('Last name should only contain letters.'),
  
  body('personalEmail')
    .optional()
    .isEmail().withMessage('Invalid personal email format.'),
  
  body('phone')
    .optional()
    .matches(/^\d+$/).withMessage('Phone number should only contain numbers.'),
  
  body('password')
    .optional()
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long.')
];

// Middleware to handle validation errors
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

module.exports = {
  addUserValidationRules,
  updateUserValidationRules,
  updateProfileValidationRules,
  validate
};