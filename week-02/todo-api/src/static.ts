/**
 * Static file serving for the front-end in `public/`.
 *
 * A request for "/" returns public/index.html, "/app.js" returns public/app.js,
 * and so on. `Bun.file()` creates a lazy reference to a file on disk; passing it
 * to `new Response()` streams the file and sets the Content-Type header from
 * the file extension (text/html, text/javascript, text/css, image/png, ...).
 */
import path from "node:path";

// `import.meta.dir` is the folder of the current file (src/), so this path
// works no matter which folder the server is started from.
const PUBLIC_DIR = path.resolve(import.meta.dir, "..", "public");

export async function serveStatic(pathname: string): Promise<Response | null> {
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.resolve(PUBLIC_DIR, relativePath);

  // Path traversal protection. A request such as "/../src/types.ts" must not
  // escape the public folder and expose the server's source code (or worse,
  // /etc/passwd). After resolving the path we check it is still inside PUBLIC_DIR.
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    return null;
  }

  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    return null;
  }

  return new Response(file);
}
