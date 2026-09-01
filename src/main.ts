import { Plugin } from "obsidian";

/**
 * Einstiegspunkt des Plugins. Commands, Settings-Registrierung und die
 * Sidebar-View kommen in M4 hinzu (siehe konzept-textanalyse-plugin.md, 2.1).
 */
export default class TextanalysePlugin extends Plugin {
	async onload(): Promise<void> {
		// Platzhalter für M0. Wird ab M4 mit AnalyseView, Commands und
		// Settings-Tab befüllt.
	}

	onunload(): void {
		// Aktuell nichts freizugeben.
	}
}
