# Images

Every image the frontend shows is imported, never written as a URL string. Vite then
resolves the path at build time, gives the file a content-hashed name, and emits it
only into the bundles that actually reference it.

That buys three things. A renamed, moved or deleted image fails the build instead of
404ing in a reader's browser. An image nothing references is never bundled, so it
cannot quietly ship. And a hashed filename can safely carry the year-long
`immutable` cache headers the app bundle already gets.

## Where images live

```
frontend/src/assets/
├── facilities/{power,storage,extraction,functional}/   # facility card artwork
├── technologies/                                       # technology card artwork
├── landing/                                            # landing and educators pages
├── wiki/                                               # wiki figures
└── quiz.png                                            # dashboard quiz icon
```

`frontend/public/icon_green.png` is the one exception. It is the PWA icon, and both
its consumers sit outside Vite's module graph: `public/manifest.json` is copied
verbatim, and `src/service-worker.ts` is built by `bun build`. Both name it by URL
(`/static/app/icon_green.png`), so it needs a filename no bundler rewrites.

## Adding an image

1. Run `python scripts/dev/optimize_images.py` after dropping in a PNG or JPEG. It
   converts to WebP at the width and quality the destination directory calls for.
   `scripts/guard-image-weight.ts` enforces the result in CI.
2. Import it and use the imported value:

    ```tsx
    import liveDemoPhoto from "@/assets/landing/live_demo_photo.webp";

    <img src={liveDemoPhoto} alt="Students playing Energetica in a classroom" />;
    ```

In MDX, write the module path in the `src` and a remark plugin turns it into an
import for you — see [Wiki Pages](wiki-pages.md#figures).

## Facility and technology artwork

These are looked up by a name the API supplies, so there is no import statement at
the call site. `frontend/src/lib/assets/asset-images.ts` holds the join, typed
`Record<ProjectType, string>`:

```tsx
import { assetImages } from "@/lib/assets/asset-images";

<img src={assetImages[facilityName]} alt={`${facilityName} facility`} />;
```

Because the record is keyed by `ProjectType` rather than `string`, the compiler
checks it both ways: a project type the backend adds without artwork is a missing
key, and artwork for a type the backend no longer has is an excess property. Adding
a facility therefore fails `bun run typecheck` until its image exists.
