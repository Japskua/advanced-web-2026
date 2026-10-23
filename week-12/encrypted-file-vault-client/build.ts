// Production build into dist/. The same as
//   bun build ./index.html --outdir=dist --production --public-path=/ --env='BUN_PUBLIC_*'
// plus the Tailwind CSS plugin, which `bun build` on the command line cannot
// load (the dev server gets it from bunfig.toml).
import tailwind from "bun-plugin-tailwind";

await Bun.$`rm -rf dist`;

const result = await Bun.build({
  entrypoints: ["./index.html"],
  outdir: "dist",
  publicPath: "/",
  // Inline BUN_PUBLIC_API_URL and friends; nothing else from the environment reaches the bundle.
  env: "BUN_PUBLIC_*",
  minify: true,
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  plugins: [tailwind],
});

if (!result.success) {
  for (const message of result.logs) console.error(message);
  process.exit(1);
}
for (const output of result.outputs) {
  console.log(`  ${output.path.replace(`${process.cwd()}/`, "")}  ${(output.size / 1024).toFixed(1)} KB`);
}
