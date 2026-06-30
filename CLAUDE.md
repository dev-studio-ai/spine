# SpineJS — Claude instructions

## After any implementation or fix

Run lint, typecheck, and tests before declaring done:

```bash
yarn lint:all
yarn typecheck:all
yarn test:all
```

Format if needed:

```bash
yarn format:write
```

## Flux git

`main` impose un historique linéaire : GitHub merge en **squash/rebase** et **réécrit les SHA** des commits. Conséquence : une branche réutilisée après un merge garde ses anciens commits (déjà sur `main` sous d'autres SHA) et toute nouvelle PR sur cette base part en conflit.

- **Une branche neuve par PR.** Nom unique à chaque fois (ex. `docs/xxx-2026-06-30`). Ne jamais recycler une branche déjà mergée.
- **Après un merge, supprimer la branche** et repartir d'un `main` à jour : `git checkout main && git fetch origin && git reset --hard origin/main`. Recréer une branche depuis là pour le travail suivant.
- Ne jamais committer/pousser directement sur `main`, ni rejouer les commits d'une branche à la main (cherry-pick, refaire le travail) : intégrer **uniquement via merge de PR** (`gh pr merge <n> --squash`).
- Avant d'ouvrir ou mettre à jour une PR, rebaser sur `main` à jour : `git fetch origin && git rebase origin/main`, puis `git push --force-with-lease`.

## Docs

Toute modif de l'interface publique du framework (API, decorators, types exportés, options) ou tout ajout de feature doit être répercutée dans la doc Docusaurus, EN **et** FR (`apps/docs/docs/**/*.md` + `apps/docs/i18n/fr/docusaurus-plugin-content-docs/current/**/*.md`, et `apps/docs/src/pages/index.tsx` + `apps/docs/i18n/fr/code.json` pour la home).
