/**
 * Rendering der Kennzahlen + Checkliste (Konzept 2.1, "Panel.ts").
 *
 * Bewusst mit Standard-DOM-APIs (createElement, appendChild, …) statt
 * Obsidians Komfort-Helfern (`el.createDiv()`, `el.empty()`, …) — die
 * werden nur innerhalb einer laufenden Obsidian-Instanz auf
 * `HTMLElement.prototype` nachgerüstet und stünden in Tests (jsdom, ohne
 * Obsidian) nicht zur Verfügung. Plain DOM funktioniert in beiden Welten.
 *
 * Stand M5: Checklistenzeilen sind jetzt interaktiv (Konzept 2.4) — Klick
 * springt zur ersten Fundstelle, ‹/› navigieren durch die Fundstellen
 * derselben Kategorie. Für "seltenes-wort" zusätzlich eine Liste der
 * distinkten seltenen Wörter mit "kenne ich"-Aktion (Konzept 3.5), plus
 * ein kleines Formular für die Gegenrichtung ("immer markieren"). Panel.ts
 * selbst verändert nichts — jede Aktion läuft über einen Callback, den
 * main.ts (mit Zugriff auf Editor und saveData) bereitstellt.
 */

import type { Befund, Ergebnis, Kategorie } from "../analyse/types";

