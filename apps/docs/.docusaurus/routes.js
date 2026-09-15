import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/docs',
    component: ComponentCreator('/docs', 'f7b'),
    routes: [
      {
        path: '/docs',
        component: ComponentCreator('/docs', '10d'),
        routes: [
          {
            path: '/docs',
            component: ComponentCreator('/docs', 'df9'),
            routes: [
              {
                path: '/docs/governance',
                component: ComponentCreator('/docs/governance', 'd5f'),
                exact: true,
                sidebar: "platform"
              },
              {
                path: '/docs/intro',
                component: ComponentCreator('/docs/intro', '8ae'),
                exact: true,
                sidebar: "platform"
              },
              {
                path: '/docs/runtime-boundaries',
                component: ComponentCreator('/docs/runtime-boundaries', '9c6'),
                exact: true,
                sidebar: "platform"
              },
              {
                path: '/docs/schemas',
                component: ComponentCreator('/docs/schemas', '14e'),
                exact: true,
                sidebar: "platform"
              },
              {
                path: '/docs/workspace',
                component: ComponentCreator('/docs/workspace', '447'),
                exact: true,
                sidebar: "platform"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '/',
    component: ComponentCreator('/', 'e5f'),
    exact: true
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
