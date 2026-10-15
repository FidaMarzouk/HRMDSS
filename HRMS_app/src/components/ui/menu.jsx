import { useEffect, useId, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * Overflow ("more") menu. items: [{ label, onSelect, danger, disabled }] or
 * { divider: true }. Destructive items go last, behind a divider.
 * Arrow keys move, Enter/Space select, Escape closes and returns focus.
 */
export function Menu({ items, label = "More actions", align = "end", trigger, className }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const focusItem = (index) => {
    const nodes = menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])');
    if (!nodes?.length) return;
    nodes[(index + nodes.length) % nodes.length].focus();
  };

  useEffect(() => {
    if (!open) return undefined;
    focusItem(0);
    const onPointer = (e) => {
      if (!menuRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (e) => {
    const nodes = [...(menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') || [])];
    const index = nodes.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); focusItem(index + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); focusItem(index - 1); }
    else if (e.key === "Home") { e.preventDefault(); focusItem(0); }
    else if (e.key === "End") { e.preventDefault(); focusItem(nodes.length - 1); }
    else if (e.key === "Escape" || e.key === "Tab") close();
  };

  return (
    <div className={cn("relative inline-block", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={trigger ? undefined : label}
        onClick={() => setOpen((v) => !v)}
        className={trigger ? undefined : "grid h-10 w-10 place-items-center rounded-md text-ink-2 hover:bg-sunk hover:text-ink"}
      >
        {trigger || <MoreHorizontal className="h-4 w-4" />}
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          onKeyDown={onKeyDown}
          className={cn(
            "absolute z-40 mt-1 grid min-w-[200px] rounded-[10px] border border-line-2 bg-raise p-1 shadow-pop",
            align === "end" ? "right-0" : "left-0"
          )}
        >
          {items.map((item, i) =>
            item.divider ? (
              <div key={`divider-${i}`} role="separator" className="my-1 h-px bg-line" />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  close();
                  item.onSelect?.();
                }}
                className={cn(
                  "rounded-md px-2.5 py-2 text-left text-[13px] hover:bg-teal/10 focus:bg-teal/10 focus:outline-none disabled:opacity-50",
                  item.danger ? "text-red" : "text-ink"
                )}
              >
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
