import { type ReactElement } from "react";
import type { MeasuredRibbon } from "./ribbon-types.js";

/**
 * The dumb SVG of ONE ribbon: its connectors (filled bands between columns) and
 * its caption. It receives resolved colours and a hot flag; it decides nothing.
 * The whole ribbon is painted in ONE shade — hot or not — so the chain reads as
 * one continuous entity at one uniform intensity.
 */
export interface RibbonProps {
	readonly shape: MeasuredRibbon;
	readonly fill: string;
	readonly hot: boolean;
	readonly captionInk: string;
	readonly mono: string;
}

export const Ribbon = ({ shape, fill, hot, captionInk, mono }: RibbonProps): ReactElement => (
	<g data-ribbon={shape.id} data-hot={hot ? "true" : "false"}>
		{shape.connectors.map((connector, index) => (
			<path key={index} d={connector.path} fill={fill} stroke="none" data-connector={`${connector.from}->${connector.to}`} />
		))}
		{shape.caption !== null && shape.label !== null ? (
			<text x={shape.caption.x} y={shape.caption.y} textAnchor="middle" fontSize={10} fontFamily={mono} fill={captionInk} data-caption={shape.id}>
				{shape.label}
			</text>
		) : null}
	</g>
);
