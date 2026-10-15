// src/components/ui/card.jsx

export function Card({ className = "", children, ...props }) {
  return (
    <div 
      className={`rounded-lg border bg-white text-gray-950 shadow w-full mx-auto ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children, ...props }) {
  return (
    <div 
      className={`flex flex-col space-y-1.5 p-4 sm:p-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className = "", children, ...props }) {
  return (
    <h3 
      className={`font-semibold leading-none tracking-tight text-2xl ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardContent({ className = "", children, ...props }) {
  return (
    <div 
      className={`p-4 sm:p-6 pt-0 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}