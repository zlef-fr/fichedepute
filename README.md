# FicheDéputé.fr

![views](https://assets.zlef.fr/badge/views/zlef-fr/fichedepute.svg)

La **fiche vivante** de chaque député·e de l'Assemblée nationale (17ᵉ législature) —
participation aux scrutins, votes, absences — en clair et 100 % sourcé.

Live: https://fichedepute.fr

## Données
Construit à partir des jeux **open data officiels de l'Assemblée nationale**
(licence Ouverte) :
- Liste des députés en exercice + organes (groupes, circonscriptions)
- Intégralité des scrutins publics de la 17ᵉ législature (~7 900)

La **participation aux scrutins** est la part des scrutins publics — depuis l'entrée
en fonction du député — où il ou elle est décompté·e nominativement. Ce n'est pas la
présence en séance/commission (non publiée nominativement). Aucune interprétation
politique n'est ajoutée.

## Architecture
- `pipeline/build_data.py` — transforme les données brutes AN en JSON prêt à servir
  (`data/`), le client ne fait aucun calcul.
- `scripts/refresh-data.sh` — retélécharge les données officielles et reconstruit.
- `server.js` + `lib/` — serveur HTTP Node sans dépendance (API lecture seule + OG cards).
- `lib/tracker.js` — compteur de vues par page (clés normalisées, persistées sur disque
  dans `var/views.json` — volume bind-monté pour survivre aux rebuilds).
- `public/` — PWA vanilla (SPA, i18n FR/EN, thème clair, service worker offline).

Projet **indépendant**, réalisé avec patriotisme 🇫🇷 par [zlef.fr](https://zlef.fr).

## Dev
```bash
bash scripts/refresh-data.sh   # fetch official data + build
node server.js                 # http://localhost:10091
```

Données : Assemblée nationale (licence Ouverte). Projet indépendant, non affilié.
