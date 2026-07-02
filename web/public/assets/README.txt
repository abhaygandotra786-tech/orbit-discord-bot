Orbit — brand assets
====================

Save your two images in THIS folder with these exact names:

  logo.png     ← the square Orbit logo (2nd image)
  banner.png   ← the wide Orbit banner (1st image)

The website automatically uses them:
  - logo.png   → shown in the top-left brand
  - banner.png → shown at the bottom, above the footer

For the Discord bot embeds, the images must be on a PUBLIC URL
(Discord's servers fetch them, so http://localhost won't work).
Easiest options:
  1. Upload both images to any Discord channel, right-click each →
     "Copy Link", then paste those links into .env:
        LOGO_URL=https://cdn.discordapp.com/.../logo.png
        BANNER_URL=https://cdn.discordapp.com/.../banner.png
  2. Or, once the website is deployed on a real domain, use:
        LOGO_URL=https://yourdomain.com/assets/logo.png
        BANNER_URL=https://yourdomain.com/assets/banner.png

Supported formats: png, jpg, webp, gif (keep the .png names above, or
update the paths in web/server.js /api/config if you use a different ext).
