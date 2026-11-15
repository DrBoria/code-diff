import type { SurfaceLayout } from "./surface-types.js";
import { layoutKey } from "./surface-measure.js";
import { commitIfChanged } from "./commit-gate.js";

/**
 * The commit gate of a measured layout: a measurement is accepted only when
 * its fingerprint changed, so a scroll or a no-op resize never re-renders the
 * board. The gate itself is shared (commit-gate); this is its layout reading.
 */
export interface CommitSink {
	readonly lastKey: { current: string };
	readonly setLayout: (layout: SurfaceLayout) => void;
	readonly bump: () => void;
}

export const commitLayout = (next: SurfaceLayout, sink: CommitSink): void => {
	const key = layoutKey(next);
	commitIfChanged({
		next: key,
		last: sink.lastKey,
		same: (a, b) => a === b,
		commit: () => {
			sink.setLayout(next);
			sink.bump();
		},
	});
};
