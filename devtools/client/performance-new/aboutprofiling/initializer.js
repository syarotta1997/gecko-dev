/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
// @ts-check
/**
 * @typedef {import("../@types/perf").InitializeStoreValues} InitializeStoreValues
 * @typedef {import("../@types/perf").PopupWindow} PopupWindow
 */
"use strict";

/**
 * This file initializes the about:profiling page, which can be used to tweak the
 * profiler's settings.
 */

{
  // Create the browser loader, but take care not to conflict with
  // TypeScript. See devtools/client/performance-new/typescript.md and
  // the section on "Do not overload require" for more information.

  const { BrowserLoader } = ChromeUtils.import(
    "resource://devtools/client/shared/browser-loader.js"
  );
  const browserLoader = BrowserLoader({
    baseURI: "resource://devtools/client/performance-new/aboutprofiling",
    window,
  });

  /**
   * @type {any} - Coerce the current scope into an `any`, and assign the
   *     loaders to the scope. They can then be used freely below.
   */
  const scope = this;
  scope.require = browserLoader.require;
  scope.loader = browserLoader.loader;
}

/**
 * The background.jsm.js manages the profiler state, and can be loaded multiple time
 * for various components. This page needs a copy, and it is also used by the
 * profiler shortcuts. In order to do this, the background code needs to live in a
 * JSM module, that can be shared with the DevTools keyboard shortcut manager.
 */
const {
  getRecordingPreferencesFromBrowser,
  setRecordingPreferencesOnBrowser,
  getSymbolsFromThisBrowser,
  presets,
} = ChromeUtils.import(
  "resource://devtools/client/performance-new/popup/background.jsm.js"
);

const { receiveProfile } = require("devtools/client/performance-new/browser");

const ReactDOM = require("devtools/client/shared/vendor/react-dom");
const React = require("devtools/client/shared/vendor/react");
const AboutProfiling = React.createFactory(
  require("devtools/client/performance-new/components/AboutProfiling")
);
const ProfilerEventHandling = React.createFactory(
  require("devtools/client/performance-new/components/ProfilerEventHandling")
);
const createStore = require("devtools/client/shared/redux/create-store");
const reducers = require("devtools/client/performance-new/store/reducers");
const actions = require("devtools/client/performance-new/store/actions");
const { Provider } = require("devtools/client/shared/vendor/react-redux");
const {
  ActorReadyGeckoProfilerInterface,
} = require("devtools/shared/performance-new/gecko-profiler-interface");

/**
 * Initialize the panel by creating a redux store, and render the root component.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const store = createStore(reducers);
  const perfFrontInterface = new ActorReadyGeckoProfilerInterface();
  const supportedFeatures = await perfFrontInterface.getSupportedFeatures();

  // Do some initialization, especially with privileged things that are part of the
  // the browser.
  store.dispatch(
    actions.initializeStore({
      perfFront: perfFrontInterface,
      receiveProfile,
      supportedFeatures,
      presets,
      // Get the preferences from the current browser
      recordingPreferences: getRecordingPreferencesFromBrowser(),
      // In the popup, the preferences are stored directly on the current browser.
      setRecordingPreferences: setRecordingPreferencesOnBrowser,
      // The popup doesn't need to support remote symbol tables from the debuggee.
      // Only get the symbols from this browser.
      getSymbolTableGetter: () => getSymbolsFromThisBrowser,
      pageContext: "aboutprofiling",
    })
  );

  ReactDOM.render(
    React.createElement(
      Provider,
      { store },
      React.createElement(
        React.Fragment,
        null,
        ProfilerEventHandling(),
        AboutProfiling()
      )
    ),
    document.querySelector("#root")
  );

  window.addEventListener("unload", function() {
    // The perf front interface needs to be unloaded in order to remove event handlers.
    // Not doing so leads to leaks.
    perfFrontInterface.destroy();
  });
});
