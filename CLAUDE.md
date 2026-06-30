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

## Docs

Toute modif de l'interface publique du framework (API, decorators, types exportés, options) ou tout ajout de feature doit être répercutée dans la doc Docusaurus, EN **et** FR (`apps/docs/docs/**/*.md` + `apps/docs/i18n/fr/docusaurus-plugin-content-docs/current/**/*.md`, et `apps/docs/src/pages/index.tsx` + `apps/docs/i18n/fr/code.json` pour la home).
