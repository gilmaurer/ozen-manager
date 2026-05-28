import { useEffect, useState } from "react";
import { Modal } from "../../components/Modal";
import { formatDate } from "../../utils/format";
import { compareVersions } from "./compareVersions";
import { CHANGELOG_ENTRIES, ChangelogEntry } from "./entries";
import { getLastSeenVersion, setLastSeenVersion } from "./lastSeenVersion";

export function WhatsNewGate() {
  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null);

  useEffect(() => {
    const current = __APP_VERSION__;
    const lastSeen = getLastSeenVersion();

    if (lastSeen === null) {
      setLastSeenVersion(current);
      return;
    }

    if (compareVersions(lastSeen, current) >= 0) return;

    const newer = CHANGELOG_ENTRIES.filter(
      (e) => compareVersions(e.version, lastSeen) > 0,
    ).sort((a, b) => compareVersions(b.version, a.version));

    if (newer.length === 0) {
      setLastSeenVersion(current);
      return;
    }

    setEntries(newer);
  }, []);

  function handleClose() {
    setLastSeenVersion(__APP_VERSION__);
    setEntries(null);
  }

  if (!entries) return null;

  const title =
    entries.length === 1
      ? `מה חדש בגרסה v${entries[0].version}`
      : "עדכוני האפליקציה";

  return (
    <Modal open={true} title={title} onClose={handleClose}>
      <div dir="rtl" style={{ marginBottom: 16 }}>
        {entries.map((entry) => (
          <section key={entry.version} style={{ marginBottom: 14 }}>
            <h3
              style={{
                fontSize: 14,
                margin: "0 0 6px",
                color: "var(--text-muted)",
                fontWeight: 600,
              }}
            >
              <span dir="ltr">v{entry.version}</span>
              {" · "}
              {formatDate(entry.date)}
            </h3>
            <ul style={{ margin: 0, paddingInlineStart: 20 }}>
              {entry.items.map((item, i) => (
                <li
                  key={i}
                  className="row-value"
                  dir="auto"
                  style={{ marginBottom: 4 }}
                >
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="modal-actions">
        <button className="btn" onClick={handleClose}>
          סגור
        </button>
      </div>
    </Modal>
  );
}
