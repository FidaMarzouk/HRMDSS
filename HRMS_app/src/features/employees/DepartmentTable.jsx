// List of departments with their head and headcount.
const DepartmentTable = ({ departments, renderActions, loading, emptyMessage = "No departments found." }) => (
  <div className="w-full overflow-x-auto mt-1 rounded-lg bg-raise shadow-inner border border-line">
    <table className="table-auto w-full text-left border-separate border-spacing-y-1">
      <thead className="bg-raise sticky top-0">
        <tr>
          <th className="py-3 px-4 text-teal text-sm font-bold">Department</th>
          <th className="py-3 px-4 text-teal text-sm font-bold">Department head</th>
          <th className="py-3 px-4 text-teal text-sm font-bold">Employees</th>
          {renderActions && <th className="py-3 px-4 text-teal text-sm font-bold text-center">Actions</th>}
        </tr>
      </thead>
      <tbody>
        {departments.length === 0 && (
          <tr className="bg-raise">
            <td colSpan={renderActions ? 4 : 3} className="py-4 px-4 text-sm text-center text-ink-2">{loading ? "Loading…" : emptyMessage}</td>
          </tr>
        )}
        {departments.map((dept) => (
          <tr key={dept._id} className="bg-raise hover:bg-sunk transition-colors">
            <td className="py-4 px-4 text-sm text-ink font-medium">{dept.name}</td>
            <td className="py-4 px-4 text-sm text-ink">
              {dept.managerId ? `${dept.managerId.firstName} ${dept.managerId.lastName}` : <span className="text-ink-3">No manager assigned</span>}
            </td>
            <td className="py-4 px-4 text-sm text-ink">
              <span className="px-2 py-1 bg-sunk text-ink-2 rounded-full border border-line-2 figure text-xs">
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
