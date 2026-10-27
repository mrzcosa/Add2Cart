# Add2Cart

Add2Cart is a React and Vite marketplace demo. It runs entirely in the browser and stores its catalog changes, guest profile, cart, saved items, addresses, orders, and seller listings in local storage.

## Run locally

```sh
npm install
npm run dev
```

Vite starts the app at `http://127.0.0.1:5173`. To create a production build, run `npm run build`; to serve that build locally, run `npm start`.

This version does not use a server API or database. Browser storage is local to the current browser profile and is not shared across devices. Clearing this site's browser data removes locally saved marketplace data.

Any existing files under `server/data` are left untouched, but the app no longer reads them.
