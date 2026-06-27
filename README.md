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
- **Dépenses** : import CSV (Beobank / Trade Republic) lu **sur l'appareil**, catégorisation auto
  par mots-clés, répartition des dépenses par catégorie et par mois, dernières transactions.
- **Réglages** : tous tes chiffres + les règles de catégorisation, modifiables, gardés en local.
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

## Mettre en ligne (GitHub Pages) — pour l'utiliser sur ton téléphone

Le workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) publie automatiquement
le dossier `src/` sur GitHub Pages à chaque push sur `main`. Tu obtiens une URL du type
`https://<utilisateur>.github.io/Road2Million/`, installable sur l'écran d'accueil.

> 🔒 **Tes données restent locales même hébergé.** Pages ne publie que le « squelette » de l'app
> (HTML/CSS/JS). Tes montants vivent dans le `localStorage` de **ton** navigateur et ne sont jamais
> envoyés sur GitHub. Le repo ne contient aucune donnée (`data.json` est gitignoré).

À faire une seule fois :

1. **Rendre le repo public** (Pages est gratuit sur repo public ; en privé il faut un plan payant).
   C'est sans risque ici : aucune donnée financière n'est dans le code.
2. **Settings → Pages → Build and deployment → Source = « GitHub Actions »**.
3. Le prochain push (ou merge) sur `main` déclenche le déploiement ; l'URL apparaît dans l'onglet **Actions**.

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

- Graphiques d'évolution dans le temps (cash, dépenses par catégorie, restant du prêt).
- Rappel d'allocation le jour de paie (*pay-yourself-first*).
- Affinage des règles de catégorisation au vu des vrais libellés de tes relevés.
