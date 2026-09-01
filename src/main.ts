import { MarkdownView, Plugin, type WorkspaceLeaf } from "obsidian";
import { analysiere } from "./analyse/index";
import { ladeDerewoFrequenzquelle, alleBekanntQuelle } from "./analyse/wortschatz";
import type { Frequenzquelle } from "./analyse/wortschatz";
import { AnalyseView, ANALYSE_VIEW_TYPE } from "./view/AnalyseView";
import { debounce } from "./view/debounce";

/** Konzept 2.4: Panel aktualisiert nach 400 ms Tippruhe. */
const PANEL_DEBOUNCE_MS = 400;

/** Konzept 2.2: Ab ~20.000 Wörtern nur noch auf Knopfdruck analysieren. */
const MAX_LIVE_WOERTER = 20000;

export default class TextanalysePlugin extends Plugin {
	private frequenzquelle: Frequenzquelle = alleBekanntQuelle;

	async onload(): Promise<void> {
		this.registerView(ANALYSE_VIEW_TYPE, (leaf) => new AnalyseView(leaf));

		this.addCommand({
			id: "textanalyse-panel-oeffnen-schliessen",
			name: "Panel öffnen/schließen",
			callback: () => this.togglePanel(),
		});

		this.addCommand({
			id: "textanalyse-jetzt-analysieren",
			name: "Jetzt analysieren (auch bei großen Notizen)",
			callback: () => this.aktualisiereAktiveNotiz({ erzwungen: true }),
		});

		// Lädt asynchron im Hintergrund (siehe wortschatz.ts) — blockiert den
		// Plugin-Start nicht. Bis dahin läuft die Analyse mit dem
		// alleBekanntQuelle-Fallback (keine Fachwort-Korrektur).
		ladeDerewoFrequenzquelle()
			.then((quelle) => {
				this.frequenzquelle = quelle;
				this.aktualisiereAktiveNotiz({ erzwungen: false });
			})
			.catch((fehler: unknown) => {
				console.error("Textanalyse: DeReWo-Wortliste konnte nicht geladen werden.", fehler);
			});

		const debouncedAktualisierung = debounce(
			() => this.aktualisiereAktiveNotiz({ erzwungen: false }),
			PANEL_DEBOUNCE_MS
		);

		this.registerEvent(this.app.workspace.on("editor-change", () => debouncedAktualisierung()));
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => this.aktualisiereAktiveNotiz({ erzwungen: false }))
		);
	}

	onunload(): void {
		// registerView/registerEvent räumen sich über Component#unload selbst auf.
	}

	private async togglePanel(): Promise<void> {
		const bestehende = this.app.workspace.getLeavesOfType(ANALYSE_VIEW_TYPE);
		if (bestehende.length > 0) {
			for (const leaf of bestehende) leaf.detach();
			return;
		}

		const leaf: WorkspaceLeaf | null = this.app.workspace.getRightLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({ type: ANALYSE_VIEW_TYPE, active: true });
		this.app.workspace.revealLeaf(leaf);
		this.aktualisiereAktiveNotiz({ erzwungen: false });
	}

	private getAnalyseView(): AnalyseView | null {
		const leaves = this.app.workspace.getLeavesOfType(ANALYSE_VIEW_TYPE);
		if (leaves.length === 0) return null;
		return leaves[0].view as AnalyseView;
	}

	private aktualisiereAktiveNotiz(optionen: { erzwungen: boolean }): void {
		const view = this.getAnalyseView();
		if (!view) return; // Panel nicht offen — nichts zu tun, spart Rechenzeit.

		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!markdownView) {
			view.aktualisiere(null, { hinweis: "Keine Notiz geöffnet." });
			return;
		}

		const editor = markdownView.editor;
		const text = editor.getValue();

		// Grobe, schnelle Schätzung vor der vollen Analyse — die exakte
		// Wortzahl kennt erst analysiere() selbst.
		const wortzahlGrob = text.split(/\s+/).filter(Boolean).length;
		if (wortzahlGrob > MAX_LIVE_WOERTER && !optionen.erzwungen) {
			view.aktualisiere(null, {
				hinweis: `Notiz über ${MAX_LIVE_WOERTER.toLocaleString("de-DE")} Wörter — Analyse nur auf Knopfdruck (Command "Jetzt analysieren").`,
			});
			return;
		}

		const cursorOffset = editor.posToOffset(editor.getCursor());
		const ergebnis = analysiere(text, {
			frequenzquelle: this.frequenzquelle,
			cursorOffset,
		});

		const auswahlText = editor.getSelection();
		const auswahl =
			auswahlText.length > 0
				? {
						von: editor.posToOffset(editor.getCursor("from")),
						bis: editor.posToOffset(editor.getCursor("to")),
					}
				: undefined;

		view.aktualisiere(ergebnis, { auswahl });
	}
}
