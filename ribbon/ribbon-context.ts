import type { Column } from "../columns/column-types.js";
import type { Ribbon } from "./ribbon-types.js";
import type { AnchorLookup } from "../surface/surface-types.js";
import type { RibbonColumnBox } from "./ribbon-measure.js";
import type { ToneApi } from "./hooks/use-ribbon-tone.js";

/**
 * THE one description of a painted backdrop: what is drawn (ribbons over
 * columns), where it is measured (column boxes + anchor lookup), how tall a
 * row is, and which chain/rows are hot. Every stage of the paint — measuring,
 * slot allocation, washes, hints, the SVG commit — reads this SAME context, so
 * no stage invents a second shape of the same facts.
 */
export interface RibbonContext {
	readonly ribbons: readonly Ribbon[];
	readonly columns: readonly Column[];
	readonly columnBoxes: readonly RibbonColumnBox[];
	readonly lookup: AnchorLookup;
	readonly rowHeight: number;
	readonly tone: ToneApi;
	/** The focused chain's ribbon id (hover or pick), or null. */
	readonly hotRibbon: string | null;
	/** Row keys lit by a hovered group header (column::id). */
	readonly hotRows: ReadonlySet<string>;
}
