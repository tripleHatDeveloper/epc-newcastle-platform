import { useState } from "react";
import { addReviewNote, flagBuilding, verifyBuilding } from "../api/client";
import { RecommendationEditModal } from "./RecommendationEditModal";

interface Props {
  building: any;
  onUpdated: () => void;
}

export function ReviewPanel({ building, onUpdated }: Props) {
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);

  async function saveNote() {
    if (!note.trim()) return;
    await addReviewNote(building.uprn, note.trim());
    setNote("");
  }

  return (
    <div className="review-panel">
      <p className="review-address">{building.address}</p>
      <p className="review-uprn">UPRN {building.uprn}</p>

      <table>
        <tbody>
          <tr>
            <td>Band</td>
            <td>{building.epc_band}</td>
          </tr>
          <tr>
            <td>Floor area</td>
            <td>{building.floor_area_sqm} sqm</td>
          </tr>
        </tbody>
      </table>

      <textarea
        placeholder="Add a review note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button onClick={saveNote} disabled={!note.trim()}>
        Save note
      </button>

      <button onClick={() => verifyBuilding(building.uprn).then(onUpdated)}>Verify</button>
      <button onClick={() => flagBuilding(building.uprn).then(onUpdated)}>Flag</button>
      <button onClick={() => setEditing(true)}>Edit recommendation</button>

      {editing && (
        <RecommendationEditModal
          building={building}
          onClose={() => setEditing(false)}
          onSaved={onUpdated}
        />
      )}
    </div>
  );
}
