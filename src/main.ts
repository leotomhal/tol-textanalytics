import { MarkdownView, Plugin, type Editor, type WorkspaceLeaf } from "obsidian";
import { EditorView } from "@codemirror/view";
import { analysiere } from "./analyse/index";
import { ladeDerewoFrequenzquelle, alleBekanntQuelle, mitUeberschreibungen } from "./analyse/wortschatz";
import type { Frequenzquelle } from "./analyse/wortschatz";
import type { Befund, Ergebnis, Kategorie } from "./analyse/types";
import { AnalyseView, ANALYSE_VIEW_TYPE } from "./view/AnalyseView";
import { debounce } from "./view/debounce";
import { ALLE_KATEGORIEN, setzeBefunde, setzeSichtbarkeit, textanalyseDecorationsExtension } from "./view/decorations";

/** Konzept 2.4: Panel aktualisiert nach 400 ms Tippruhe. */
const PANEL_DEBOUNCE_MS = 400;

/** Konzept 2.4: Markierungen erscheinen erst 1,5 s nach der letzten Eingabe. */
const MARKIERUNGEN_DEBOUNCE_MS = 1500;

/** Konzept 2.2: Ab ~20.000 Wörtern nur noch auf Knopfdruck analysieren. */
const MAX_LIVE_WOERTER = 20000;

interface GespeicherteDaten {
	ignorierteWoerter?: string[];
	immerMarkierenWoerter?: string[];
	sichtbareKategorien?: string[];
}

/**
 * Liest die zugrunde liegende CodeMirror-6-EditorView aus einem Obsidian-
 * `Editor`. `.cm` ist keine offizielle Obsidian-API — offiziell dokumentiert
 * ist nur die Gegenrichtung (`editorEditorField`, von innerhalb einer
 * CM6-Extension). `.cm` ist aber der de-facto-Standardweg, den praktisch
 * jedes Community-Plugin mit eigenen Decorations verwendet, und wird
 * gebraucht, um unsere StateEffects (siehe decorations.ts) an den Editor zu
 * schicken. Risiko: kann bei künftigen Obsidian-Updates brechen. In dieser
 * Sandbox nicht gegen eine echte Obsidian-Instanz testbar — vor
 * Produktivnutzung einmal im echten Vault prüfen.
 */
function holeEditorView(editor: Editor): EditorView | null {
	const cm = (editor as unknown as { cm?: unknown }).cm;
	return cm instanceof EditorView ? cm : null;
}

export default class TextanalysePlugin extends Plugin {
	private frequenzquelle: Frequenzquelle = alleBekanntQuelle;
	private ignorierteWoerter = new Set<string>();
	private immerMarkierenWoerter = new Set<string>();
	private sichtbareKategorien = new Set<Kategorie>(ALLE_KATEGORIEN);
	private vorherigeSichtbareKategorien: Set<Kategorie> | null = null;
	private letztesErgebnis: Ergebnis | null = null;

