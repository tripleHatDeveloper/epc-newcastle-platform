import { useState } from "react";
import { submitReport } from "../api/client";

interface Props {
  uprn?: number | null; // present = building-specific, absent = general feedback
  label?: string;
}

export function ReportIssueForm({ uprn = null, label }: Props) {
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!message.trim()) {
      setError("Enter a message before submitting.");
      return;
    }
    setError("");
    await submitReport(uprn, message.trim(), email || undefined);
    setSubmitted(true);
  }

  if (submitted) {
    return <p className="report-confirmation">Thanks — your report has been sent.</p>;
  }

  return (
    <div className="report-issue-form">
      <p className="report-title">Report an issue</p>
      <p className="report-subtitle">{label || "General feedback"}</p>

      <label>{uprn ? "What's wrong with this building's data?" : "What would you like to tell us?"}</label>
      <textarea
        placeholder={uprn ? "e.g. wrong band, building demolished" : "Describe the issue or suggestion"}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      {error && <p className="field-error">{error}</p>}

      <label>Email (optional)</label>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

      <button onClick={submit}>Submit</button>
    </div>
  );
}
