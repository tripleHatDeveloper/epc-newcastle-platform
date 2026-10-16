import { useEffect, useState } from "react";
import { getQueueCounts } from "../api/client";

interface Props {
  activeStatus?: string;
  onSelectStatus: (status?: string) => void;
}

const STATUSES: { key?: string; label: string }[] = [
  { key: undefined, label: "All buildings" },
  { key: "unverified", label: "Unverified" },
  { key: "verified", label: "Verified" },
  { key: "flagged", label: "Flagged" },
  { key: "reported", label: "Reported" },
];

export function Queue({ activeStatus, onSelectStatus }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    getQueueCounts().then(setCounts);
  }, []);

  return (
    <div className="queue-sidebar">
      <h2>Queue</h2>
      {STATUSES.map(({ key, label }) => (
        <p
          key={label}
          className={`queue-row ${activeStatus === key ? "active" : ""}`}
          onClick={() => onSelectStatus(key)}
        >
          {label} <span className="queue-count">{key ? counts[key] ?? 0 : counts.all ?? 0}</span>
        </p>
      ))}
    </div>
  );
}
