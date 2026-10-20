import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync(new URL('../ios/MeshStreamP2P.m', import.meta.url), 'utf8');

assert.doesNotMatch(source, /#import <objc\/message\.h>/);
assert.doesNotMatch(source, /objc_msgSend|NSSelectorFromString\(@"close"\)/);
assert.doesNotMatch(source, /\[P2PSDK shutdown\]/);
assert.match(source, /\[bridgeClient\.client close\]/);
