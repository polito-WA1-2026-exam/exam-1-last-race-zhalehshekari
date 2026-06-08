// Station pixel positions for the SVG viewBox (0 0 600 450)
// These match the seed IDs: 1=Porta Susa … 14=Parella
const POS = {
  1:  [100, 75],   // Porta Susa    (Red + Blue)
  2:  [225, 75],   // Porta Nuova   (Red + Green)
  3:  [345, 75],   // Dante         (Red + Blue, not interchange)
  4:  [465, 75],   // Lingotto      (Red + Yellow)
  5:  [565, 75],   // Fermi         (Red)
  6:  [100, 215],  // Re Umberto    (Blue + Yellow)
  7:  [280, 215],  // Vinzaglio     (Blue + Green)
  8:  [405, 195],  // Paradiso      (Blue)
  9:  [530, 195],  // Marche        (Blue)
  10: [185, 310],  // Massaua       (Green)
  11: [315, 310],  // Nizza         (Green + Yellow)
  12: [450, 335],  // Pozzo Strada  (Green)
  13: [100, 335],  // Monte Grappa  (Yellow)
  14: [100, 415],  // Parella       (Yellow)
};

function NetworkMap({
  network,
  showLines   = true,
  startId     = null,
  destId      = null,
  currentId   = null,
  routeSegments = [],   // [{ fromId, toId }]
}) {
  if (!network) return null;
  const { lines, stations, segments } = network;

  const lineColor = (lineId) => lines.find(l => l.id === lineId)?.color ?? '#8892a4';

  const isRouteSegment = (a, b) =>
    routeSegments.some(r =>
      (r.fromId === a && r.toId === b) || (r.fromId === b && r.toId === a)
    );

  return (
    <div className="map-container">
      <svg viewBox="0 0 600 450" className="network-svg">
        {/* ── Segments ── */}
        {segments.map(seg => {
          const from = POS[seg.from_station_id];
          const to   = POS[seg.to_station_id];
          if (!from || !to) return null;
          const inRoute = isRouteSegment(seg.from_station_id, seg.to_station_id);

          // Phase 2: hide all lines — only show segments that are in the built route
          if (!showLines && !inRoute) return null;

          const stroke = inRoute ? '#a78bfa' : lineColor(seg.line_id);
          return (
            <line
              key={seg.id}
              x1={from[0]} y1={from[1]}
              x2={to[0]}   y2={to[1]}
              stroke={stroke}
              strokeWidth={inRoute ? 5 : 3}
              strokeLinecap="round"
            />
          );
        })}


        {/* ── Stations ── */}
        {stations.map(station => {
          const pos = POS[station.id];
          if (!pos) return null;

          const isStart   = station.id === startId;
          const isDest    = station.id === destId;
          const isCurrent = station.id === currentId && !isStart && !isDest;

          const r = station.is_interchange ? 9 : 7;
          const fill = isStart   ? '#22c55e'
                     : isDest    ? '#ef4444'
                     : isCurrent ? '#6c63ff'
                     : '#1a1d27';
          const stroke = isStart   ? '#22c55e'
                       : isDest    ? '#ef4444'
                       : isCurrent ? '#6c63ff'
                       : showLines ? '#c8d0df'
                       : '#555870';

          return (
            <g key={station.id}>
              {/* outer ring for interchanges */}
              {station.is_interchange && (
                <circle
                  cx={pos[0]} cy={pos[1]}
                  r={r + 5}
                  fill="none"
                  stroke={showLines ? '#ffffff' : '#4a4e60'}
                  strokeWidth={1}
                  opacity={0.3}
                />
              )}
              <circle
                cx={pos[0]} cy={pos[1]}
                r={r}
                fill={fill}
                stroke={stroke}
                strokeWidth={2}
              />
              <text
                x={pos[0]}
                y={pos[1] + r + 13}
                textAnchor="middle"
                fontSize="9.5"
                fill={isStart || isDest || isCurrent ? '#e2e8f0' : '#7a8394'}
                fontWeight={isStart || isDest ? '600' : '400'}
                fontFamily="system-ui, sans-serif"
              >
                {station.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Line legend — only visible in Phase 1 */}
      {showLines && (
        <div className="map-legend">
          {lines.map(line => (
            <span key={line.id} className="legend-item">
              <span className="legend-dot" style={{ background: line.color }} />
              {line.name}
            </span>
          ))}
          <span className="legend-item">
            <span className="legend-dot legend-interchange" />
            Interchange
          </span>
        </div>
      )}
    </div>
  );
}

export default NetworkMap;
