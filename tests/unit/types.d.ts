// Import type descriptions for global mocha functions `describe`, `it`, `beforeEach`, etc...
// These are refrenced globally karma-mocha without any es-module imports.
// This makes TypeScript aware of of these globals and their type in the code editor.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { MochaGlobals } from 'mocha';
