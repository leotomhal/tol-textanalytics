/**
 * Rendering der Kennzahlen + Checkliste (Konzept 2.1, "Panel.ts").
 *
 * Bewusst mit Standard-DOM-APIs (createElement, appendChild, …) statt
 * Obsidians Komfort-Helfern (`el.createDiv()`, `el.empty()`, …) — die
 * werden nur innerhalb einer laufenden Obsidian-Instanz auf
 * `HTMLElement.prototype` nachgerüstet und stünden in Tests (jsdom, ohne
 * Obsidian) nicht zur Verfügung. Plain DOM funktioniert in beiden Welten.
 *
 * Die Interaktivität aus 2.4 (Klick auf Checklistenzeile togglet die
 * Markierung, Navigation zur Fundstelle) kommt erst mit M5, wenn es
 * Editor-Decorations gibt, auf die man umschalten kann — bis dahin sind
 * die Checklistenzeilen reine Anzeige.
 */

import type { Befund, Ergebnis, Kategorie } from "../analyse/types";

export interface PanelOptionen {
	/** Ersetzt die normale Anzeige durch einen Hinweistext (z. B. "Keine Notiz geöffnet"). */
	hinweis?: string;
	/** Auswahlbereich im Editor (Dokument-Offsets). Wenn gesetzt: Panel filtert statt neu zu analysieren (Konzept 2.2). */
	auswahl?: { von: number; bis: number };
}

const KATEGORIE_LABELS: Record<Kategorie, string> = {
	"langer-satz": "Lange Sätze",
	"sehr-langer-satz": "Sehr lange Sätze",
	"gleichfoermige-passage": "Gleichförmige Passagen",
	passiv: "Passiv",
	zustandspassiv: "Zustandspassiv",
	perfekt: "Perfekt",
	fuellwort: "Füllwörter",
	nominalstil: "Nominalstil",
	streckverb: "Streckverben",
	"seltenes-wort": "Seltene Wörter",
	wortwiederholung: "Wortwiederholungen",
	abkuerzung: "Abkürzungen",
};

export function filtereBefundeAufBereich(befunde: Befund[], von: number, bis: number): Befund[] {
	return befunde.filter((b) => b.von < bis && b.bis > von);
}

export function zaehleWoerterImBereich(
	woerter: { von: number; bis: number }[],
	von: number,
	bis: number
): number {
	return woerter.filter((w) => w.von >= von && w.bis <= bis).length;
}

function el(tag: string, klassen: string[], text?: string): HTMLElement {
	const element = document.createElement(tag);
	for (const k of klassen) element.classList.add(k);
	if (text !== undefined) element.textContent = text;
	return element;
}

function baueKennzahlZeile(k: Ergebnis["kennzahlen"][number]): HTMLElement {
	const zeile = el("div", ["textanalyse-kennzahl", `textanalyse-status-${k.status}`]);
	zeile.title = k.tooltip;

	const kopf = el("div", ["textanalyse-kennzahl-kopf"]);
	kopf.appendChild(el("span", ["textanalyse-kennzahl-label"], k.label));
	kopf.appendChild(el("span", ["textanalyse-kennzahl-wert"], k.anzeige));
	zeile.appendChild(kopf);

	if (k.nebenwert) {
		zeile.appendChild(el("div", ["textanalyse-kennzahl-neben"], k.nebenwert));
	}

	return zeile;
}

function baueChecklistenZeile(kategorie: Kategorie, anzahl: number): HTMLElement {
	const zeile = el("div", ["textanalyse-checkliste-zeile"]);
	zeile.appendChild(el("span", ["textanalyse-checkliste-label"], KATEGORIE_LABELS[kategorie]));
	zeile.appendChild(el("span", ["textanalyse-checkliste-anzahl"], String(anzahl)));
	return zeile;
}

function gruppiereBefunde(befunde: Befund[]): Map<Kategorie, number> {
	const gruppen = new Map<Kategorie, number>();
	for (const b of befunde) {
		gruppen.set(b.kategorie, (gruppen.get(b.kategorie) ?? 0) + 1);
	}
	return gruppen;
}

export function rendereePanel(container: HTMLElement, ergebnis: Ergebnis | null, optionen: PanelOptionen = {}): void {
	container.innerHTML = "";
	container.classList.add("textanalyse-panel");

	if (optionen.hinweis) {
		container.appendChild(el("div", ["textanalyse-hinweis"], optionen.hinweis));
		return;
	}

	if (!ergebnis) {
		container.appendChild(el("div", ["textanalyse-hinweis"], "Keine Analyse verfügbar."));
		return;
	}

	if (!ergebnis.istDeutsch) {
		container.appendChild(el("div", ["textanalyse-hinweis"], "Kein deutscher Text erkannt."));
		return;
	}

	if (ergebnis.aktuellerSatzAusgenommen) {
		container.appendChild(el("div", ["textanalyse-hinweis", "textanalyse-hinweis-dezent"], "aktueller Satz ausgenommen"));
	}
	if (ergebnis.schlussteilAbZeile !== undefined) {
		container.appendChild(
			el(
				"div",
				["textanalyse-hinweis", "textanalyse-hinweis-dezent"],
				`Schlussteil ab Zeile ${ergebnis.schlussteilAbZeile} ausgenommen`
			)
		);
	}

	if (optionen.auswahl) {
		const { von, bis } = optionen.auswahl;
		const anzahlWoerter = zaehleWoerterImBereich(ergebnis.woerter, von, bis);
		container.appendChild(el("div", ["textanalyse-auswahl-hinweis"], `Auswahl (${anzahlWoerter} Wörter)`));

		const befunde = filtereBefundeAufBereich(ergebnis.befunde, von, bis);
		const checkliste = el("div", ["textanalyse-checkliste"]);
		for (const [kategorie, anzahl] of gruppiereBefunde(befunde)) {
			checkliste.appendChild(baueChecklistenZeile(kategorie, anzahl));
		}
		container.appendChild(checkliste);
		return;
	}

	container.appendChild(
		el(
			"div",
			["textanalyse-wortzahl"],
			`${ergebnis.woerterGesamt} Wörter, davon ${ergebnis.woerterMaskiert} nicht analysiert`
		)
	);

	const kennzahlenContainer = el("div", ["textanalyse-kennzahlen"]);
	for (const k of ergebnis.kennzahlen) {
		kennzahlenContainer.appendChild(baueKennzahlZeile(k));
	}
	container.appendChild(kennzahlenContainer);

	const checkliste = el("div", ["textanalyse-checkliste"]);
	for (const [kategorie, anzahl] of gruppiereBefunde(ergebnis.befunde)) {
		checkliste.appendChild(baueChecklistenZeile(kategorie, anzahl));
	}
	container.appendChild(checkliste);
}
