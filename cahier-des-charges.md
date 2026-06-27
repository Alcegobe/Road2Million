# Mon budget & garde-fous — cahier des charges

> Document de cadrage pour construire un petit programme personnel avec **Claude Code**.
> Objectif : un outil **local** qui m'aide à reconstruire un matelas de sécurité, garder l'investissement sous contrôle, et tenir mes garde-fous au quotidien.

---

## ⚠️ À lire AVANT de pousser sur GitHub

Ce projet manipule des **données financières personnelles**. Donc :

- **Repo PRIVÉ obligatoire.** Jamais en public.
- **Aucune vraie donnée dans les fichiers versionnés** : pas de montants réels, pas d'IBAN, pas de noms, pas d'historique bancaire dans le code ou les commits.
- Les vraies données vivent dans un seul fichier local **`data.json`**, qui est **dans le `.gitignore`** (voir §7).
- Ce cahier des charges ne contient **aucun IBAN** : les comptes sont nommés par leur rôle.
- Tout reste **en local** sur ma machine. Le programme ne doit **rien envoyer en ligne**.

---

## 1. Objectif du programme

Un tableau de bord perso, simple, qui répond à trois questions :

1. **Où en est mon matelas de sécurité ?** (cash, pas ETF)
2. **Est-ce que j'investis un montant tenable, sans devoir le reprendre ?**
3. **Est-ce que mes garde-fous sont en place ?**

Ce n'est pas un logiciel de compta. C'est un copilote de discipline budgétaire.

---

## 2. Contexte (ma situation)

### Comptes
- **Compte courant principal (Beobank — Compte Plus)** : reçoit le salaire, d'où partent les ordres permanents.
- **Compte commun (Beobank — joint avec ma compagne)** : dépenses communes + remboursement du crédit.
- **Épargne classique (Beobank)** : rendement faible (~0,40 %).
- **Trade Republic (carte du quotidien + investissement)** : carte utilisée comme compte courant, cash rémunéré à **2,25 %**, Round up, Saveback (1 %), plan d'épargne ETF.

### Revenus / charges (ordres de grandeur, à affiner dans `data.json`)
- **Salaire** : ~2 200–2 400 €/mois (variable), + double pécule en mai.
- **Charges fixes (ordres permanents depuis le compte principal)** : ~1 500 €/mois
  - Vers le compte commun : 1 200 €
  - Prêt familial (papa, **0 %**) : 250 €/mois
  - Épargne enfant : 50 €/mois
- **Crédit** : payé depuis le compte commun (~1 126 €/mois), alimenté par le virement de 1 200 €.
- **Investissement** : plan d'épargne **100 €/semaine** (~430 €/mois) sur un ETF MSCI World, + Round up + Saveback.

### Constat clé (à coder comme garde-fou, voir §3)
Le rythme d'investissement (100 €/sem) est **trop élevé** pour ce qui reste après les charges → je revends régulièrement des ETF pour finir le mois. Ce **yo-yo achat/revente coûte** (frais, écart de prix, pas d'effet boule de neige). Le programme doit m'aider à **éviter ce va-et-vient**.

---

## 3. Les règles à coder (la logique métier)

### Matelas de sécurité (priorité n°1)
- Cible : **~1 mois de dépenses** (placeholder `1500 €`, configurable).
- Il se constitue **en cash**, sur Trade Republic (2,25 %), **pas en ETF**.
- **Tant que** `cash < cible` → l'ETF est **réduit** (ex. 50 €/sem) et le surplus va au cash.
- **Une fois** `cash ≥ cible` → l'ETF repasse à un montant **soutenable** (qu'on ne reprendra pas).

### ETF
- Montant cible configurable. Démarrer **bas** (ex. 50 €/sem ou 100–200 €/mois) puis augmenter quand le mois est stable.
- **Alerte « round-trip »** : si `solde_cash_TR < seuil` (placeholder `200 €`) **et** qu'un achat ETF est prévu → afficher un avertissement : *« Ne pas investir un argent qu'il faudra revendre. »*

