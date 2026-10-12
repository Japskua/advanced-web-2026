// Browser code has no `process` object. Bun's bundler replaces the expression
// `process.env.BUN_PUBLIC_API_URL` with its value at build time; this
// declaration only tells TypeScript that the expression may appear in the code.
declare const process: {
  env: {
    BUN_PUBLIC_API_URL?: string;
  };
};
