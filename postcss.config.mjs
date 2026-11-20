/**
 * CALL PostCSS pipeline.
 *
 * Plugins are referenced by STRING NAME ONLY — Next.js webpack builds
 * validate the config shape and reject function plugins with:
 *   "A PostCSS Plugin was passed as a function using require(), but it must
 *    be provided as a string."
 *
 * "postcss-legacy-compat" is the old-WebView CSS downleveling pass (see
 * postcss-legacy-compat/index.cjs for everything it rewrites). It is a local
 * "file:" dependency (package.json) so the name resolves identically in:
 *   - webpack build: require.resolve(name, { paths: [<project>] }) + require()
 *   - Turbopack dev: require(name) inside the .next/dev/build/postcss.js
 *     child process (module lookup walks up to <project>/node_modules)
 * A relative path or inline function would break one of the two pipelines.
 */
const config = {
  plugins: ["@tailwindcss/postcss", "postcss-legacy-compat"],
};

export default config;
