import type { Theme } from "./types.js";

// The package's own theme is styled-components' theme: one declaration, so
// `p.theme.paper` is typed everywhere without a cast.
declare module "styled-components" {
	export interface DefaultTheme extends Theme {}
}
