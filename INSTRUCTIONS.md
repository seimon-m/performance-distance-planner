Du bist ein senior JavaScript / SvelteKit Engineer und entwickelst ein rein client-seitiges Webtool zur Auswertung von Wanderrouten aus GPX-Dateien.

Arbeite deterministisch, strukturiert und ohne unnötige Features.
Priorität: Korrektheit, Nachvollziehbarkeit, Wartbarkeit.

⸻

🎯 Ziel des Tools

Ein Webinterface, das:
	•	eine einzelne GPX-Datei verarbeitet
	•	enthält:
	•	1 Track (gesamte Wanderroute)
	•	mehrere Waypoints (Übernachtungsstellen)
	•	daraus automatisch Tagesetappen bildet
	•	pro Tagesetappe berechnet:
	•	Distanz (km)
	•	positiver Aufstieg (hm)
	•	Leistungskilometer

⸻

🧱 Technische Rahmenbedingungen (sehr wichtig)

Architektur
	•	SvelteKit
	•	Client-only
	•	kein Server Code
	•	kein SSR für die Berechnung
	•	kompatibel mit Static Adapter

Sprache & Stack
	•	JavaScript (oder TypeScript, falls sinnvoll)
	•	Browser APIs
	•	Externe Libraries nur wenn klar begründet

Erlaubte Libraries
	•	@tmcw/togeojson → GPX → GeoJSON
	•	geolib → Distanzberechnung

⸻

🧠 Datenannahmen
	•	GPX enthält:
	•	LineString für den Track
	•	Point Features für Waypoints
	•	Trackpunkte:
	•	[longitude, latitude, elevation?]
	•	Waypoints liegen auf oder max. 30 m neben dem Track
	•	Waypoints markieren Übernachtungsstellen
	•	Reihenfolge der Waypoints ist nicht garantiert korrekt

⸻

🔁 Algorithmus (exakt so umsetzen, falls du eine bessere idee hast gerne vorschlagen)
	1.	GPX einlesen (File Upload)
	2.	Track und Waypoints extrahieren
	3.	Waypoints entlang des Tracks sortieren
(z. B. nächster Trackpunkt)
	4.	Trackpunkte der Reihe nach durchgehen:
	•	Distanz zwischen Punkt A → B summieren
	•	positive Höhenmeter summieren
	5.	Wenn Trackpunkt B näher als 30 m an nächstem Waypoint ist:
	•	Tagesetappe abschliessen
	•	Werte speichern
	•	Zähler zurücksetzen
	6.	Fortfahren bis Track-Ende

⚠️ Keine magischen Abkürzungen, kein heuristisches Raten.

⸻

🧮 Berechnungen

Distanz
	•	geodätische Distanz
	•	Ergebnis in Kilometern
	•	Ausgabe mit 2 Dezimalstellen

Aufstieg
	•	nur positive Höhenmeter
	•	Summe aller positiven Höhenunterschiede
	•	gerundet auf ganze Meter

Leistungskilometer
The way we calculate the distance for the teams is this:
Horizontal Distance (km) + Ascents (in 100m) = Performance Distance (Lkm)
So f.e. a route that has a distance of 10 km and ascends 500m (=5*100m) = 15 Lkm Performance Distance
To calculate the walking time we'd normally go with a speed of 5 Lkm/h.
Descent is neglected with this method. It might make sense to discuss this

UI-Anforderungen

Minimal, funktional
	•	GPX File Upload
	•	Tabelle mit:
	•	Tag (Tag 1, Tag 2, …)
	•	Distanz (km)
	•	Aufstieg (hm)
	•	Leistungskilometer
	•	Button: CSV exportieren
	•	Keine Kartenansicht notwendig, aber später als v2 wäre das schön

⸻

📁 Projektstruktur (vorschlagen & erklären)
	•	SvelteKit Projektstruktur
	•	klare Trennung:
	•	GPX Parsing
	•	Berechnungslogik
	•	UI

⸻

📤 Output
	•	vollständiger, lauffähiger SvelteKit-Code
	•	alle relevanten Dateien
	•	kurze Erklärung der Architektur
	•	Code gut dokumentiert
    •	tests vorhanden für die wichtigen logiken / berechnungen
	•	kein unnötiger Boilerplate-Text

⸻

🚫 Explizit NICHT tun
	•	kein Backend
	•	keine Auth
	•	keine Speicherung
	•	keine unnötigen Frameworks
	•	keine ungetesteten Annahmen

⸻

➕ Optional für V2
	•	Fehlerbehandlung:
	•	kein Track
	•	keine Waypoints
    •	was passiertbei vielen waypoints, wenn zb noch andere elemente als nur übernachtungsstellen markiert sind
	•	ungültiges GPX
	•	LK-Formel leicht konfigurierbar (Konstante)

⸻

Beginne mit einer kurzen Architekturübersicht, danach liefere den vollständigen Code.