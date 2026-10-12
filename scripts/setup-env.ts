/**
 * Creates each project's .env from its .env.example, if it does not exist yet,
 * with a freshly generated JWT_SECRET. Existing .env files are never touched.
 *
 *   bun run setup:env
 */
import { Glob } from "bun";

const randomSecret = () => crypto.getRandomValues(new Uint8Array(32)).toBase64();

for await (const example of new Glob("week-*/*/.env.example").scan(".")) {
  const target = example.replace(/\.example$/, "");
  if (await Bun.file(target).exists()) {
    console.log(`kept     ${target}`);
    continue;
  }

  const text = (await Bun.file(example).text()).replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${randomSecret()}`);
  await Bun.write(target, text);
  console.log(`created  ${target}`);
}
