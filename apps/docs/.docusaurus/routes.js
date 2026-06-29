import React from "react";
import ComponentCreator from "@docusaurus/ComponentCreator";

export default [
  {
    path: "/__docusaurus/debug",
    component: ComponentCreator("/__docusaurus/debug", "5ff"),
    exact: true,
  },
  {
    path: "/__docusaurus/debug/config",
    component: ComponentCreator("/__docusaurus/debug/config", "5ba"),
    exact: true,
  },
  {
    path: "/__docusaurus/debug/content",
    component: ComponentCreator("/__docusaurus/debug/content", "a2b"),
    exact: true,
  },
  {
    path: "/__docusaurus/debug/globalData",
    component: ComponentCreator("/__docusaurus/debug/globalData", "c3c"),
    exact: true,
  },
  {
    path: "/__docusaurus/debug/metadata",
    component: ComponentCreator("/__docusaurus/debug/metadata", "156"),
    exact: true,
  },
  {
    path: "/__docusaurus/debug/registry",
    component: ComponentCreator("/__docusaurus/debug/registry", "88c"),
    exact: true,
  },
  {
    path: "/__docusaurus/debug/routes",
    component: ComponentCreator("/__docusaurus/debug/routes", "000"),
    exact: true,
  },
  {
    path: "/",
    component: ComponentCreator("/", "7e6"),
    routes: [
      {
        path: "/",
        component: ComponentCreator("/", "bb5"),
        routes: [
          {
            path: "/",
            component: ComponentCreator("/", "e53"),
            routes: [
              {
                path: "/app-core/dependency-injection",
                component: ComponentCreator(
                  "/app-core/dependency-injection",
                  "f2d"
                ),
                exact: true,
                sidebar: "mainSidebar",
              },
              {
                path: "/app-core/lifecycle",
                component: ComponentCreator("/app-core/lifecycle", "c55"),
                exact: true,
                sidebar: "mainSidebar",
              },
              {
                path: "/app-core/logging",
                component: ComponentCreator("/app-core/logging", "c3f"),
                exact: true,
                sidebar: "mainSidebar",
              },
              {
                path: "/app-core/modules",
                component: ComponentCreator("/app-core/modules", "118"),
                exact: true,
                sidebar: "mainSidebar",
              },
              {
                path: "/app-core/overview",
                component: ComponentCreator("/app-core/overview", "5dc"),
                exact: true,
                sidebar: "mainSidebar",
              },
              {
                path: "/electron/electron-module",
                component: ComponentCreator("/electron/electron-module", "559"),
                exact: true,
                sidebar: "mainSidebar",
              },
              {
                path: "/extensions/config",
                component: ComponentCreator("/extensions/config", "cbd"),
                exact: true,
                sidebar: "mainSidebar",
              },
              {
                path: "/extensions/winston-logger",
                component: ComponentCreator(
                  "/extensions/winston-logger",
                  "f86"
                ),
                exact: true,
                sidebar: "mainSidebar",
              },
              {
                path: "/gateway/controllers-handlers",
                component: ComponentCreator(
                  "/gateway/controllers-handlers",
                  "160"
                ),
                exact: true,
                sidebar: "mainSidebar",
              },
              {
                path: "/gateway/feature-modules",
                component: ComponentCreator("/gateway/feature-modules", "321"),
                exact: true,
                sidebar: "mainSidebar",
              },
              {
                path: "/gateway/guards",
                component: ComponentCreator("/gateway/guards", "07d"),
                exact: true,
                sidebar: "mainSidebar",
              },
              {
                path: "/gateway/overview",
                component: ComponentCreator("/gateway/overview", "795"),
                exact: true,
                sidebar: "mainSidebar",
              },
              {
                path: "/gateway/validation",
                component: ComponentCreator("/gateway/validation", "90e"),
                exact: true,
                sidebar: "mainSidebar",
              },
              {
                path: "/transports/electron-ipc",
                component: ComponentCreator("/transports/electron-ipc", "ca5"),
                exact: true,
                sidebar: "mainSidebar",
              },
              {
                path: "/",
                component: ComponentCreator("/", "e98"),
                exact: true,
                sidebar: "mainSidebar",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: "*",
    component: ComponentCreator("*"),
  },
];
