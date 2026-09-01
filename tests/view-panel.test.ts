// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { rendereePanel, filtereBefundeAufBereich, zaehleWoerterImBereich } from "../src/view/Panel";
import { analysiere } from "../src/analyse/index";
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
});
