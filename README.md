# QEase

**QEase — Queue Smarter. Live Better.** is a polished, local-first virtual-queue prototype made for a PKWU business presentation. It presents a small discovery marketplace around Kemang, Jakarta, while keeping two queue businesses genuinely interactive:

- **Barber Kawan** — live barbershop queue
- **Kilap Car Wash** — live car-care queue

The Explore page also includes eight clearly labelled coming-soon businesses to make the idea feel like a growing local platform without pretending that every listing has a live queue.

## Run it locally

This project uses Node.js and pnpm.

```powershell
pnpm install
pnpm dev
```

Vite will print a local address, normally `http://localhost:5173`. Use it to rehearse the presentation on the same computer.

Build the production-ready static site with:

```powershell
pnpm build
pnpm preview
```

The finished website files are created in `dist/`.

## Presentation routes

| What to show | Route |
| --- | --- |
| QEase entrance | `/` |
| Nearby-business discovery | `/explore` |
| Barber Kawan customer queue | `/q/barber-kawan` |
| Kilap Car Wash customer queue | `/q/kilap-car-wash` |
| Example Barber ticket | `/q/barber-kawan/ticket/A23` |
| Example Car Wash ticket | `/q/kilap-car-wash/ticket/W12` |
| Barber staff dashboard | `/dashboard/barber-kawan/live` |
| Car Wash staff dashboard | `/dashboard/kilap-car-wash/live` |
| Barber public in-store display | `/display/barber-kawan` |
| Car Wash public in-store display | `/display/kilap-car-wash` |

Older short dashboard links such as `/dashboard/live` still open the Barber Kawan demo. Staff pages are presentation-gated with the demo PIN **1234**; this is intentionally not real authentication.

## Deploy QEase to Netlify

Publishing is optional, but it is the best way to make the QR code work from a phone. A phone cannot open a QR code that contains `localhost`, because `localhost` means the phone itself—not your computer.

This repository already includes Netlify’s Vite build settings and a single-page-app fallback. That means a shared link such as `/q/kilap-car-wash/ticket/W12` continues to work even when someone opens it directly or scans the QR code.

### Deploy from a Git repository

1. Put this project in a GitHub repository you control.
2. Sign in to [Netlify](https://www.netlify.com/), choose **Add new site → Import an existing project**, then select the repository.
3. Netlify should read the included settings automatically: build command `pnpm build` and publish directory `dist`.
4. Click **Deploy site**. Netlify gives you a public HTTPS address, such as `https://your-qease-demo.netlify.app`.
5. Open that public address, sign into a staff dashboard with PIN `1234`, and open **QR Poster** again. Its QR code uses the current site address automatically, so it will now contain the public Netlify URL rather than `localhost`.

### Manual deploy without GitHub

1. Run `pnpm install` and `pnpm build` on your computer.
2. In Netlify, choose **Add new site → Deploy manually**.
3. Drag the generated `dist` folder into Netlify’s upload area.
4. Open the resulting public site and regenerate/view the QR poster there before printing or sharing it.

Netlify account creation and publishing are deliberately left to you. This prototype does not publish anything automatically or create an account on your behalf.

## Best PKWU demo flow

1. Start on `/`, then choose **Explore nearby queues** to introduce the business idea.
2. Show the filter chips and search, then explain that two businesses are live while eight are future partners.
3. Open **Barber Kawan** and join a queue as a customer. The join flow produces a return window instead of a falsely exact wait time.
4. In a second tab, open the Barber staff dashboard and use PIN `1234`.
5. Call the customer, start service with an available staff member, and complete it. Return to the customer ticket page to show the live status change.
6. Open `/display/barber-kawan` in a third tab or a second screen. It becomes a high-visibility in-store “Now Serving” display, with ticket numbers only and a QR code for joining.
7. Use the customer ticket’s optional **Check in with location** action when you are near the seeded business area; manual check-in remains available because indoor GPS is imperfect.
8. Switch the staff dashboard to **Kilap Car Wash** to demonstrate that the same product works for another walk-in business category with its own services, staff, tickets, analytics, settings, photos, QR code, and public display.
9. Use **Demo Controls** or **Settings → Demo & danger zone** to restore the seeded scenario before another presentation.

## What the prototype demonstrates

- A mobile-first “Nearby queues” discovery screen with search, category filters, and a real interactive OpenStreetMap view of Kemang.
- Ten local-business listings, with two real queues and eight honest coming-soon listings.
- Separate Barber Kawan and Kilap Car Wash settings, services, staff, tickets, analytics, queue prefixes, accent colours, and posters.
- Queue estimates based on work ahead and active staff capacity, plus a real Return Window.
- Staff-safe actions: a worker cannot be double-booked, and an active worker cannot be placed on break or off duty before their service ends.
- Dynamic customer ticket states, countdowns, browser-alert opt-in, and a visible in-app fallback when alerts are unavailable.
- A real QR code generated from the actual address in the browser, with PNG, PDF, print, and copy-link options.
- Optional business logo, storefront, team, and service photos. Owners can upload an image or use their device camera; photos are compressed before browser-local storage.
- Optional location-aware return check-in that confirms only whether a customer is within the business radius. QEase does not save a location history.
- A public fullscreen-friendly “Now Serving” display for a TV/tablet inside the business, with privacy-safe ticket numbers only.
- Calm queue insights calculated from existing queue data, such as peak time, average-wait target, and services taking longest.
- Responsive staff and customer screens that work well on phones as well as desktop presentation screens.

## Local Presentation Mode and Live Shared Queue

By default, QEase opens in **Local Presentation Mode**. It is complete and works without environment variables:

- Data is saved in the current browser.
- Open tabs on the same device share changes using the browser’s local presentation channel.
- The interactive map uses OpenStreetMap and works without an API key.
- Deploying to Netlify makes the QR URL public, but does not by itself make a phone and laptop share data.

For a true phone-to-laptop demo, QEase supports an optional **Live Shared Queue** with Supabase:

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL Editor. Then enable Realtime for the `qease_queues` table if it was not enabled automatically.
3. Copy `.env.example` to `.env.local`.
4. Add only the project URL and **anon** key:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

5. Restart `pnpm dev`, or add the same variables in Netlify’s environment-variable settings and redeploy.

When those two variables are configured, QEase visibly reports **Live shared queue** and syncs the two live businesses through Supabase Realtime. Customer joins, staff actions, public-display changes, and customer ticket states then update between separate devices.

The included Supabase policies are clearly marked **demo only** because this PKWU prototype has no customer/staff authentication. A real launch would replace them with authenticated roles and server-side controls; never put a Supabase service-role key into a Vite variable.

## Maps and privacy

The Explore page uses real OpenStreetMap tiles by default, so no key or billing setup is required. If `VITE_GOOGLE_MAPS_API_KEY` is supplied, QEase loads the Google Maps JavaScript API instead; if it fails to load, it safely returns to the interactive OpenStreetMap version.

Location and camera permission are always requested only after the person presses the relevant button. A failed/denied permission never blocks queue use. Location check-in stores only the checked-in state, not a location trail.