export interface PanelOptionen {
	/** Ersetzt die normale Anzeige durch einen Hinweistext (z. B. "Keine Notiz geöffnet"). */
	hinweis?: string;
	/** Auswahlbereich im Editor (Dokument-Offsets). Wenn gesetzt: Panel filtert statt neu zu analysieren (Konzept 2.2). */
	auswahl?: { von: number; bis: number };
	/** Springt zur ersten Fundstelle der Kategorie (Klick auf die Checklistenzeile). */
	aufErsteFundstelle?: (kategorie: Kategorie) => void;
	/** Navigiert zur nächsten/vorherigen Fundstelle derselben Kategorie (‹/›-Buttons). */
	aufNavigiere?: (kategorie: Kategorie, richtung: "vor" | "zurueck") => void;
	/**
	 * Welche Kategorien aktuell im Editor markiert werden (Konzept 2.4).
	 * Steuert den Sichtbarkeits-Schalter in der Checklistenzeile — getrennt
	 * vom Klick auf die Zeile selbst, der zur Fundstelle springt (Konzept,
	 * Abschnitt 6). Ohne `aufSichtbarkeitToggle` wird kein Schalter gezeigt.
	 */
	sichtbareKategorien?: ReadonlySet<Kategorie>;
	aufSichtbarkeitToggle?: (kategorie: Kategorie) => void;
	/** "kenne ich" — Wort künftig nicht mehr als selten/Fachbegriff werten. */
	aufWortIgnorieren?: (wort: string) => void;
	/** Gegenrichtung: Wort trotz Bekanntheit künftig immer als selten markieren. */
	aufWortImmerMarkieren?: (wort: string) => void;
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

const MAX_SELTENE_WOERTER_ANZEIGE = 20;

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

/** Distinkte Wörter aus "seltenes-wort"-Befunden, ohne Duplikate, gedeckelt. */
export function distinkteSelteneWoerter(befunde: Befund[]): string[] {
	const gesehen = new Map<string, string>(); // Kleinschreibung -> Originalschreibweise des ersten Treffers
	for (const b of befunde) {
		if (b.kategorie !== "seltenes-wort") continue;
		const schluessel = b.text.toLowerCase();
		if (!gesehen.has(schluessel)) gesehen.set(schluessel, b.text);
	}
	return Array.from(gesehen.values()).slice(0, MAX_SELTENE_WOERTER_ANZEIGE);
}

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	klassen: string[],
	text?: string
): HTMLElementTagNameMap[K] {
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

function baueChecklistenZeile(
	kategorie: Kategorie,
	anzahl: number,
	optionen: PanelOptionen
): HTMLElement {
	const zeile = el("div", ["textanalyse-checkliste-zeile"]);
	const label = el("span", ["textanalyse-checkliste-label"], KATEGORIE_LABELS[kategorie]);
	const rechts = el("span", ["textanalyse-checkliste-rechts"]);

	if (optionen.aufSichtbarkeitToggle) {
		const sichtbar = optionen.sichtbareKategorien?.has(kategorie) ?? true;
		const schalter = el("button", ["textanalyse-sichtbarkeit-schalter"], sichtbar ? "👁" : "🚫");
		schalter.type = "button";
		schalter.setAttribute(
			"aria-label",
			`Markierung ${sichtbar ? "ausblenden" : "einblenden"}: ${KATEGORIE_LABELS[kategorie]}`
		);
		schalter.title = sichtbar ? "Markierung im Editor ausblenden" : "Markierung im Editor einblenden";
		schalter.addEventListener("click", (ev) => {
			ev.stopPropagation();
			optionen.aufSichtbarkeitToggle?.(kategorie);
		});
		rechts.appendChild(schalter);
	}

	if (optionen.aufNavigiere) {
		const zurueck = el("button", ["textanalyse-nav-button"], "‹");
		zurueck.type = "button";
		zurueck.setAttribute("aria-label", `Vorherige Fundstelle: ${KATEGORIE_LABELS[kategorie]}`);
		zurueck.addEventListener("click", (ev) => {
			ev.stopPropagation();
			optionen.aufNavigiere?.(kategorie, "zurueck");
		});
		rechts.appendChild(zurueck);
	}

	rechts.appendChild(el("span", ["textanalyse-checkliste-anzahl"], String(anzahl)));

	if (optionen.aufNavigiere) {
		const vor = el("button", ["textanalyse-nav-button"], "›");
		vor.type = "button";
		vor.setAttribute("aria-label", `Nächste Fundstelle: ${KATEGORIE_LABELS[kategorie]}`);
		vor.addEventListener("click", (ev) => {
			ev.stopPropagation();
			optionen.aufNavigiere?.(kategorie, "vor");
		});
		rechts.appendChild(vor);
	}

	zeile.appendChild(label);
	zeile.appendChild(rechts);

	if (optionen.aufErsteFundstelle) {
		zeile.classList.add("textanalyse-checkliste-klickbar");
		zeile.addEventListener("click", () => optionen.aufErsteFundstelle?.(kategorie));
	}

	return zeile;
}

function gruppiereBefunde(befunde: Befund[]): Map<Kategorie, number> {
	const gruppen = new Map<Kategorie, number>();
	for (const b of befunde) {
		gruppen.set(b.kategorie, (gruppen.get(b.kategorie) ?? 0) + 1);
	}
	return gruppen;
}

function baueChecklistenContainer(befunde: Befund[], optionen: PanelOptionen): HTMLElement {
	const checkliste = el("div", ["textanalyse-checkliste"]);
	for (const [kategorie, anzahl] of gruppiereBefunde(befunde)) {
		checkliste.appendChild(baueChecklistenZeile(kategorie, anzahl, optionen));
	}
	return checkliste;
}

function baueWortschatzSektion(befunde: Befund[], optionen: PanelOptionen): HTMLElement | null {
	const woerter = distinkteSelteneWoerter(befunde);
	if (woerter.length === 0 && !optionen.aufWortImmerMarkieren) return null;

	const sektion = el("div", ["textanalyse-wortschatz-sektion"]);

	if (woerter.length > 0) {
		const liste = el("div", ["textanalyse-wortschatz-liste"]);
		for (const wort of woerter) {
			const chip = el("span", ["textanalyse-wort-chip"]);
			chip.appendChild(document.createTextNode(wort + " "));
			if (optionen.aufWortIgnorieren) {
				const button = el("button", ["textanalyse-wort-ignorieren"], "kenne ich");
				button.type = "button";
				button.title = `"${wort}" künftig nicht mehr als seltenes Wort/Fachbegriff werten`;
				button.addEventListener("click", () => optionen.aufWortIgnorieren?.(wort));
				chip.appendChild(button);
			}
			liste.appendChild(chip);
		}
		sektion.appendChild(liste);
	}

	if (optionen.aufWortImmerMarkieren) {
		const formular = el("div", ["textanalyse-immer-markieren-formular"]);
		const eingabe = document.createElement("input");
		eingabe.type = "text";
		eingabe.placeholder = "Wort immer als selten markieren …";
		eingabe.classList.add("textanalyse-immer-markieren-eingabe");
		const button = el("button", ["textanalyse-immer-markieren-button"], "hinzufügen");
		button.type = "button";
		const absenden = () => {
			const wort = eingabe.value.trim();
			if (wort.length === 0) return;
			optionen.aufWortImmerMarkieren?.(wort);
			eingabe.value = "";
		};
		button.addEventListener("click", absenden);
		eingabe.addEventListener("keydown", (ev) => {
			if (ev.key === "Enter") absenden();
		});
		formular.appendChild(eingabe);
		formular.appendChild(button);
		sektion.appendChild(formular);
	}

	return sektion;
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
		container.appendChild(baueChecklistenContainer(filtereBefundeAufBereich(ergebnis.befunde, von, bis), optionen));
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

	container.appendChild(baueChecklistenContainer(ergebnis.befunde, optionen));

	const wortschatzSektion = baueWortschatzSektion(ergebnis.befunde, optionen);
	if (wortschatzSektion) container.appendChild(wortschatzSektion);
}
