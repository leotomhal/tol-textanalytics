import { describe, expect, it } from "vitest";
import { findeNominalstil } from "../src/analyse/stil/nominalstil";
import { segmentiereSaetze } from "../src/analyse/tokenize";

describe("findeNominalstil", () => {
	it("findet Substantivierungen mit den genannten Suffixen", () => {
		const text = "Die Durchführung der Untersuchung erfordert Vorbereitung.";
		const saetze = segmentiereSaetze(text);
		const befunde = findeNominalstil(saetze, text);
		const treffer = befunde.map((b) => b.text);
		expect(treffer).toContain("Durchführung");
		expect(treffer).toContain("Untersuchung");
		expect(treffer).toContain("Vorbereitung");
	});

	it("bevorzugt den längeren Suffix '-ierung' vor '-ung'", () => {
		const text = "Die Realisierung war schwierig.";
		const saetze = segmentiereSaetze(text);
		const befunde = findeNominalstil(saetze, text);
		expect(befunde).toHaveLength(1);
		expect(befunde[0].text).toBe("Realisierung");
	});

	it("schließt echte Substantive aus der Standard-Ausnahmeliste aus", () => {
		const text = "Die Zeitung berichtet über die Wohnung und die Wissenschaft.";
		const saetze = segmentiereSaetze(text);
		expect(findeNominalstil(saetze, text)).toHaveLength(0);
	});

	it("respektiert eine benutzerdefinierte Ausnahmeliste", () => {
		const text = "Die Sendung läuft heute.";
		const saetze = segmentiereSaetze(text);
		const ohneAusnahme = findeNominalstil(saetze, text, new Set());
		const mitAusnahme = findeNominalstil(saetze, text, new Set(["sendung"]));
		expect(ohneAusnahme).toHaveLength(1);
		expect(mitAusnahme).toHaveLength(0);
	});

	it("liefert keine Befunde für zu kurze Wörter mit zufällig passendem Suffix", () => {
		const text = "Er kam."; // "kam" enthält keinen Suffix, Kontrolltext
		const saetze = segmentiereSaetze(text);
		expect(findeNominalstil(saetze, text)).toHaveLength(0);
	});
});
