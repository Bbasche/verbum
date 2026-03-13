import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("verbumApp", {
  platform: process.platform,
  version: "0.1.0"
});

