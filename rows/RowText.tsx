import { type ReactElement } from "react";
import styled from "styled-components";
import type { RowTextSpan } from "./row-types.js";

/** The dumb text of a row: coloured spans + painted ranges. Decides nothing. */

const Paint = styled.span<{ $strong?: boolean; $paint?: string }>`
	background: ${(p) => p.$paint ?? p.theme.paint ?? "transparent"};
	border-radius: 2px;
	text-decoration: underline;
	box-decoration-break: clone;
	text-shadow: ${(p) => p.theme.shadow ?? "0 1px 2px rgba(0,0,0,0.9)"};
	${(p) => (p.$strong === true ? "outline: 1px solid currentColor;" : "")}
`;

export const RowText = ({ spans, paint }: { spans: readonly RowTextSpan[]; paint?: string }): ReactElement => (
	<>
		{spans.map((span, at) => {
			const ink = span.ink === undefined ? undefined : { color: span.ink };
			if (span.paint === true) {
				return (
					<Paint key={at} $strong={span.strong === true} {...(paint === undefined ? {} : { $paint: paint })} style={ink}>
						{span.text}
					</Paint>
				);
			}
			return (
				<span key={at} style={ink}>
					{span.text}
				</span>
			);
		})}
	</>
);
