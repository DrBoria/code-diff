// jsdom has no layout engine: ResizeObserver and the caret APIs the board uses
// are absent. Stub them so the board mounts; geometry assertions are kept in the
// pure model tests, the view tests check rendering and the controller contract.

import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Unmount React trees between tests so one test's DOM cannot leak into the next.
afterEach(() => cleanup());

class ResizeObserverStub {
	observe(): void {}
	unobserve(): void {}
	disconnect(): void {}
}

(globalThis as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver = ResizeObserverStub;

// The board reads the caret to find the character under the pointer; jsdom has
// neither API, so a hover simply carries no character offset.
if (typeof document !== "undefined") {
	(document as unknown as { caretPositionFromPoint?: unknown }).caretPositionFromPoint = () => null;
	(document as unknown as { caretRangeFromPoint?: unknown }).caretRangeFromPoint = () => null;
}