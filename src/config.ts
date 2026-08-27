import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-chore-rotation",
  breadcrumbs: false,
  description:
    "Weekly chore rotation that's the same for everyone and fair over time — no account, no server",
  accentHex: "#0ea5e9",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