### Prêt familial (papa, 0 %)
- **Ne PAS accélérer** le remboursement. C'est l'argent le moins cher possible.
- Juste **suivre le solde restant** (motivant), sans le prioriser sur le matelas ou l'ETF.
- Champ : date de début, mensualité, durée → calcule le restant dû.

### Plafond cash quotidien (méthode enveloppe)
- Montant/jour configurable (ex. `X €/jour`).
- Principe : **non dépensé = non reconduit** (option : balayé vers l'épargne en fin de semaine).
- Sert de plafond physique anti-impulsion.

### Leviers variables à suivre
- **Nourriture hors-maison** (stations Q8, fast-food, livraison, restos) : poste le plus actionnable.
- **Abonnements** : séparer **pro** (outils alcego) et **perso** (streaming…). Lister + total mensuel.

---

## 4. Fonctionnalités

### MVP (à faire d'abord)
- **Tableau de bord** :
  - Barre de progression du matelas (`cash actuel` / `cible`).
  - Charges fixes du mois + reste à vivre estimé.
  - Montant ETF en cours + indicateur « soutenable / à réduire ».
- **Checklist garde-fous** (cochable, sauvegardée) :
  - [ ] Apple/Google Pay retiré du téléphone
  - [ ] Carte physique rangée (pas sur moi au quotidien)
  - [ ] Plafond cash quotidien en place
  - [ ] Auto-exclusion **EPIS** demandée (gamingcommission.be → « Protection des joueurs »)
  - [ ] Bloqueur de sites de jeu installé (**Stop Jeu** / **Gamban**) — couvre aussi l'offshore que EPIS ne bloque pas
  - [ ] (option) Une personne de confiance est au courant
- **Alertes** : matelas atteint ? solde bas + achat ETF prévu (round-trip) ?

### Plus tard (nice-to-have)
- **Import CSV** des exports des deux banques (Beobank + Trade Republic).
- **Catégorisation auto** par mots-clés (ex. `Q8`, `BurgerKing`, `Maxi-Frites` → « nourriture hors-maison » ; `Spotify`, `Netflix` → « abos perso »).
- **Graphiques** d'évolution (cash, dépenses par catégorie, solde restant du prêt).
- **Rappel** d'allocation le jour de paie (pay-yourself-first).
- **(Optionnel, motivant) Compteur « jours sans jeu »** depuis une date de référence — à inclure seulement si je le veux, présenté comme un encouragement, jamais comme un contrôle.

---

## 5. Modèle de données suggéré (`data.json`, local, gitignoré)

Voir `data.example.json` à la racine du repo pour le schéma complet et des valeurs bidon.

---

## 6. Stack & structure retenues

**Contraintes** : local-first, aucune donnée en ligne, simple à lancer.

Retenu : **PWA vanilla** (HTML/CSS/JS pur, zéro build), installable et hors-ligne.
- Le stockage vit dans le **`localStorage`** du navigateur — rien ne part en ligne.
- **Export / import JSON** pour les sauvegardes : le fichier exporté = ton `data.json` (gitignoré).
- `data.example.json` versionné = modèle réutilisable sans tes vraies données.

```
Road2Million/
├── README.md
├── cahier-des-charges.md      # ce fichier
├── .gitignore
├── data.example.json          # exemple sans vraies données (versionné)
├── data.json                  # mes vraies données (IGNORÉ par git, optionnel)
└── src/                        # la PWA
    ├── index.html
    ├── manifest.webmanifest
    ├── service-worker.js
    ├── css/styles.css
    ├── js/{store.js, logic.js, app.js}
    └── icons/icon.svg
```

---

## 7. Confidentialité & `.gitignore`

`.gitignore` minimal :

```gitignore
# Données personnelles — NE JAMAIS COMMIT
data.json
*.local.json
.env
.env.*

# Divers
node_modules/
__pycache__/
.DS_Store
```

Règle d'or : **si ça contient un montant réel, un IBAN ou un nom → ça ne va pas dans git.**

---

*Rappel perso : le matelas en cash d'abord, l'ETF soutenable ensuite, le prêt papa en dernier (0 %, on n'accélère pas). Et les garde-fous valent plus que n'importe quelle ligne de code.*
