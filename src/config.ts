import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-chore-rotation",
  description: "Weekly chore rotation with deterministic fair shuffle, no account, mesh-synced",
  accentHex: "#0ea5e9",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
