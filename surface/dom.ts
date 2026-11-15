/**
 * DOM narrowing helpers. An event target is an EventTarget; the board only acts
 * on Elements and HTML elements, so it NARROWS with instanceof instead of
 * asserting a type the runtime has not proved.
 */

/** The event target as an Element, or null when it is not one. */
export const elementOf = (target: EventTarget | null): Element | null => (target instanceof Element ? target : null);

/** The event target as an HTMLElement, or null when it is not one. */
export const htmlOf = (target: EventTarget | null): HTMLElement | null => (target instanceof HTMLElement ? target : null);

/** A ResizeObserver entry's target as an HTMLElement (it always is one). */
export const observedHtml = (target: Element): HTMLElement | null => (target instanceof HTMLElement ? target : null);
