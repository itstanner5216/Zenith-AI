// Type declaration for the plugin stylesheet, required for allowArbitraryExtensions.
// Default export is intentional: CSS module typings must use default exports
// because bundlers (esbuild/webpack) inject them as the default binding.
declare const styles: Record<string, string>;
export default styles;
