import { ItemView, type WorkspaceLeaf } from "obsidian";
import type { Ergebnis } from "../analyse/types";
import { rendereePanel, type PanelOptionen } from "./Panel";

export const ANALYSE_VIEW_TYPE = "textanalyse-panel";

/**
 * ItemView im rechten Sidebar-Leaf (Konzept 2.1). Hält nur den zuletzt
 * übergebenen Zustand und delegiert das eigentliche Rendering an
 * Panel.ts — die View selbst enthält keine Analyse-Logik.
 */
export class AnalyseView extends ItemView {
	private ergebnis: Ergebnis | null = null;
	private optionen: PanelOptionen = {};

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return ANALYSE_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Textanalyse";
	}

	getIcon(): string {
		return "file-text";
	}

	protected async onOpen(): Promise<void> {
		this.render();
	}

	/** Ersetzt den angezeigten Zustand und rendert neu. */
	aktualisiere(ergebnis: Ergebnis | null, optionen: PanelOptionen = {}): void {
		this.ergebnis = ergebnis;
		this.optionen = optionen;
		this.render();
	}

	private render(): void {
		rendereePanel(this.contentEl, this.ergebnis, this.optionen);
	}
}
