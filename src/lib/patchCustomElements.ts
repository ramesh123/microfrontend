// `container` and `workflow` each bundle their own independent copy of
// @material/web (it isn't in either app's Module Federation `shared` list).
// When workflow's remote chunks execute inside the container page, their
// top-level `customElements.define("md-elevation", ...)` (and similar) calls
// run again for tag names the container's own bundle already registered.
// `CustomElementRegistry` is a single, page-wide registry, so the second
// `define()` for the same name throws `NotSupportedError` and crashes
// whichever component tree happened to trigger it. Since both bundles ship
// the same @material/web version, treating a duplicate `define()` as a no-op
// is safe — it just keeps the first registration.
if (typeof window !== "undefined" && window.customElements) {
  const nativeDefine = window.customElements.define.bind(window.customElements);
  window.customElements.define = ((
    name: string,
    constructor: CustomElementConstructor,
    options?: ElementDefinitionOptions,
  ) => {
    if (window.customElements.get(name)) return;
    nativeDefine(name, constructor, options);
  }) as typeof window.customElements.define;
}

export {};
