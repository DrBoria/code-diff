/**
 * THE commit gate of the surface: a value is accepted only when it differs
 * from the last committed one, so a no-op measurement / window decision never
 * re-renders the board. One implementation — the layout commit and the virtual
 * window commit both pass through it, each with its own equality and sink.
 */
export interface GateArgs<T> {
	readonly next: T;
	readonly last: { current: T };
	/** True when the two values are the same commit (skip). */
	readonly same: (a: T, b: T) => boolean;
	readonly commit: (value: T) => void;
}

export const commitIfChanged = <T>({ next, last, same, commit }: GateArgs<T>): void => {
	if (same(next, last.current)) return;
	last.current = next;
	commit(next);
};
