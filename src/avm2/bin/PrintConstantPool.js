/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil; tab-width: 2 -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */
/*
 * Copyright 2013 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

load("../../../lib/DataView.js/DataView.js");

load("../constants.js");
load("../parser.js");
try {
  var abc = parseAbcFile(snarf(arguments[0], "binary"));
  print("Constant pool for: " + arguments[0]);
  print(JSON.stringify(abc.constantPool, null, 2));
} catch (e) {
  print(e);
  print(e.stack);
}
