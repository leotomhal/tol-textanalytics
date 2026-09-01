/**
 * Datenmodell (Konzept 5). Kategorie/Befund/Kennzahl werden ab M2/M3
 * befüllt; hier bereits als Typen angelegt, damit `Ergebnis` von Anfang an
 * der Zielform entspricht und spätere Milestones nur noch füllen statt
 * die Schnittstelle zu ändern.
 */

export type Kategorie =
	| "langer-satz"
	| "sehr-langer-satz"
	| "gleichfoermige-passage"
	| "passiv"
	| "zustandspassiv"
	| "perfekt"
	| "fuellwort"
	| "nominalstil"
	| "streckverb"
	| "seltenes-wort"
	| "wortwiederholung"
	| "abkuerzung";

export type Sicherheit = "hoch" | "mittel";

export interface Befund {
	kategorie: Kategorie;
	von: number;
	bis: number;
	text: string;
	hinweis?: string;
	sicherheit: Sicherheit;
	ignorierbar: boolean;
}

export interface Kennzahl {
	id: string;
	label: string;
	wert: number;
	anzeige: string;
	nebenwert?: string;
	status: "gruen" | "gelb" | "rot" | "neutral";
	ziel?: string;
	sicherheit: Sicherheit;
	tooltip: string;
}

export interface Ergebnis {
	istDeutsch: boolean;
	/** Ab M2 befüllt (WSTF, LIX, Rhythmus, …). */
	kennzahlen: Kennzahl[];
	/** Ab M2/M3/M5 befüllt (Stilmarker, Markierungen). */
	befunde: Befund[];
	satzlaengen: number[];
	woerterGesamt: number;
	woerterMaskiert: number;
	schlussteilAbZeile?: number;
	dauerMs: number;
}
