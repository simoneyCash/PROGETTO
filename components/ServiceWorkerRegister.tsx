"use client";

import { useEffect } from "react";

/**
 * PWA service worker lifecycle.
 *
 * In PRODUCTION: registers `/sw.js` so the app is installable.
 * In DEVELOPMENT: registers nothing and actively unregisters any existing
 * service worker on this origin. This avoids the classic footgun where a
 * service worker (even one from a *previous* project that used the same
 * localhost port) keeps serving a stale, cached app from the browser.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // Dev: clean up any stale/foreign service workers and their caches.
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
      if ("caches" in window) {
        caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
      }
      return;
    }

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* registration failures must never break the app */
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
