import { useState } from "react";
import { askEpcBuddy } from "../api/client";

interface Props {
  uprn: number;
  address: string;
}

export function EpcBuddyChat({ uprn, address }: Props) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "buddy"; text: string }[]>([]);

  async function ask() {
    if (!question.trim()) return;
    const asked = question;
    setMessages((prev) => [...prev, { role: "user", text: asked }]);
    setQuestion("");

    const { answer } = await askEpcBuddy(uprn, asked);
    setMessages((prev) => [...prev, { role: "buddy", text: answer }]);
  }

  return (
    <div className="epc-buddy">
      <p className="epc-buddy-title">EPC buddy · {address}</p>
      <div className="epc-buddy-messages">
        {messages.map((m, i) => (
          <div key={i} className={`bubble bubble-${m.role}`}>
            {m.text}
          </div>
        ))}
      </div>
      <input
        type="text"
        placeholder="Ask about this building's rating"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && ask()}
      />
    </div>
  );
}
