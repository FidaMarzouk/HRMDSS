
export const Table = ({ className, children, ...props }) => {
  return (
    <div className="w-full overflow-x-auto">
      <table className={`min-w-full divide-y divide-gray-200 ${className || ''}`} {...props}>
        {children}
      </table>
    </div>
  );
};

export const TableHeader = ({ className, children, ...props }) => {
  return (
    <thead className={className} {...props}>
      {children}
    </thead>
  );
};

export const TableBody = ({ className, children, ...props }) => {
  return (
    <tbody className={`divide-y divide-gray-200 ${className || ''}`} {...props}>
      {children}
    </tbody>
  );
};

export const TableRow = ({ className, children, ...props }) => {
  return (
    <tr className={className} {...props}>
      {children}
    </tr>
  );
};

export const TableHead = ({ className, children, ...props }) => {
  return (
    <th 
      scope="col" 
      className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${className || ''}`}
      {...props}
    >
      {children}
    </th>
  );
};

export const TableCell = ({ className, children, ...props }) => {
  return (
    <td 
      className={`px-6 py-4 whitespace-nowrap ${className || ''}`}
      {...props}
    >
      {children}
    </td>
  );
};