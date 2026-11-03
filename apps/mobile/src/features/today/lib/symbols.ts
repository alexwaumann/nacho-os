import type { SymbolViewProps } from "expo-symbols";

/** An SF Symbol name (the string form of SymbolView's `name`) */
export type SFSymbol = Extract<SymbolViewProps["name"], string>;
