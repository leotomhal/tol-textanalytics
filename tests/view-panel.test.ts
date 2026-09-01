// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
	rendereePanel,
	filtereBefundeAufBereich,
	zaehleWoerterImBereich,
	distinkteSelteneWoerter,
} from "../src/view/Panel";
import { analysiere, alleBekanntQuelle } from "../src/analyse/index";
import { mitUeberschreibungen } from "../src/analyse/wortschatz";
import type { Befund, Ergebnis } from "../src/analyse/types";

function leeresErgebnis(): Ergebnis {
	return {
		istDeutsch: true,
		kennzahlen: [],
		befunde: [],
		woerter: [],
		satzlaengen: [],
		woerterGesamt: 0,
		woerterMaskiert: 0,
		aktuellerSatzAusgenommen: false,
		dauerMs: 0,
	};
}

describe("filtereBefundeAufBereich", () => {
	it("behält nur Befunde, die den Bereich überlappen", () => {
		const befunde: Befund[] = [
			{ kategorie: "fuellwort", von: 0, bis: 5, text: "a", sicherheit: "hoch", ignorierbar: false },
			{ kategorie: "fuellwort", von: 10, bis: 15, text: "b", sicherheit: "hoch", ignorierbar: false },
		];
		expect(filtereBefundeAufBereich(befunde, 0, 8)).toHaveLength(1);
		expect(filtereBefundeAufBereich(befunde, 8, 20)).toHaveLength(1);
		expect(filtereBefundeAufBereich(befunde, 0, 20)).toHaveLength(2);
	});
});

describe("zaehleWoerterImBereich", () => {
	it("zählt nur Wörter vollständig innerhalb des Bereichs", () => {
		const woerter = [
			{ von: 0, bis: 3 },
			{ von: 5, bis: 8 },
			{ von: 10, bis: 13 },
		];
		expect(zaehleWoerterImBereich(woerter, 0, 8)).toBe(2);
		expect(zaehleWoerterImBereich(woerter, 0, 20)).toBe(3);
	});
});

