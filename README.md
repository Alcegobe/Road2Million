# Road2Million — Budget & garde-fous

Petit **PWA local-first** : un copilote de discipline budgétaire qui répond à trois questions —
**où en est mon matelas de sécurité ?**, **est-ce que j'investis un montant tenable ?**,
**est-ce que mes garde-fous sont en place ?**

> 🔒 **Tout reste sur ta machine.** Aucune donnée n'est envoyée en ligne. Pas de compte, pas de serveur, pas de télémétrie.
> Les vraies données vivent dans le `localStorage` du navigateur ; tu peux les exporter en `data.json` (gitignoré).

Voir [`cahier-des-charges.md`](./cahier-des-charges.md) pour le détail de la logique métier.

---

## Ce que fait le MVP

- **Tableau de bord** : barre de progression du matelas (cash / cible), le mois en un coup d'œil
  (salaire − charges fixes − ETF = reste à vivre), montant ETF + indicateur *soutenable / à réduire*,
  suivi du prêt papa (0 %, on n'accélère pas).
- **Alertes** :
  - **Matelas atteint** → tu peux repasser l'ETF à un montant soutenable.
  - **Round-trip** → solde TR bas + achat ETF prévu : *« ne pas investir un argent qu'il faudra revendre. »*
- **Checklist garde-fous** cochable et sauvegardée (Apple/Google Pay retiré, carte rangée, plafond cash,
  EPIS, bloqueur Stop Jeu / Gamban, personne de confiance).
- **Réglages** : tous tes chiffres, modifiables, gardés en local.
- **Données** : export `data.json`, import, exemple de démo, réinitialisation.
- **(Optionnel) Compteur « jours sans jeu »** — un encouragement, jamais un contrôle.

---

## Lancer l'app

Le service worker et l'installation PWA exigent `http://localhost` (le `file://` ne suffit pas).
Depuis le dossier `src/` :

```bash
cd src
python3 -m http.server 8000
```

Puis ouvre **http://localhost:8000/** dans le navigateur.
Sur mobile : « Ajouter à l'écran d'accueil » pour l'utiliser comme une appli installée, hors-ligne.

> Alternative sans Python : `npx serve src` (ou n'importe quel petit serveur statique).

---

## Données & confidentialité

- Source de vérité : `localStorage` du navigateur. **Rien ne sort** de l'appareil.
- `data.example.json` (versionné) = modèle avec des valeurs bidon, importable pour tester.
- `data.json` = ta sauvegarde réelle, **ignorée par git** (voir `.gitignore`). Règle d'or :
  *si ça contient un montant réel, un IBAN ou un nom → ça ne va pas dans git.*
- Repo à garder **privé**.

---

## Structure

```
Road2Million/
├── README.md
├── cahier-des-charges.md
├── .gitignore
├── data.example.json          # modèle versionné (valeurs bidon)
├── data.json                  # tes vraies données (gitignoré, optionnel)
└── src/
    ├── index.html
    ├── manifest.webmanifest
    ├── service-worker.js
    ├── css/styles.css
    ├── js/store.js            # persistance localStorage
    ├── js/logic.js            # logique métier (matelas, ETF, prêt, alertes)
    ├── js/app.js              # rendu UI + événements
    └── icons/icon.svg
```

---

## À venir (nice-to-have)

- Import CSV des exports Beobank + Trade Republic, catégorisation auto par mots-clés.
- Graphiques d'évolution (cash, dépenses par catégorie, restant du prêt).
- Rappel d'allocation le jour de paie (*pay-yourself-first*).
