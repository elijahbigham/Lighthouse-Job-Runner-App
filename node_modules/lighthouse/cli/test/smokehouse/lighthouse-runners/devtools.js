/**
 * @license Copyright 2021 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * @fileoverview A runner that launches Chrome and executes Lighthouse via DevTools.
 */

import {execFileSync} from 'child_process';

import {LH_ROOT} from '../../../../root.js';
import {testUrlFromDevtools} from '../../../../core/scripts/pptr-run-devtools.js';

const devtoolsDir =
  process.env.DEVTOOLS_PATH || `${LH_ROOT}/.tmp/chromium-web-tests/devtools/devtools-frontend`;

/**
 * Download/pull latest DevTools, build Lighthouse for DevTools, roll to DevTools, and build DevTools.
 */
async function setup() {
  if (process.env.CI) return;

  process.env.DEVTOOLS_PATH = devtoolsDir;
  execFileSync('bash',
    ['core/test/devtools-tests/download-devtools.sh'],
    {stdio: 'inherit'}
  );
  execFileSync('bash',
    ['core/test/devtools-tests/roll-devtools.sh'],
    {stdio: 'inherit'}
  );
}

/**
 * Launch Chrome and do a full Lighthouse run via DevTools.
 * By default, the latest DevTools frontend is used (.tmp/chromium-web-tests/devtools/devtools-frontend)
 * unless DEVTOOLS_PATH is set.
 * CHROME_PATH determines which Chrome is used–otherwise the default is puppeteer's chrome binary.
 * @param {string} url
 * @param {LH.Config=} config
 * @return {Promise<{lhr: LH.Result, artifacts: LH.Artifacts, log: string}>}
 */
async function runLighthouse(url, config) {
  const chromeFlags = [
    `--custom-devtools-frontend=file://${devtoolsDir}/out/LighthouseIntegration/gen/front_end`,
  ];
  const {lhr, artifacts, logs} = await testUrlFromDevtools(url, {
    config,
    chromeFlags,
  });

  const log = logs.join('') + '\n';
  return {lhr, artifacts, log};
}

export {
  runLighthouse,
  setup,
};
