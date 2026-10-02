// The ISL loading animation: four dots huddle at different sizes, spin half
// a turn out to small, equal dots at the corners, pause, and spin back in.
// Recreated in CSS from the brand's loading_isl recording — see the
// isl-loader-* keyframes in globals.css.

const DOTS = [
  // Huddled position (x, y sign), huddled size in px, colour.
  { x: -1, y: -1, size: 32, color: "#0098f8" }, // blue
  { x: 1, y: -1, size: 23, color: "#f85050" }, // red
  { x: -1, y: 1, size: 18, color: "#c060f0" }, // purple
  { x: 1, y: 1, size: 38, color: "#88c018" }, // green
];
const SPREAD_SIZE = 13;
const BOX = 100;

export function IslLoader({ size = BOX, label = "Loading" }: { size?: number; label?: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      className="relative inline-block shrink-0"
      style={{ width: size, height: size }}
    >
      <span
        className="isl-loader-spin absolute left-0 top-0"
        style={{ width: BOX, height: BOX, transform: `scale(${size / BOX})`, transformOrigin: "0 0" }}
      >
        <span className="isl-loader-rotor absolute inset-0">
          {DOTS.map((d) => (
            <span
              key={d.color}
              className="isl-loader-dot absolute left-1/2 top-1/2 rounded-full"
              style={
                {
                  width: d.size,
                  height: d.size,
                  marginLeft: -d.size / 2,
                  marginTop: -d.size / 2,
                  background: d.color,
                  "--x": d.x,
                  "--y": d.y,
                  "--s": SPREAD_SIZE / d.size,
                } as React.CSSProperties
              }
            />
          ))}
        </span>
      </span>
    </span>
  );
}
