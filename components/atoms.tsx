import { type ReactElement, type ReactNode } from "react";
import styled from "styled-components";

/** Small reusable atoms: typography, chip, toolbar, legend. No feature logic. */

export const Typography = styled.span<{ $dim?: boolean; $size?: number }>`
	font-family: ${(p) => p.theme.mono};
	font-size: ${(p) => p.$size ?? 11}px;
	color: ${(p) => (p.$dim === true ? p.theme.dim : p.theme.text)};
`;

const ChipButton = styled.button<{ $on?: boolean }>`
	padding: 1px 9px;
	border-radius: 999px;
	border: 1px solid ${(p) => (p.$on === true ? p.theme.text : p.theme.edge)};
	background: ${(p) => (p.$on === true ? p.theme.panel : "transparent")};
	color: ${(p) => (p.$on === true ? p.theme.text : p.theme.dim)};
	font: 10.5px/16px ${(p) => p.theme.mono};
	cursor: pointer;
	&:hover { border-color: ${(p) => p.theme.text}; }
`;

export const Chip = ({ on, onClick, children, title }: { on?: boolean; onClick?: () => void; children: ReactNode; title?: string }): ReactElement => (
	<ChipButton type="button" $on={on} onClick={onClick} title={title}>
		{children}
	</ChipButton>
);

const Bar = styled.div`
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 6px;
	padding: 6px 8px;
	border-bottom: 1px solid ${(p) => p.theme.edge};
	background: ${(p) => p.theme.panel};
	font-family: ${(p) => p.theme.mono};
	font-size: 11px;
`;

export const Toolbar = ({ children }: { children: ReactNode }): ReactElement => <Bar data-toolbar>{children}</Bar>;

const LegendRow = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: 14px;
	align-items: center;
	padding: 5px 8px;
	border-bottom: 1px solid ${(p) => p.theme.edge};
	background: ${(p) => p.theme.panel};
	font: 11px ${(p) => p.theme.mono};
	color: ${(p) => p.theme.dim};
`;

const Dot = styled.span<{ $c: string }>`
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: ${(p) => p.$c};
	display: inline-block;
	margin-right: 5px;
`;

/** A legend generated from the theme's semantic keys — it can never disagree
 *  with what the board paints, because both read the same theme. */
export const Legend = ({ entries }: { entries: readonly { key: string; label: string; color: string }[] }): ReactElement => (
	<LegendRow data-legend>
		{entries.map((entry) => (
			<span key={entry.key}>
				<Dot $c={entry.color} />
				{entry.label}
			</span>
		))}
	</LegendRow>
);
