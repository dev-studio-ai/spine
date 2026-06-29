import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  mainSidebar: [
    'intro',
    {
      type: 'category',
      label: 'SpineJS Core',
      items: [
        'app-core/overview',
        'app-core/modules',
        'app-core/dependency-injection',
        'app-core/lifecycle',
        'app-core/logging',
      ],
    },
    {
      type: 'category',
      label: 'Gateway',
      items: [
        'gateway/overview',
        'gateway/controllers-handlers',
        'gateway/guards',
        'gateway/validation',
        'gateway/interceptors',
        'gateway/feature-modules',
      ],
    },
    {
      type: 'category',
      label: 'Transports',
      items: ['transports/electron-ipc'],
    },
    {
      type: 'category',
      label: 'Electron',
      items: ['electron/electron-module'],
    },
    {
      type: 'category',
      label: 'Extensions',
      items: ['extensions/config', 'extensions/winston-logger'],
    },
  ],
};

export default sidebars;
