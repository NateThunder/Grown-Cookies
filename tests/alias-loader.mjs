import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.resolve(import.meta.dirname, "..");

export function resolve(specifier, context, nextResolve) {
  if (specifier === "next/cache") {
    return {
      url: pathToFileURL(path.join(import.meta.dirname, "next-cache-stub.mjs")).href,
      shortCircuit: true,
    };
  }

  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const parentPath = fileURLToPath(context.parentURL);
    const targetPath = path.resolve(path.dirname(parentPath), specifier);

    for (const candidate of [targetPath, `${targetPath}.ts`, `${targetPath}.tsx`]) {
      if (existsSync(candidate)) {
        return {
          url: pathToFileURL(candidate).href,
          shortCircuit: true,
        };
      }
    }
  }

  if (!specifier.startsWith("@/")) {
    return nextResolve(specifier, context);
  }

  const targetPath = path.join(rootDir, specifier.slice(2));
  const resolvedPath = existsSync(targetPath) ? targetPath : `${targetPath}.ts`;

  return {
    url: pathToFileURL(resolvedPath).href,
    shortCircuit: true,
  };
}
