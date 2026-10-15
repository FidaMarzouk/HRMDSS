import * as React from "react"
import { AlertCircle, Info, Check } from "lucide-react"

const Alert = React.forwardRef(({ className, variant = "default", children, ...props }, ref) => {
  const getVariantStyles = () => {
    switch (variant) {
      case "destructive":
        return "border-red-500/50 text-red-600 dark:border-red-500 [&>svg]:text-red-600 bg-red-50";
      case "success":
        return "border-green-500/50 text-green-600 dark:border-green-500 [&>svg]:text-green-600 bg-green-50";
      case "info":
        return "border-blue-500/50 text-blue-600 dark:border-blue-500 [&>svg]:text-blue-600 bg-blue-50";
      default:
        return "bg-background text-foreground";
    }
  };

  const getIcon = () => {
    switch (variant) {
      case "destructive":
        return <AlertCircle className="h-4 w-4 absolute left-4 top-4" />;
      case "success":
        return <Check className="h-4 w-4 absolute left-4 top-4" />;
      case "info":
        return <Info className="h-4 w-4 absolute left-4 top-4" />;
      default:
        return null;
    }
  };

  return (
    <div
      ref={ref}
      role="alert"
      className={`relative w-full rounded-lg border p-3 sm:p-4 text-sm [&>svg+div]:translate-y-[-3px] ${getVariantStyles()} ${className}`}
      {...props}
    >
      {getIcon()}
      {children}
    </div>
  );
});
Alert.displayName = "Alert";

const AlertDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`pl-7 text-sm [&_p]:leading-relaxed ${className}`}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertDescription };