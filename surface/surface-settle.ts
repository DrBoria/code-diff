/**
 * Re-run a measurement once the frame settles. A reveal/fold mounts new rows
 * in a child layout effect that runs AFTER the parent's, so the anchors are not
 * on screen yet when the parent measures; one animation frame plus a short
 * timer covers both the fast and the slow settle. Returns the single undo.
 */
export const settleMeasure = (measure: () => void): (() => void) => {
	const frame = requestAnimationFrame(() => measure());
	const timer = setTimeout(() => measure(), 80);
	return () => {
		cancelAnimationFrame(frame);
		clearTimeout(timer);
	};
};
