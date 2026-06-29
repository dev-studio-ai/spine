import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'SpineJS',
  tagline: 'Modules, DI, and lifecycle for long-lived Node processes',
  url: 'https://dev-studio-ai.github.io',
  baseUrl: '/spine/',
  onBrokenLinks: 'throw',
  favicon: 'img/favicon.ico',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: { defaultLocale: 'en', locales: ['en'] },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
        },
        blog: false,
        theme: { customCss: './src/css/custom.css' },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: { defaultMode: 'dark', disableSwitch: false },
    navbar: {
      title: 'SpineJS',
      items: [
        { type: 'docSidebar', sidebarId: 'mainSidebar', position: 'left', label: 'Docs' },
        {
          href: 'https://github.com/dev-studio',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      copyright: `Copyright © ${new Date().getFullYear()} Dev Studio`,
    },
    prism: {
      theme: require('prism-react-renderer').themes.oneDark,
      additionalLanguages: ['typescript', 'bash'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