describe("rendereePanel", () => {
	it("zeigt einen Hinweistext und sonst nichts", () => {
		const container = document.createElement("div");
		rendereePanel(container, null, { hinweis: "Keine Notiz geöffnet." });
		expect(container.textContent).toContain("Keine Notiz geöffnet.");
		expect(container.querySelector(".textanalyse-kennzahlen")).toBeNull();
	});

	it("zeigt 'Kein deutscher Text erkannt' für nicht-deutsche Ergebnisse", () => {
		const container = document.createElement("div");
		const ergebnis = { ...leeresErgebnis(), istDeutsch: false };
		rendereePanel(container, ergebnis);
		expect(container.textContent).toContain("Kein deutscher Text erkannt");
	});

	it("rendert Kennzahlen und Checkliste für ein vollständiges Ergebnis", () => {
		const container = document.createElement("div");
		const ergebnis = analysiere(
			"Die Untersuchung hat eigentlich gezeigt, dass die Methode zur Anwendung kommen sollte."
		);
		rendereePanel(container, ergebnis);

		const kennzahlZeilen = container.querySelectorAll(".textanalyse-kennzahl");
		expect(kennzahlZeilen.length).toBe(ergebnis.kennzahlen.length);
		expect(kennzahlZeilen.length).toBeGreaterThan(0);

		const checklistenZeilen = container.querySelectorAll(".textanalyse-checkliste-zeile");
		expect(checklistenZeilen.length).toBeGreaterThan(0);
	});

	it("zeigt den 'aktueller Satz ausgenommen'-Hinweis, wenn gesetzt", () => {
		const container = document.createElement("div");
		const ergebnis = { ...leeresErgebnis(), aktuellerSatzAusgenommen: true };
		rendereePanel(container, ergebnis);
		expect(container.textContent).toContain("aktueller Satz ausgenommen");
	});

	it("zeigt den Schlussteil-Hinweis mit Zeilennummer, wenn gesetzt", () => {
		const container = document.createElement("div");
		const ergebnis = { ...leeresErgebnis(), schlussteilAbZeile: 7 };
		rendereePanel(container, ergebnis);
		expect(container.textContent).toContain("Schlussteil ab Zeile 7");
	});

	it("filtert bei gesetzter Auswahl statt Kennzahlen zu zeigen, mit Wortzahl", () => {
		const container = document.createElement("div");
		const text = "Die Untersuchung zeigt Ergebnisse. Ein zweiter Satz mit mehr Inhalt folgt hier.";
		const ergebnis = analysiere(text);
		const ersterSatz = ergebnis.woerter.filter((w) => w.bis <= text.indexOf(". ") + 1);
		const von = ersterSatz[0]?.von ?? 0;
		const bis = ersterSatz[ersterSatz.length - 1]?.bis ?? 0;

		rendereePanel(container, ergebnis, { auswahl: { von, bis } });

		expect(container.textContent).toMatch(/Auswahl \(\d+ Wörter\)/);
		expect(container.querySelector(".textanalyse-kennzahlen")).toBeNull();
	});

	it("löscht vorherigen Inhalt bei erneutem Aufruf (kein Doppel-Rendering)", () => {
		const container = document.createElement("div");
		rendereePanel(container, leeresErgebnis());
		rendereePanel(container, leeresErgebnis());
		expect(container.querySelectorAll(".textanalyse-wortzahl")).toHaveLength(1);
	});

	it("ruft aufErsteFundstelle beim Klick auf eine Checklistenzeile auf", () => {
		const container = document.createElement("div");
		const ergebnis = analysiere("Das ist eigentlich ganz einfach und wirklich eigentlich klar.");
		const aufErsteFundstelle = vi.fn();
		rendereePanel(container, ergebnis, { aufErsteFundstelle });

		const zeile = container.querySelector(".textanalyse-checkliste-zeile.textanalyse-checkliste-klickbar");
		expect(zeile).not.toBeNull();
		(zeile as HTMLElement).click();
		expect(aufErsteFundstelle).toHaveBeenCalledWith("fuellwort");
	});

	it("ruft aufNavigiere mit der richtigen Richtung auf und stoppt die Klick-Weiterleitung an die Zeile", () => {
		const container = document.createElement("div");
		const ergebnis = analysiere("Das ist eigentlich ganz einfach und wirklich eigentlich klar.");
		const aufNavigiere = vi.fn();
		const aufErsteFundstelle = vi.fn();
		rendereePanel(container, ergebnis, { aufNavigiere, aufErsteFundstelle });

		const buttons = container.querySelectorAll(".textanalyse-nav-button");
		expect(buttons.length).toBeGreaterThan(0);
		(buttons[0] as HTMLElement).click();
		expect(aufNavigiere).toHaveBeenCalledWith("fuellwort", "zurueck");
		// Klick auf den Button darf nicht zusätzlich die Zeile als Ganzes auslösen.
		expect(aufErsteFundstelle).not.toHaveBeenCalled();
	});

	it("toggelt die Sichtbarkeit separat vom Sprung zur Fundstelle (kein Konflikt zwischen beiden Klick-Verhalten)", () => {
		const container = document.createElement("div");
		const ergebnis = analysiere("Das ist eigentlich ganz einfach und wirklich eigentlich klar.");
		const aufSichtbarkeitToggle = vi.fn();
		const aufErsteFundstelle = vi.fn();
		rendereePanel(container, ergebnis, {
			aufSichtbarkeitToggle,
			aufErsteFundstelle,
			sichtbareKategorien: new Set(["fuellwort"]),
		});

		const schalter = container.querySelector(".textanalyse-sichtbarkeit-schalter") as HTMLElement;
		expect(schalter).not.toBeNull();
		schalter.click();
		expect(aufSichtbarkeitToggle).toHaveBeenCalledWith("fuellwort");
		expect(aufErsteFundstelle).not.toHaveBeenCalled();
	});

	it("zeigt seltene Wörter mit 'kenne ich'-Button und löst den Callback mit dem Wort aus", () => {
		const container = document.createElement("div");
		const quelle = mitUeberschreibungen(alleBekanntQuelle, new Set(), new Set(["fachbegriff"]));
		const ergebnis = analysiere("Das ist ein Fachbegriff im Text.", { frequenzquelle: quelle });
		const aufWortIgnorieren = vi.fn();
		rendereePanel(container, ergebnis, { aufWortIgnorieren });

		const button = container.querySelector(".textanalyse-wort-ignorieren");
		expect(button).not.toBeNull();
		(button as HTMLElement).click();
		expect(aufWortIgnorieren).toHaveBeenCalledWith("Fachbegriff");
	});

	it("löst aufWortImmerMarkieren beim Absenden des Formulars aus", () => {
		const container = document.createElement("div");
		rendereePanel(container, analysiere("Ein Satz mit genug Inhalt für die Analyse hier."), {
			aufWortImmerMarkieren: vi.fn(),
		});
		const eingabe = container.querySelector(".textanalyse-immer-markieren-eingabe") as HTMLInputElement;
		const button = container.querySelector(".textanalyse-immer-markieren-button") as HTMLElement;
		expect(eingabe).not.toBeNull();
		expect(button).not.toBeNull();
	});

	it("zeigt in jeder Checklistenzeile einen Farbpunkt und eine Kurzerklärung (Konzept-Feedback)", () => {
		const container = document.createElement("div");
		const ergebnis = analysiere("Das ist eigentlich ganz einfach und wirklich eigentlich klar.");
		rendereePanel(container, ergebnis);

		const zeile = container.querySelector(".textanalyse-checkliste-zeile") as HTMLElement;
		expect(zeile).not.toBeNull();
		const punkt = zeile.querySelector(".textanalyse-farbpunkt") as HTMLElement;
		expect(punkt).not.toBeNull();
		expect(punkt.style.getPropertyValue("--textanalyse-farbpunkt-farbe")).toContain("--color-blue-hsl");
		expect(zeile.querySelector(".textanalyse-checkliste-erklaerung")?.textContent).toBeTruthy();
	});

	it("sortiert die Checkliste nach Häufigkeit absteigend", () => {
		const container = document.createElement("div");
		// "eigentlich" (Füllwort) kommt zweimal vor, "wirklich" (Füllwort) einmal —
		// beide zusammen sollten aber häufiger sein als eine seltene Einzelkategorie.
		const ergebnis = analysiere(
			"Das ist eigentlich ganz einfach und wirklich eigentlich klar, wobei die Untersuchung zur Anwendung kommen sollte."
		);
		rendereePanel(container, ergebnis);

		const anzahlen = Array.from(container.querySelectorAll(".textanalyse-checkliste-anzahl")).map((el) =>
			Number(el.textContent)
		);
		const sortiert = [...anzahlen].sort((a, b) => b - a);
		expect(anzahlen).toEqual(sortiert);
	});

	it("gruppiert die Kennzahlen unter Gruppentiteln statt einer flachen Liste", () => {
		const container = document.createElement("div");
		const ergebnis = analysiere(
			"Die Untersuchung hat eigentlich gezeigt, dass die Methode zur Anwendung kommen sollte."
		);
		rendereePanel(container, ergebnis);

		const gruppentitel = Array.from(container.querySelectorAll(".textanalyse-kennzahl-gruppentitel")).map(
			(el) => el.textContent
		);
		expect(gruppentitel).toEqual(expect.arrayContaining(["Verständlichkeit", "Satzbau", "Stil"]));

		const kennzahlZeilen = container.querySelectorAll(".textanalyse-kennzahl");
		expect(kennzahlZeilen.length).toBe(ergebnis.kennzahlen.length);
	});

	it("zeigt die Kennzahl-Erklärung immer sichtbar statt nur als Hover-Titel", () => {
		const container = document.createElement("div");
		const ergebnis = analysiere(
			"Die Untersuchung hat eigentlich gezeigt, dass die Methode zur Anwendung kommen sollte."
		);
		rendereePanel(container, ergebnis);

		const tooltipZeile = container.querySelector(".textanalyse-kennzahl-tooltip");
		expect(tooltipZeile).not.toBeNull();
		expect(tooltipZeile?.textContent?.length).toBeGreaterThan(0);
	});
});

describe("distinkteSelteneWoerter", () => {
	function seltenesWort(text: string): Befund {
		return { kategorie: "seltenes-wort", von: 0, bis: text.length, text, sicherheit: "mittel", ignorierbar: true };
	}

	it("dedupliziert unabhängig von Groß-/Kleinschreibung und behält die erste Schreibweise", () => {
		const befunde = [seltenesWort("Fachbegriff"), seltenesWort("fachbegriff"), seltenesWort("Anderswort")];
		expect(distinkteSelteneWoerter(befunde)).toEqual(["Fachbegriff", "Anderswort"]);
	});

	it("ignoriert Befunde anderer Kategorien", () => {
		const andere: Befund = { kategorie: "fuellwort", von: 0, bis: 3, text: "abc", sicherheit: "hoch", ignorierbar: false };
		expect(distinkteSelteneWoerter([andere])).toEqual([]);
	});

	it("deckelt die Liste auf 20 Einträge", () => {
		const befunde = Array.from({ length: 30 }, (_, i) => seltenesWort(`wort${i}`));
		expect(distinkteSelteneWoerter(befunde)).toHaveLength(20);
	});
});
