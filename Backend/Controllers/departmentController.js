const mongoose = require("mongoose"); 
const Department = require('../Models/Department');
const User = require('../Models/User');

// Get all departments 
exports.getAllDepartments = async (req, res, next) => {
  try {
    const departments = await Department.find()
      .populate({
        path: 'managerId',
        select: 'firstName lastName email' // Get manager details
      })
      .populate({
        path: 'employees',
        select: 'firstName lastName email position' // Get employees in department
      });

    // Calculate employee count for each department
    const departmentsWithCounts = departments.map(dept => {
      const deptObj = dept.toObject();
      deptObj.employeeCount = dept.employees ? dept.employees.length : 0;
      return deptObj;
    });

    res.status(200).json(departmentsWithCounts);
  } catch (err) {
    console.error('Error fetching departments:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
// Create department 
exports.createDepartment = async (req, res, next) => {
  try {
    const { name, managerId, employeeIds } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Department name is required" });
    }

    // Ensure unique department name
    const existingDepartment = await Department.findOne({ name });
    if (existingDepartment) {
      return res.status(400).json({ message: "Department name already exists" });
    }

    // Create the department first (without manager or employees)
    const newDepartment = new Department({
      name,
      managerId: null,
      employees: []
    });
    
    // Handle manager assignment if provided
    if (managerId) {
      const manager = await User.findById(managerId);
      if (!manager || manager.role !== 'manager') {
        return res.status(400).json({ message: "The selected manager is not a manager" });
      }

      // Check if manager is already assigned to another department
      const previousDepartment = await Department.findOne({ managerId: managerId });
      if (previousDepartment) {
        // Remove manager from previous department
        previousDepartment.managerId = null;
        await previousDepartment.save();
      }

      // Assign manager to new department
      newDepartment.managerId = managerId;
    }

    // Handle employee assignments if provided
    if (employeeIds && Array.isArray(employeeIds) && employeeIds.length > 0) {
      // Get all users with the provided IDs
      const usersToAdd = await User.find({ _id: { $in: employeeIds } });
      // Filter out users that are not employees
      const employeeOnlyUsers = usersToAdd.filter(user => user.role === 'employee');
      // Get employee IDs
      let employeeOnlyIds = employeeOnlyUsers.map(user => user._id);
     
      // Explicitly filter out the manager ID from the employees array
      if (managerId) {
        employeeOnlyIds = employeeOnlyIds.filter(id => id.toString() !== managerId.toString());
      }
     
      // Get unique previous departments (excluding null)
      const previousDepartmentIds = [...new Set(
        employeeOnlyUsers
          .map(emp => emp.departmentId?.toString())
          .filter(deptId => deptId)
      )];

      // Remove these employees from previous departments' employee arrays
      for (const prevDeptId of previousDepartmentIds) {
        const prevDept = await Department.findById(prevDeptId);
        if (prevDept) {
          // Find employees moving from this prev department to the new one
          const movingEmployees = employeeOnlyUsers
            .filter(emp => emp.departmentId?.toString() === prevDeptId)
            .map(emp => emp._id);

          // Remove these employees from previous department's employee array
          prevDept.employees = prevDept.employees.filter(
            empId => !movingEmployees.some(id => id.equals(empId))
          );
          await prevDept.save();
        }
      }

      // Update employee department references
      await User.updateMany(
        { _id: { $in: employeeOnlyIds } },
        {
          departmentId: newDepartment._id,
          // Set the managerId for employees to the department's manager
          ...(managerId ? { managerId: managerId } : {})
        }
      );

      // Add employees to the new department (only users with role='employee', excluding the manager)
      newDepartment.employees = employeeOnlyIds;
    }

    // Save the department with all updates
    await newDepartment.save();

    // Fetch the newly created department with populated data
    const populatedDepartment = await Department.findById(newDepartment._id)
      .populate('managerId', 'firstName lastName email role')
      .populate('employees', 'firstName lastName email position role');
     
   
    res.status(201).json({
      message: "Department created successfully",
      department: populatedDepartment
    });
  } catch (err) {
    console.error("Error creating department:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
// Update department
exports.updateDepartment = async (req, res, next) => {
  try {
    const { name, managerId, employeeIds } = req.body;
    const departmentId = req.params.id;
    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(404).json({ message: "Department not found" });
    }


    // Update name if provided
    if (name && name !== department.name) {
      const existingDepartment = await Department.findOne({ 
        name, 
        _id: { $ne: departmentId } // Exclude current department from name check
      });
      
      if (existingDepartment) {
        return res.status(400).json({ message: "Department name already exists" });
      }
      department.name = name;
    }

    // Get the previous managerId for reference
    const previousManagerId = department.managerId ? department.managerId.toString() : null;

    // Update manager if provided
    if (managerId && managerId !== previousManagerId) {
      const manager = await User.findById(managerId);
      if (!manager || manager.role !== 'manager') {
        return res.status(400).json({ message: "The selected manager is not a manager" });
      }
      // Handle previous department if manager is changing departments
      const previousManagerDepartment = await Department.findOne({ 
        managerId: managerId,
        _id: { $ne: departmentId } 
      });
      
      if (previousManagerDepartment) {
        // Remove manager from previous department
        previousManagerDepartment.managerId = null;
        await previousManagerDepartment.save();
      }
      
      department.managerId = managerId;
    }

    // Handle employee assignments if provided
    if (employeeIds && Array.isArray(employeeIds)) {
      // Filter out managerId from employeeIds
      const currentManagerId = managerId || previousManagerId;
      const filteredEmployeeIds = currentManagerId 
        ? employeeIds.filter(id => id.toString() !== currentManagerId.toString()) 
        : employeeIds;
      
      // Get current department employees
      const currentEmployeeIds = department.employees.map(id => id.toString());
      
      // Find employees to remove (in current dept but not in new selection)
      const employeesToRemove = currentEmployeeIds.filter(
        id => !filteredEmployeeIds.includes(id)
      );
      
      // Find employees to add (in new selection but not in current dept)
      const employeesToAdd = filteredEmployeeIds.filter(
        id => !currentEmployeeIds.includes(id)
      );
      
      // Remove departmentId and managerId from employees no longer in this department
      if (employeesToRemove.length > 0) {
        await User.updateMany(
          { _id: { $in: employeesToRemove } },
          { 
            $unset: { 
              departmentId: "",
              managerId: "" 
            } 
          }
        );
      }
      
      // For employees being added to this department:
      // 1. Remove them from their previous departments (if any)
      // 2. Assign them to this department
      if (employeesToAdd.length > 0) {
        // First, get the employees being added to check their current departments
        const employeesToAddDetails = await User.find({ _id: { $in: employeesToAdd } });
        
        // Get unique previous departments (excluding null and current department)
        const previousDepartmentIds = [...new Set(
          employeesToAddDetails
            .map(emp => emp.departmentId?.toString())
            .filter(deptId => deptId && deptId !== departmentId)
        )];
        
        // Remove these employees from previous department's employee arrays
        for (const prevDeptId of previousDepartmentIds) {
          const prevDept = await Department.findById(prevDeptId);
          if (prevDept) {
            // Find employees moving from this prev department to the current one
            const movingEmployees = employeesToAddDetails
              .filter(emp => emp.departmentId?.toString() === prevDeptId)
              .map(emp => emp._id);
            
            // Remove these employees from previous department's employee array
            prevDept.employees = prevDept.employees.filter(
              empId => !movingEmployees.some(id => id.equals(empId))
            );
            
            await prevDept.save();
          }
        }
        
        // Assign all new employees to this department and set their manager
        await User.updateMany(
          { _id: { $in: employeesToAdd } },
          { 
            departmentId: departmentId,
            // Set managerId if department has a manager
            ...(department.managerId ? { managerId: department.managerId } : {})
          }
        );
      }
      
      // Update existing employees' managerId if department manager has changed
      if (currentManagerId && previousManagerId !== currentManagerId) {
        const employeesToUpdate = filteredEmployeeIds.filter(
          id => currentEmployeeIds.includes(id)
        );
        
        if (employeesToUpdate.length > 0) {
          await User.updateMany(
            { _id: { $in: employeesToUpdate } },
            { managerId: currentManagerId }
          );
        }
      }
      
      // Update the department's employee array 
      department.employees = filteredEmployeeIds;
    }

    await department.save();

    // Fetch updated department with populated data
    const updatedDepartment = await Department.findById(departmentId)
      .populate('managerId', 'firstName lastName email')
      .populate('employees', 'firstName lastName email position departmentId');

    res.status(200).json({
      message: 'Department updated successfully',
      department: updatedDepartment
    });

  } catch (err) {
    console.error('Error updating department:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
// Delete a department
exports.deleteDepartment = async (req, res, next) => {
  try {
    const departmentId = req.params.id;
    // Remove department reference and manager reference from employees
    await User.updateMany(
      { departmentId: departmentId }, 
      { $unset: { departmentId: "", managerId: "" } }
    );

    // Delete the department
    await Department.findByIdAndDelete(departmentId);

    res.status(200).json({ message: 'Department deleted successfully' });
  } catch (err) {
    console.error('Error deleting department:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
// Get Available Managers
exports.getAvailableManagers = async (req, res) => {
  try {
    // Fetch all users with role "manager"
    const allManagers = await User.find({ role: "manager" })
      .select('firstName lastName email _id');

    // Get all departments with their managers to identify current assignments
    const departments = await Department.find().select('name managerId');
    
    // Map of manager IDs to their current department
    const managerDepartments = {};
    departments.forEach(dept => {
      if (dept.managerId) {
        managerDepartments[dept.managerId.toString()] = dept.name;
      }
    });

    // Add department information to each manager
    const managersWithDepartments = allManagers.map(manager => {
      const managerObj = manager.toObject();
      managerObj.currentDepartment = managerDepartments[manager._id.toString()] || null;
      return managerObj;
    });

    res.status(200).json({ availableManagers: managersWithDepartments });
  } catch (err) {
    console.error("Error fetching available managers:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
exports.getAssignableEmployees = async (req, res) => {
  try {
    // Get all employees regardless of department assignment
    const employees = await User.find({ 
      role: 'employee'  // Only get users with role 'employee'
    })
    .select('firstName lastName email position departmentId')
    .populate('departmentId', 'name'); 

    res.status(200).json({ employees });
  } catch (err) {
    console.error('Error fetching assignable employees:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};