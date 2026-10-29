import { useViewer } from '../viewer.js';

// There is no sign-in in this demo, so employees pick who they are.
export default function ViewerPicker() {
  const { viewerId, setViewerId, employees } = useViewer();
  return (
    <div className="viewer">
      <label htmlFor="viewer">Viewing as</label>
      <select id="viewer" value={viewerId} onChange={(e) => setViewerId(Number(e.target.value))}>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}, {e.team}
          </option>
        ))}
      </select>
    </div>
  );
}
