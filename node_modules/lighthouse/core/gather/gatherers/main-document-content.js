/**
 * @license Copyright 2019 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import BaseGatherer from '../base-gatherer.js';
import DevtoolsLog from './devtools-log.js';
import {fetchResponseBodyFromCache} from '../driver/network.js';
import {MainResource} from '../../computed/main-resource.js';

/**
 * Collects the content of the main html document.
 */
class MainDocumentContent extends BaseGatherer {
  /** @type {LH.Gatherer.GathererMeta<'DevtoolsLog'>} */
  meta = {
    supportedModes: ['navigation'],
    dependencies: {DevtoolsLog: DevtoolsLog.symbol},
  };

  /**
   * @param {LH.Gatherer.Context<'DevtoolsLog'>} context
   * @return {Promise<LH.Artifacts['MainDocumentContent']>}
   */
  async getArtifact(context) {
    const devtoolsLog = context.dependencies.DevtoolsLog;
    const mainResource =
      await MainResource.request({devtoolsLog, URL: context.baseArtifacts.URL}, context);
    const session = context.driver.defaultSession;
    return fetchResponseBodyFromCache(session, mainResource.requestId);
  }
}

export default MainDocumentContent;
