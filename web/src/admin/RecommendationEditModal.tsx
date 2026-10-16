import { useState } from "react";
import { updateRecommendation } from "../api/client";

interface Props {
  building: any;
  onClose: () => void;
  onSaved: () => void;
}

// Source is set explicitly by the admin (not auto-inferred from editing),
// as agreed — a small correction can stay "epc_assessor", while a genuine
// replacement is marked "manual_override", which flips the building's
// status to "superseded" server-side.
export function RecommendationEditModal({ building, onClose, onSaved }: Props) {
  const [measure, setMeasure] = useState(building.recommendations?.[0]?.measure ?? "");
  const [payback, setPayback] = useState(
    building.recommendations?.[0]?.payback_category ?? "medium"
  );
  const [cost, setCost] = useState(building.recommendations?.[0]?.estimated_cost ?? "");
  const [source, setSource] = useState("epc_assessor");

  async function save() {
    const recommendationId = building.recommendations?.[0]?.id;
    await updateRecommendation(recommendationId, {
      measure,
      payback_category: payback,
      estimated_cost: cost,
      source,
    });
    onSaved();
    onClose();
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <p className="modal-title">Edit recommendation</p>
        <p className="modal-subtitle">{building.address}</p>

        <label>Recommended works</label>
        <input value={measure} onChange={(e) => setMeasure(e.target.value)} />

        <label>Payback category</label>
        <select value={payback} onChange={(e) => setPayback(e.target.value)}>
          <option value="short">Short</option>
          <option value="medium">Medium</option>
          <option value="long">Long</option>
        </select>

        <label>Estimated cost</label>
        <input value={cost} onChange={(e) => setCost(e.target.value)} />

        <label>Source</label>
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="epc_assessor">EPC assessor data</option>
          <option value="manual_override">Manual override</option>
        </select>

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={save}>Save changes</button>
        </div>
      </div>
    </div>
  );
}
