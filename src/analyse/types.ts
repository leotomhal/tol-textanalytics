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

export type KennzahlStatus = "gruen" | "gelb" | "rot" | "neutral";

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
	status: KennzahlStatus;
	ziel?: string;
	sicherheit: Sicherheit;
	tooltip: string;
}

/**
 * Zielwertprofil (Konzept 4.3). Alle Zielwerte sind "≤"-Obergrenzen und
 * optional — ein Profil ohne einen bestimmten Zielwert liefert für die
 * zugehörige Kennzahl `status: "neutral"` (siehe Profil "Frei": "keine
 * Schwellen, nur Zahlen"). Werte sind gesetzt, nicht gemessen (Konzept
 * 4.3) — jedes Standardprofil und jedes selbst angelegte ist in den
 * Settings direkt editierbar.
 */
export interface Profil {
	id: string;
	name: string;
	zielSchulstufe?: number;
	zielSatzlaenge?: number;
	/** in %. */
	zielPassivquote?: number;
	/** Treffer je 100 Wörter. */
	zielNominalstil?: number;
	/** in %. */
	zielLangeSaetze?: number;
}

export interface Ergebnis {
	istDeutsch: boolean;
	/** Ab M2 befüllt (WSTF, LIX, Rhythmus, …). */
	kennzahlen: Kennzahl[];
	/** Ab M2/M3/M5 befüllt (Stilmarker, Markierungen). */
	befunde: Befund[];
	/**
	 * Die analysierten Wörter mit Dokument-Offsets (nach Maskierung und
	 * ggf. Cursor-Satz-Ausschluss). Ab M4 für die Panel-Auswahlfilterung
	 * (Konzept 2.2) und ab M5 für die Editor-Decorations gebraucht.
	 */
	woerter: { text: string; von: number; bis: number }[];
	satzlaengen: number[];
	woerterGesamt: number;
	woerterMaskiert: number;
	/** true, wenn der Satz unter dem Cursor aus Kennzahlen/Befunden ausgenommen wurde (Konzept 2.2). */
	aktuellerSatzAusgenommen: boolean;
	schlussteilAbZeile?: number;
	dauerMs: number;
}
