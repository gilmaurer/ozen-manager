import { ReactNode } from "react";

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ open, title, onClose, children }: Props) {
  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn btn-secondary btn-sm" onClick={onClose} aria-label="סגור">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