	async onload(): Promise<void> {
		await this.ladeGespeicherteDaten();

		this.registerView(ANALYSE_VIEW_TYPE, (leaf) => new AnalyseView(leaf));
		this.registerEditorExtension(textanalyseDecorationsExtension());

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
		this.addCommand({
			id: "textanalyse-markierungen-an-aus",
			name: "Markierungen an/aus",
			callback: () => this.toggleAlleMarkierungen(),
		});

		// Lädt asynchron im Hintergrund (siehe wortschatz.ts) — blockiert den
		// Plugin-Start nicht. Bis dahin läuft die Analyse mit dem
		// alleBekanntQuelle-Fallback (keine Fachwort-Korrektur).
		ladeDerewoFrequenzquelle()
			.then((quelle) => {
				this.frequenzquelle = quelle;
				this.aktualisiereAktiveNotiz({ erzwungen: false });
				this.aktualisiereDecorations();
			})
			.catch((fehler: unknown) => {
				console.error("Textanalyse: DeReWo-Wortliste konnte nicht geladen werden.", fehler);
			});

		const debouncedPanel = debounce(() => this.aktualisiereAktiveNotiz({ erzwungen: false }), PANEL_DEBOUNCE_MS);
		const debouncedMarkierungen = debounce(() => this.aktualisiereDecorations(), MARKIERUNGEN_DEBOUNCE_MS);

		this.registerEvent(
			this.app.workspace.on("editor-change", () => {
				debouncedPanel();
				debouncedMarkierungen();
			})
		);
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => {
				this.aktualisiereAktiveNotiz({ erzwungen: false });
				this.aktualisiereDecorations(); // sofort, neue Notiz hat noch keine Markierungen
			})
		);
	}

	onunload(): void {
		// registerView/registerEvent/registerEditorExtension räumen sich über Component#unload selbst auf.
	}

	private async ladeGespeicherteDaten(): Promise<void> {
		const daten = (await this.loadData()) as GespeicherteDaten | null;
		this.ignorierteWoerter = new Set(daten?.ignorierteWoerter ?? []);
		this.immerMarkierenWoerter = new Set(daten?.immerMarkierenWoerter ?? []);
		this.sichtbareKategorien = new Set(
			(daten?.sichtbareKategorien as Kategorie[] | undefined) ?? ALLE_KATEGORIEN
		);
	}

	private async persistiere(): Promise<void> {
		const daten: GespeicherteDaten = {
			ignorierteWoerter: Array.from(this.ignorierteWoerter),
			immerMarkierenWoerter: Array.from(this.immerMarkierenWoerter),
			sichtbareKategorien: Array.from(this.sichtbareKategorien),
		};
		await this.saveData(daten);
	}

	private effektiveFrequenzquelle(): Frequenzquelle {
		return mitUeberschreibungen(this.frequenzquelle, this.ignorierteWoerter, this.immerMarkierenWoerter);
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
		this.aktualisiereDecorations();
	}

	private getAnalyseView(): AnalyseView | null {
		const leaves = this.app.workspace.getLeavesOfType(ANALYSE_VIEW_TYPE);
		if (leaves.length === 0) return null;
		return leaves[0].view as AnalyseView;
	}

	/** Grobe, schnelle Schätzung vor der vollen Analyse — spart unnötige Arbeit bei sehr großen Notizen. */
	private istZuGrossFuerLiveAnalyse(text: string): boolean {
		return text.split(/\s+/).filter(Boolean).length > MAX_LIVE_WOERTER;
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

		if (this.istZuGrossFuerLiveAnalyse(text) && !optionen.erzwungen) {
			view.aktualisiere(null, {
				hinweis: `Notiz über ${MAX_LIVE_WOERTER.toLocaleString("de-DE")} Wörter — Analyse nur auf Knopfdruck (Command "Jetzt analysieren").`,
			});
			return;
		}

		const cursorOffset = editor.posToOffset(editor.getCursor());
		const ergebnis = analysiere(text, {
			frequenzquelle: this.effektiveFrequenzquelle(),
			cursorOffset,
		});
		this.letztesErgebnis = ergebnis;

		const auswahlText = editor.getSelection();
		const auswahl =
			auswahlText.length > 0
				? {
						von: editor.posToOffset(editor.getCursor("from")),
						bis: editor.posToOffset(editor.getCursor("to")),
					}
				: undefined;

		view.aktualisiere(ergebnis, {
			auswahl,
			sichtbareKategorien: this.sichtbareKategorien,
			aufErsteFundstelle: (kategorie) => this.springeZuFundstelle(kategorie, "erste"),
			aufNavigiere: (kategorie, richtung) => this.springeZuFundstelle(kategorie, richtung),
			aufSichtbarkeitToggle: (kategorie) => this.toggleKategorie(kategorie),
			aufWortIgnorieren: (wort) => this.wortIgnorieren(wort),
			aufWortImmerMarkieren: (wort) => this.wortImmerMarkieren(wort),
		});
	}

	/** Aktualisiert die Editor-Markierungen (Konzept 2.4) — läuft unabhängig vom Panel, eigene Verzögerung. */
	private aktualisiereDecorations(): void {
		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!markdownView) return;

		const editor = markdownView.editor;
		const cm = holeEditorView(editor);
		if (!cm) return; // z. B. Reading-Ansicht ohne CM6-Instanz — keine Markierung möglich.

		const text = editor.getValue();
		if (this.istZuGrossFuerLiveAnalyse(text)) return; // keine Live-Markierungen für riesige Notizen.

		const cursorOffset = editor.posToOffset(editor.getCursor());
		const ergebnis = analysiere(text, {
			frequenzquelle: this.effektiveFrequenzquelle(),
			cursorOffset,
		});
		this.letztesErgebnis = ergebnis;

		cm.dispatch({ effects: setzeBefunde.of(ergebnis.befunde) });
	}

	private dispatchSichtbarkeit(): void {
		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!markdownView) return;
		const cm = holeEditorView(markdownView.editor);
		if (!cm) return;
		cm.dispatch({ effects: setzeSichtbarkeit.of(new Set(this.sichtbareKategorien)) });
	}

	private toggleKategorie(kategorie: Kategorie): void {
		if (this.sichtbareKategorien.has(kategorie)) {
			this.sichtbareKategorien.delete(kategorie);
		} else {
			this.sichtbareKategorien.add(kategorie);
		}
		void this.persistiere();
		this.dispatchSichtbarkeit();
		this.aktualisiereAktiveNotiz({ erzwungen: false }); // Panel neu rendern (Schalter-Zustand)
	}

	private toggleAlleMarkierungen(): void {
		if (this.sichtbareKategorien.size > 0) {
			this.vorherigeSichtbareKategorien = new Set(this.sichtbareKategorien);
			this.sichtbareKategorien = new Set();
		} else {
			this.sichtbareKategorien = this.vorherigeSichtbareKategorien
				? new Set(this.vorherigeSichtbareKategorien)
				: new Set(ALLE_KATEGORIEN);
		}
		void this.persistiere();
		this.dispatchSichtbarkeit();
		this.aktualisiereAktiveNotiz({ erzwungen: false });
	}

	private wortIgnorieren(wort: string): void {
		const schluessel = wort.toLowerCase();
		this.ignorierteWoerter.add(schluessel);
		this.immerMarkierenWoerter.delete(schluessel);
		void this.persistiere();
		this.aktualisiereAktiveNotiz({ erzwungen: false });
		this.aktualisiereDecorations();
	}

	private wortImmerMarkieren(wort: string): void {
		const schluessel = wort.toLowerCase();
		this.immerMarkierenWoerter.add(schluessel);
		this.ignorierteWoerter.delete(schluessel);
		void this.persistiere();
		this.aktualisiereAktiveNotiz({ erzwungen: false });
		this.aktualisiereDecorations();
	}

	/** Klick auf Checklistenzeile ("erste") bzw. ‹/›-Navigation (Konzept, Abschnitt 6). */
	private springeZuFundstelle(kategorie: Kategorie, richtung: "erste" | "vor" | "zurueck"): void {
		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!markdownView || !this.letztesErgebnis) return;

		const treffer: Befund[] = this.letztesErgebnis.befunde
			.filter((b) => b.kategorie === kategorie)
			.sort((a, b) => a.von - b.von);
		if (treffer.length === 0) return;

		const editor = markdownView.editor;
		let ziel: Befund;

		if (richtung === "erste") {
			ziel = treffer[0];
		} else {
			const cursorOffset = editor.posToOffset(editor.getCursor());
			if (richtung === "vor") {
				ziel = treffer.find((b) => b.von > cursorOffset) ?? treffer[0];
			} else {
				ziel = [...treffer].reverse().find((b) => b.von < cursorOffset) ?? treffer[treffer.length - 1];
			}
		}

		const von = editor.offsetToPos(ziel.von);
		const bis = editor.offsetToPos(ziel.bis);
		editor.setSelection(von, bis);
		editor.scrollIntoView({ from: von, to: bis }, true);
	}
}
