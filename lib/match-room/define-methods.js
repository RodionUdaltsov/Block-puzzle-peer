/**
 * Block Puzzle — lib/match-room/define-methods.js
 * Copies methods onto a target as NON-enumerable properties, i.e. exactly how `class` methods behave.
 */
'use strict';

function defineMethods(target, methods) {
  const descriptors = Object.getOwnPropertyDescriptors(methods);
  for (const key of Object.keys(descriptors)) {
    descriptors[key].enumerable = false;
    Object.defineProperty(target, key, descriptors[key]);
  }
}

module.exports = { defineMethods };
