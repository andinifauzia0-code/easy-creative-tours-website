# Asset notes

The original Easy Creative Tours logo is stored at `public/assets/brand/easy-creative-tours-logo.png`. The source PNG is copied without changing its artwork or aspect ratio. Header and footer use a CSS crop to account for its transparent canvas margins; the image file remains intact.

To replace the logo, replace the PNG with a transparent image using the same filename. If the canvas dimensions or transparent margins change, adjust the crop rules for `.brand-logo` in `styles.css`.

Temporary travel photography is referenced from Unsplash in `src.js`. Replace those image URLs with approved local photography when it is available.
