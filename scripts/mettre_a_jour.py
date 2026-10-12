"""
Télécharge les données de football-data.org et les enregistre dans data/donnees.js,
puis celles de la F1 (API Jolpica, sans clé) dans data/f1.js.

Lancé automatiquement par GitHub Actions (voir .github/workflows/mise-a-jour.yml).
La clé d'API est lue dans la variable d'environnement FOOTBALL_DATA_KEY :
elle vient des "Secrets" du dépôt et n'est jamais écrite dans un fichier.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request

ADRESSE_API = "https://api.football-data.org/v4"

# Compétitions suivies : Ligue 1, LaLiga, Ligue des champions
COMPETITIONS = ["FL1", "PD", "CL"]

# Pause entre deux appels : 7 secondes = 9 appels en ~1 minute,
# donc toujours sous la limite gratuite de 10 appels par minute
PAUSE_SECONDES = 7

FICHIER_SORTIE = os.path.join(os.path.dirname(__file__), "..", "data", "donnees.js")


def appeler(chemin, cle):
    """Appelle l'API et renvoie la réponse JSON. Réessaie une fois si la limite est atteinte."""
    requete = urllib.request.Request(ADRESSE_API + chemin, headers={"X-Auth-Token": cle})
    for essai in range(2):
        try:
            with urllib.request.urlopen(requete, timeout=30) as reponse:
                donnees = json.load(reponse)
            time.sleep(PAUSE_SECONDES)
            return donnees
        except urllib.error.HTTPError as erreur:
            # 429 = trop de requêtes : on attend une minute puis on réessaie
            if erreur.code == 429 and essai == 0:
                print("Limite atteinte, nouvel essai dans 60 secondes...")
                time.sleep(60)
                continue
            raise


def equipe_simplifiee(equipe):
    """Garde uniquement les champs utiles d'une équipe."""
    return {
        "id": equipe.get("id"),
        "name": equipe.get("name"),
        # Certaines équipes n'ont pas de nom court : on prend le nom complet
        "shortName": equipe.get("shortName") or equipe.get("name"),
        "tla": equipe.get("tla"),
    }


def match_simplifie(match):
    """Garde uniquement les champs utiles d'un match (le fichier reste léger)."""
    return {
        "id": match["id"],
        "utcDate": match["utcDate"],
        "status": match["status"],
        "matchday": match.get("matchday"),
        "stage": match.get("stage"),
        "homeTeam": equipe_simplifiee(match["homeTeam"]),
        "awayTeam": equipe_simplifiee(match["awayTeam"]),
        "score": {
            "winner": match["score"].get("winner"),
            "fullTime": match["score"].get("fullTime"),
        },
    }


def ligne_simplifiee(ligne):
    """Garde uniquement les champs utiles d'une ligne de classement."""
    champs = ["position", "playedGames", "won", "draw", "lost",
              "points", "goalsFor", "goalsAgainst", "goalDifference"]
    resultat = {champ: ligne.get(champ) for champ in champs}
    resultat["team"] = equipe_simplifiee(ligne["team"])
    return resultat


def telecharger_competition(code, cle):
    """Les 3 appels d'une compétition, regroupés au même format que data/exemple.js."""
    print(f"Téléchargement de {code}...")
    classement = appeler(f"/competitions/{code}/standings", cle)
    matchs = appeler(f"/competitions/{code}/matches", cle)
    buteurs = appeler(f"/competitions/{code}/scorers", cle)

    return {
        "competition": {"code": code, "name": classement["competition"]["name"]},
        "season": {
            "startDate": classement["season"].get("startDate"),
            "endDate": classement["season"].get("endDate"),
            "currentMatchday": classement["season"].get("currentMatchday"),
        },
        "standings": [
            {
                "stage": tableau.get("stage"),
                "type": tableau.get("type"),
                "table": [ligne_simplifiee(l) for l in tableau["table"]],
            }
            for tableau in classement["standings"]
        ],
        "matches": [match_simplifie(m) for m in matchs["matches"]],
        "scorers": [
            {
                "player": {"name": b["player"]["name"]},
                "team": equipe_simplifiee(b["team"]),
                "goals": b.get("goals") or 0,
            }
            for b in buteurs["scorers"]
        ],
    }


