import { useState, type CSSProperties, type ReactNode } from "react";

interface Props {
  title: ReactNode;
  defaultOpen?: boolean;
  headerExtra?: ReactNode;
  style?: CSSProperties;
  children: ReactNode;
}

export function CollapsibleCard({
  title,
  defaultOpen = true,
  headerExtra,
  style,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="card" style={style}>
      <div
        className="collapsible-row"
        style={{ marginBottom: open ? 12 : 0 }}
      >
        <button
          type="button"
          className="collapsible-header"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span
            className={
              "collapsible-chevron" + (open ? " is-open" : "")
            }
            aria-hidden="true"
          >
            ▸
          </span>
          {typeof title === "string" ? <h2>{title}</h2> : title}
        </button>
        {headerExtra && <div>{headerExtra}</div>}
      </div>
      {open && children}
    </section>
  );
}
