// List of departments with their head and headcount.
const DepartmentTable = ({ departments, renderActions, loading, emptyMessage = "No departments found." }) => (
  <div className="w-full overflow-x-auto mt-1 rounded-lg bg-[#222] shadow-inner border border-[#333]">
    <table className="table-auto w-full text-left border-separate border-spacing-y-1">
      <thead className="bg-[#2c2c2c] sticky top-0">
        <tr>
          <th className="py-3 px-4 text-[#33adb4] text-sm font-bold">Department</th>
          <th className="py-3 px-4 text-[#33adb4] text-sm font-bold">Department head</th>
          <th className="py-3 px-4 text-[#33adb4] text-sm font-bold">Employees</th>
          {renderActions && <th className="py-3 px-4 text-[#33adb4] text-sm font-bold text-center">Actions</th>}
        </tr>
      </thead>
      <tbody>
        {departments.length === 0 && (
          <tr className="bg-[#2a2a2a]">
            <td colSpan={renderActions ? 4 : 3} className="py-4 px-4 text-sm text-center text-gray-400">{loading ? "Loading…" : emptyMessage}</td>
          </tr>
        )}
        {departments.map((dept) => (
          <tr key={dept._id} className="bg-[#2a2a2a] hover:bg-[#333] transition-colors">
            <td className="py-4 px-4 text-sm text-white font-medium">{dept.name}</td>
            <td className="py-4 px-4 text-sm text-gray-300">
              {dept.managerId ? `${dept.managerId.firstName} ${dept.managerId.lastName}` : <span className="text-gray-500">No manager assigned</span>}
            </td>
            <td className="py-4 px-4 text-sm text-gray-300">
              <span className="px-2 py-1 bg-[#31638a33] text-[#5b9bd5] rounded-full border border-[#31638a]">
                {dept.employees?.length || 0}
              </span>
            </td>
            {renderActions && <td className="py-4 px-4 text-sm"><div className="flex justify-center gap-2">{renderActions(dept)}</div></td>}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default DepartmentTable;
