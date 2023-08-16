/**
 * @license Copyright 2023 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

declare module 'rxjs' {
  export * from 'rxjs/index.js';

  // Puppeteer uses a later version of rxjs as a dev dep.
  // We don't need it for normal execution, but these types are necessary
  // when we reach into puppeteer internals in `lightrider-entry.js`
  export const catchError: any;
  export const defaultIfEmpty: any;
  export const filter: any;
  export const first: any;
  export const ignoreElements: any;
  export const map: any;
  export const mergeMap: any;
  export const raceWith: any;
  export const retry: any;
  export const tap: any;
  export const throwIfEmpty: any;
  export const firstValueFrom: any;
}

