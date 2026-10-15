import React, { useState, useRef, useEffect } from 'react';

export const Popover = ({ children, open, onOpenChange }) => {
  return (
    <div className="relative inline-block">
      {React.Children.map(children, child => 
        React.cloneElement(child, { open, onOpenChange })
      )}
    </div>
  );
};

export const PopoverTrigger = ({ children, asChild, open, onOpenChange }) => {
  const handleClick = (e) => {
    if (onOpenChange) {
      onOpenChange(!open);
    }
    
    // Execute the child's onClick if it exists
    if (children.props.onClick) {
      children.props.onClick(e);
    }
  };
  
  if (asChild) {
    return React.cloneElement(children, {
      onClick: handleClick,
      className: `${children.props.className || ''} ${open ? 'ring-2 ring-[#2dd4bf]/50' : ''}`,
      "aria-expanded": open
    });
  }
  
  return (
    <button 
      onClick={handleClick} 
      aria-expanded={open}
      className={`${open ? 'ring-2 ring-[#2dd4bf]/50' : ''}`}
    >
      {children}
    </button>
  );
};

export const PopoverContent = ({ 
  children, 
  className, 
  open, 
  onOpenChange, 
  align = "center", 
  sideOffset = 5,
  ...props 
}) => {
  const ref = useRef(null);
  const triggerRef = useRef(null);
  
  // Find the trigger element
  useEffect(() => {
    if (open && ref.current) {
      // Get the parent's parent of the content (should be the Popover component)
      const popoverElement = ref.current.parentElement;
      if (popoverElement) {
        // The first child should be the trigger
        triggerRef.current = popoverElement.querySelector('button') || 
                            popoverElement.querySelector('[role="button"]');
      }
    }
  }, [open]);
  
  // Position the popover
  useEffect(() => {
 // Inside PopoverContent useEffect for positioning
if (open && ref.current && triggerRef.current) {
  const triggerRect = triggerRef.current.getBoundingClientRect();
  const contentRect = ref.current.getBoundingClientRect();
  
  // Calculate position based on alignment
  let left = 0;
  if (align === "start") {
    left = 0;
  } else if (align === "center") {
    left = (triggerRect.width - contentRect.width) / 2;
  } else if (align === "end") {
    left = triggerRect.width - contentRect.width;
  }
  
  // Ensure the popover doesn't go off-screen
  const rightEdge = triggerRect.left + left + contentRect.width;
  const viewportWidth = window.innerWidth;
  
  if (rightEdge > viewportWidth - 10) {
    left = Math.max(-contentRect.width/2, left - (rightEdge - viewportWidth + 10));
  }
  
  if (triggerRect.left + left < 10) {
    left = -triggerRect.left + 10;
  }
  
  // Handle small screens - center on mobile
  if (viewportWidth < 640) {
    left = Math.max(10 - triggerRect.left, Math.min(viewportWidth - contentRect.width - 10 - triggerRect.left, (triggerRect.width - contentRect.width) / 2));
  }
  
  ref.current.style.left = `${left}px`;
  ref.current.style.top = `${triggerRect.height + sideOffset}px`;
}
  }, [open, align, sideOffset]);
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target) && open) {
        // Check if the click was on the trigger element
        if (triggerRef.current && !triggerRef.current.contains(event.target)) {
          // Call onOpenChange to close the popover when clicking outside
          if (onOpenChange) {
            onOpenChange(false);
          }
        }
      }
    };
    
    const handleScroll = () => {
      // Close popover on scroll for better UX
      if (open && onOpenChange) {
        onOpenChange(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onOpenChange, open]);
  
  // Animation state
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    if (open) {
      setMounted(true);
    } else {
      const timer = setTimeout(() => setMounted(false), 200);
      return () => clearTimeout(timer);
    }
  }, [open]);
  
  // Only render content if mounted
  if (!mounted) return null;
  
  return (
    <div 
      ref={ref}
      className={`absolute z-50 rounded-lg shadow-xl border border-[#2dd4bf]/30 backdrop-blur-sm
                  transform transition-all duration-200 ease-in-out
                  ${open ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}
                  ${className || ''}`}
      {...props}
    >
      {children}
    </div>
  );
};