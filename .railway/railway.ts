import { defineRailway, github, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "one-history";
export default defineRailway(() => {
  const oneHistory = service("one-history", {
    source: github("916Blaxk/one-history"),
    build: { buildCommand: "npx next build", buildEnvironment: "V3", builder: "RAILPACK" },
    start: "npm start",
    healthcheck: "/entrar",
    replicas: { "us-east4-eqdc4a": 1 },
  });

  return project("one-history", {
    variables: { managed: false },
    resources: [oneHistory],
  });
});
