interface Props {
  buildings: { uprn: number; address: string; epc_band: string; status: string }[];
  onSelect: (uprn: number) => void;
}

export function BuildingTable({ buildings, onSelect }: Props) {
  return (
    <table className="admin-building-table">
      <thead>
        <tr>
          <th>Address</th>
          <th>Band</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {buildings.map((b) => (
          <tr key={b.uprn} onClick={() => onSelect(b.uprn)}>
            <td>{b.address}</td>
            <td>{b.epc_band}</td>
            <td>
              <span className={`status-pill status-${b.status}`}>{b.status}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
