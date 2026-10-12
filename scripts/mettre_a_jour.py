"""
Télécharge les données de football-data.org et les enregistre dans data/donnees.js.

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


def main():
    cle = os.environ.get("FOOTBALL_DATA_KEY")
    if not cle:
        # Pas d'échec (donc pas d'e-mail d'erreur) tant que la clé n'est pas configurée
        print("::warning::Clé FOOTBALL_DATA_KEY absente : rien n'est mis à jour.")
        return

    donnees = {code: telecharger_competition(code, cle) for code in COMPETITIONS}

    contenu = (
        "/* Fichier généré automatiquement par scripts/mettre_a_jour.py : ne pas modifier à la main. */\n"
        "window.DONNEES_API = "
        # Écriture compacte (sans espaces) : fichier plus léger à télécharger
        + json.dumps(donnees, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )
    with open(FICHIER_SORTIE, "w", encoding="utf-8", newline="\n") as fichier:
        fichier.write(contenu)
    print(f"Données enregistrées dans data/donnees.js ({len(contenu) // 1024} Ko).")


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as erreur:
        print(f"Erreur de l'API : {erreur.code} {erreur.reason}")
        sys.exit(1)
