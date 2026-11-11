// Let Metro read the web app's language catalogues and API types (web/src), which the phone app shares.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, "../web/src")];
module.exports = config;
