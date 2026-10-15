import { useEffect } from 'react';

export function AlertDialog({ open, onOpenChange, children }) {
  // Close on Escape while open
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onOpenChange?.(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  // Add backdrop click handler for closing
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onOpenChange?.(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      {children}
    </div>
  );
}

export function AlertDialogContent({ className = "", children, ...props }) {
  return (
    <div
      className={`bg-white rounded-lg shadow-lg w-full max-w-[90%] sm:max-w-md mx-4 p-4 sm:p-0 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function AlertDialogHeader({ className = "", children, ...props }) {
  return (
    <div
      className={`p-4 sm:p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function AlertDialogTitle({ className = "", children, ...props }) {
  return (
    <h2
      className={`text-lg font-semibold ${className}`}
      {...props}
    >
      {children}
    </h2>
  );
}

export function AlertDialogDescription({ className = "", children, ...props }) {
  return (
    <div
      className={`text-sm text-gray-500 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function AlertDialogFooter({ className = "", children, ...props }) {
  return (
    <div
      className={`p-4 sm:p-6 flex flex-col sm:flex-row justify-end gap-2 sm:space-x-2 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
export function AlertDialogCancel({ className = "", onClick, children, ...props }) {
  return (
    <button
      type="button"
      className={`px-4 py-2 rounded-md text-gray-500 hover:text-gray-700 ${className}`}
      onClick={onClick} // Fixed: Use the onClick prop directly
      {...props}
    >
      {children}
    </button>
  );
}

export function AlertDialogAction({ className = "", onClick,children, ...props }) {
  return (
    <button
      type="button"
      className={`px-4 py-2 rounded-md bg-primary text-white hover:bg-primary/90 ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
     
      }}
      {...props}
    >
      {children}
    </button>
  );
}
