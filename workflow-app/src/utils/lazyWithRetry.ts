/**
 * Lazy load utility with retry and automatic page reload on chunk load failure
 *
 * This utility handles the common "Failed to fetch dynamically imported module" error
 * that occurs when users have an active session during a deployment that changes
 * chunk hashes. It will retry failed imports and, as a last resort, reload the page
 * to fetch the latest version.
 *
 * @example
 * ```typescript
 * const MyComponent = lazy(() =>
 *   lazyWithRetry(() => import('./MyComponent'), 'MyComponent')
 * );
 * ```
 */

interface RetryOptions {
  /**
   * Number of retry attempts before reloading the page
   * @default 2
   */
  retriesLeft?: number;

  /**
   * Delay between retry attempts in milliseconds
   * @default 1000
   */
  interval?: number;
}

/**
 * Wraps a dynamic import with retry logic and automatic page reload
 *
 * @param importFn - The dynamic import function (e.g., () => import('./Component'))
 * @param moduleName - A unique name for the module (used for tracking reloads)
 * @param options - Configuration options for retry behavior
 * @returns A promise that resolves to the imported module
 */

export const lazyWithRetry = <T = any>(
  importFn: () => Promise<T>,
  moduleName: string,
  options: RetryOptions = {}
): Promise<T> => {
  const { retriesLeft = 2, interval = 1000 } = options;

  return new Promise((resolve, reject) => {
    importFn()
      .then(resolve)
      .catch((error) => {
        // Check if it's a chunk load error
        const isChunkLoadError =
          error?.message?.includes('Failed to fetch dynamically imported module') ||
          error?.message?.includes('Importing a module script failed') ||
          error?.message?.includes('error loading dynamically imported module');

        if (!isChunkLoadError) {
          // Not a chunk load error, reject immediately
          reject(error);
          return;
        }

        console.warn(
          `Chunk load error for module "${moduleName}". Retries left: ${retriesLeft - 1}`,
          error
        );

        // If this is the last retry attempt
        if (retriesLeft === 1) {
          const reloadKey = `retry-lazy-refresh-${moduleName}`;
          const hasReloaded = window.sessionStorage.getItem(reloadKey);

          // Check if we've already reloaded for this module
          if (hasReloaded) {
            console.error(
              `Module "${moduleName}" failed to load even after page reload. This may indicate a network issue.`
            );
            reject(error);
            return;
          }

          // Mark that we're about to reload for this module
          window.sessionStorage.setItem(reloadKey, 'true');

          console.info(
            `Final retry attempt failed for "${moduleName}". Reloading page to fetch latest version...`
          );

          // Force a hard reload to fetch the latest version
          window.location.reload();
          return;
        }

        // Retry with exponential backoff
        setTimeout(() => {
          lazyWithRetry(importFn, moduleName, {
            retriesLeft: retriesLeft - 1,
            interval: interval * 1.5, // Exponential backoff
          })
            .then(resolve)
            .catch(reject);
        }, interval);
      });
  });
};

/**
 * Clear all retry reload flags from sessionStorage
 * Useful for testing or manual cleanup
 */
export const clearRetryFlags = (): void => {
  const keysToRemove: string[] = [];

  for (let i = 0; i < window.sessionStorage.length; i++) {
    const key = window.sessionStorage.key(i);
    if (key && key.startsWith('retry-lazy-refresh-')) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => window.sessionStorage.removeItem(key));
};

/**
 * Version check utility to detect when a new deployment is available
 * Call this periodically or on route changes to prompt users to reload
 *
 * @param currentVersion - The current app version (e.g., from package.json or build time)
 * @returns Promise that resolves to true if a new version is available
 */
export const checkForNewVersion = async (currentVersion: string): Promise<boolean> => {
  try {
    // Fetch the current index.html with cache-busting
    const response = await fetch(`/?v=${Date.now()}`, {
      method: 'HEAD',
      cache: 'no-cache',
    });

    // Check ETag or Last-Modified headers to detect changes
    const etag = response.headers.get('etag');
    const lastModified = response.headers.get('last-modified');

    const storedEtag = window.sessionStorage.getItem('app-version-etag');
    const storedLastModified = window.sessionStorage.getItem('app-version-last-modified');

    // Store current version info if not already stored
    if (!storedEtag && etag) {
      window.sessionStorage.setItem('app-version-etag', etag);
    }
    if (!storedLastModified && lastModified) {
      window.sessionStorage.setItem('app-version-last-modified', lastModified);
    }

    // Check if version has changed
    const hasChanged =
      (storedEtag && etag && storedEtag !== etag) ||
      (storedLastModified && lastModified && storedLastModified !== lastModified);

    return hasChanged;
  } catch (error) {
    console.error('Error checking for new version:', error);
    return false;
  }
};

export default lazyWithRetry;
