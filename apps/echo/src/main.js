const path = require("node:path");

const RUNTIME_ROLE_RECEPTION = "reception";
const RUNTIME_ROLE_ROOM = "room";
const roleEntry = String(process.env.PIP_UNIFIED_ROLE_ENTRY || "").trim().toLowerCase();

function isPackagedRuntime() {
  return !process.defaultApp;
}

function getRoleSourceRoot(runtimeRole) {
  if (isPackagedRuntime()) {
    return path.join(
      process.resourcesPath,
      "app.asar",
      runtimeRole === RUNTIME_ROLE_RECEPTION ? "reception-src" : "client-src",
    );
  }

  return path.join(
    __dirname,
    "..",
    "..",
    runtimeRole === RUNTIME_ROLE_RECEPTION ? "reception" : "client",
    "src",
  );
}

if (roleEntry === RUNTIME_ROLE_RECEPTION) {
  require(path.join(getRoleSourceRoot(RUNTIME_ROLE_RECEPTION), "main.js"));
} else if (roleEntry === RUNTIME_ROLE_ROOM) {
  require(path.join(getRoleSourceRoot(RUNTIME_ROLE_ROOM), "panel-main.cjs"));
} else {
  require("./bootstrap-main.cjs");
}
