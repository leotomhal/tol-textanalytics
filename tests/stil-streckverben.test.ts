import { describe, expect, it } from "vitest";
import { findeStreckverben } from "../src/analyse/stil/streckverben";
import { segmentiereSaetze } from "../src/analyse/tokenize";

describe("findeStreckverben", () => {
	it("findet eine bekannte Streckverb-Phrase (Wörter direkt aufeinanderfolgend)", () => {
		// Der Abgleich verlangt unmittelbar benachbarte Wörter — nach einem
		// Modalverb steht die Phrase tatsächlich so. Siehe "Bekannte Grenze"
		// im Kommentarkopf von streckverben.ts für den Fall getrennter
		// Wortstellung im Hauptsatz ("Die Methode kommt ... zur Anwendung").
		const text = "Die Methode soll zur Anwendung kommen.";
		const saetze = segmentiereSaetze(text);
		const befunde = findeStreckverben(saetze, text);
		expect(befunde).toHaveLength(1);
		expect(befunde[0].kategorie).toBe("streckverb");
	});

	it("liefert eine korrekte Fundstelle", () => {
		const text = "Wir wollen die Ergebnisse zur Verfügung stellen.";
		const saetze = segmentiereSaetze(text);
		const befunde = findeStreckverben(saetze, text);
		expect(befunde).toHaveLength(1);
		expect(text.slice(befunde[0].von, befunde[0].bis)).toBe(befunde[0].text);
	});

	it("findet nichts in einem Text ohne Streckverben", () => {
		const text = "Die Methode wirkt gut.";
		const saetze = segmentiereSaetze(text);
		expect(findeStreckverben(saetze, text)).toHaveLength(0);
	});

	it("respektiert eine benutzerdefinierte Liste", () => {
		const text = "Wir bringen das Projekt zum Abschluss.";
		const saetze = segmentiereSaetze(text);
		const befunde = findeStreckverben(saetze, text, ["zum abschluss"]);
		expect(befunde).toHaveLength(1);
	});
});
