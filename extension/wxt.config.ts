import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Article to Podcast",
    description: "Save articles with one click and turn them into a narrated podcast.",
    permissions: ["storage", "activeTab", "scripting", "contextMenus"],
    // The service worker calls the Wasp backend, and the content script parses
    // any page the user saves. Both need broad host access.
    host_permissions: ["<all_urls>"],
    action: { default_title: "Save article to podcast" },
  },
});