def enregistrer(chemin, nom_variable, donnees):
    """Écrit les données dans un fichier .js lu par la page (window.<nom_variable> = ...)."""
    contenu = (
        "/* Fichier généré automatiquement par scripts/mettre_a_jour.py : ne pas modifier à la main. */\n"
        f"window.{nom_variable} = "
        # Écriture compacte (sans espaces) : fichier plus léger à télécharger
        + json.dumps(donnees, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )
    with open(chemin, "w", encoding="utf-8", newline="\n") as fichier:
        fichier.write(contenu)
    print(f"Données enregistrées dans data/{os.path.basename(chemin)} ({len(contenu) // 1024} Ko).")


def mettre_a_jour_foot():
    cle = os.environ.get("FOOTBALL_DATA_KEY")
    if not cle:
        # Pas d'échec (donc pas d'e-mail d'erreur) tant que la clé n'est pas configurée
        print("::warning::Clé FOOTBALL_DATA_KEY absente : le foot n'est pas mis à jour.")
        return

    donnees = {code: telecharger_competition(code, cle) for code in COMPETITIONS}
    enregistrer(FICHIER_SORTIE, "DONNEES_API", donnees)


# ---------- Formule 1 (API Jolpica, gratuite et sans clé) ----------

ADRESSE_API_F1 = "https://api.jolpi.ca/ergast/f1/current"

FICHIER_SORTIE_F1 = os.path.join(os.path.dirname(__file__), "..", "data", "f1.js")

# Les séances d'un week-end, dans le vocabulaire de l'API
SEANCES_F1 = ["FirstPractice", "SecondPractice", "ThirdPractice",
              "SprintQualifying", "Sprint", "Qualifying"]


def appeler_f1(chemin):
    """Appelle l'API F1 et renvoie la partie utile de la réponse ("MRData")."""
    with urllib.request.urlopen(ADRESSE_API_F1 + chemin + ".json?limit=100", timeout=30) as reponse:
        donnees = json.load(reponse)
    time.sleep(1)  # politesse : l'API limite le nombre d'appels par seconde
    return donnees["MRData"]


def date_iso(objet):
    """"2026-10-11" + "12:00:00Z" -> "2026-10-11T12:00:00Z" (date seule si l'heure est inconnue)."""
    if objet.get("time"):
        return objet["date"] + "T" + objet["time"]
    return objet["date"]


def nombre(texte):
    """"25" -> 25, "0.5" -> 0.5 (les points peuvent être des demi-points)."""
    valeur = float(texte or 0)
    return int(valeur) if valeur.is_integer() else valeur


def course_simplifiee(course):
    """Les informations d'un Grand Prix communes au résultat et au calendrier."""
    lieu = course["Circuit"]["Location"]
    return {
        "manche": int(course["round"]),
        "nom": course["raceName"],
        "circuit": course["Circuit"]["circuitName"],
        "ville": lieu.get("locality"),
        "pays": lieu.get("country"),
        "date": date_iso(course),
    }


def pilote_simplifie(pilote):
    return {
        "nom": pilote["givenName"] + " " + pilote["familyName"],
        "code": pilote.get("code"),
    }


def ecurie_simplifiee(ecurie):
    return {"id": ecurie["constructorId"], "nom": ecurie["name"]}


def telecharger_f1():
    """Dernière course, classement des pilotes et calendrier de la saison en cours."""
    print("Téléchargement de la F1...")
    derniere = appeler_f1("/last/results")["RaceTable"]
    classement = appeler_f1("/driverStandings")["StandingsTable"]
    calendrier = appeler_f1("/races")["RaceTable"]

    # Dernière course (vide en tout début de saison)
    derniere_course = None
    if derniere["Races"]:
        course = derniere["Races"][0]
        derniere_course = course_simplifiee(course)
        derniere_course["resultats"] = [
            {
                "position": r["positionText"],  # "1", "2"... ou "R" (abandon), "D" (disqualifié)
                "pilote": pilote_simplifie(r["Driver"]),
                "ecurie": ecurie_simplifiee(r["Constructor"]),
                "tours": int(r.get("laps") or 0),
                "statut": r.get("status"),
                "temps": (r.get("Time") or {}).get("time"),
                "points": nombre(r.get("points")),
            }
            for r in course["Results"]
        ]

    # Écurie de chaque pilote lors de la dernière course
    ecurie_actuelle = {}
    if derniere["Races"]:
        for r in derniere["Races"][0]["Results"]:
            ecurie_actuelle[r["Driver"]["driverId"]] = ecurie_simplifiee(r["Constructor"])

    # Classement des pilotes (vide avant la première course)
    lignes = []
    if classement["StandingsLists"]:
        for ligne in classement["StandingsLists"][0]["DriverStandings"]:
            # Un pilote qui a changé d'écurie en cours de saison a plusieurs écuries,
            # dans un ordre quelconque : on prend celle de la dernière course
            ecuries = ligne.get("Constructors") or []
            ecurie = ecurie_actuelle.get(ligne["Driver"]["driverId"])
            if not ecurie and ecuries:
                ecurie = ecurie_simplifiee(ecuries[-1])
            lignes.append({
                "position": ligne.get("positionText") or ligne.get("position"),
                "pilote": pilote_simplifie(ligne["Driver"]),
                "ecurie": ecurie,
                "victoires": int(ligne.get("wins") or 0),
                "points": nombre(ligne.get("points")),
            })

    # Calendrier complet : la page choisit elle-même le prochain Grand Prix
    courses = []
    for course in calendrier["Races"]:
        infos = course_simplifiee(course)
        infos["seances"] = [
            {"type": seance, "date": date_iso(course[seance])}
            for seance in SEANCES_F1 if seance in course
        ] + [{"type": "Race", "date": infos["date"]}]
        courses.append(infos)

    return {
        "saison": calendrier.get("season"),
        "derniereCourse": derniere_course,
        "classementPilotes": lignes,
        "calendrier": courses,
    }


def mettre_a_jour_f1():
    enregistrer(FICHIER_SORTIE_F1, "DONNEES_F1", telecharger_f1())


def main():
    # Le foot et la F1 sont indépendants : une panne de l'un n'empêche pas l'autre
    erreurs = 0
    for mise_a_jour in (mettre_a_jour_foot, mettre_a_jour_f1):
        try:
            mise_a_jour()
        except (urllib.error.URLError, KeyError, ValueError) as erreur:
            print(f"::error::{mise_a_jour.__name__} : {erreur}")
            erreurs += 1
    if erreurs:
        sys.exit(1)


if __name__ == "__main__":
    main()
