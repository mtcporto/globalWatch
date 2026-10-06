/* eslint-disable -- Vendored upstream CommonJS library; compatibility and security are checked by Node tests. */
'use strict';

// Bound parser nesting and recursive AST traversal before stack exhaustion.
module.exports = depth => {
  if (depth > 128) {
    const error = new RangeError('braces nesting depth exceeds the safety limit of 128');
    error.code = 'ERR_BRACES_DEPTH';
    throw error;
  }
};
