import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

type ModalFrameProps = {
  children: ReactNode;
  onDismiss?: () => void;
  layer?: "dialog" | "prompt";
  narrow?: boolean;
};

export function ModalFrame({ children, onDismiss, layer = "dialog", narrow = false }: ModalFrameProps) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const frame = (
    <div
      className={
        layer === "prompt"
          ? "fixed inset-0 z-[90] overflow-y-auto overscroll-contain bg-[#17191c]/55"
          : "fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-[#17191c]/55"
      }
    >
      <div
        className="flex min-h-full items-center justify-center p-4"
        onMouseDown={(event) => {
          if (onDismiss && event.target === event.currentTarget) onDismiss();
        }}
      >
        <div
          className={narrow ? "pointer-events-auto my-auto w-full max-w-md" : "pointer-events-auto my-auto w-full max-w-xl"}
          onMouseDown={(event) => event.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(frame, document.body);
}
