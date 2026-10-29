This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Layout Workspace

Upload photos on any workspace page, then use the navigation links to switch tools. Crops, color adjustments, borders, and captions from the photo editor are included in layouts.

The home page at `/` offers two choices: photo editing at `/edit` and layout editing at `/layout/collage`. Select the Stillframe brand in either workspace to return home. Layout pages are available at `/layout/collage`, `/layout/freeform`, `/layout/print`, and `/layout/composition`. `/layout` redirects to the collage page. Each URL can be opened directly and supports browser back/forward navigation.

- **Collage**: choose grid, columns, rows, or a featured-photo template; select photos, change their order, and adjust margins, gaps, background, and photo fit.
- **Freeform**: select and drag photos on the canvas, resize using the corner handle or numeric controls, and change layer order. Arrow keys move the focused photo; Shift increases the step.
- **Print**: choose A4, A5, 4 x 6 inches, or custom dimensions at 300 pixels per inch. Export PNG or open the browser print dialog to print or save as PDF. Use the matching paper size, no margins, and 100% scale in the print dialog.
- **Composition**: combine a single photo with a heading, subtitle, frame margin, and custom colors.

Each layout page retains its own settings while navigating within the app, returning home, or returning to the photo editor. The shared workspace stays mounted during client-side navigation. Work is kept in memory for the current session, not across page reloads or new browser tabs. PNG exports use the configured pixel dimensions (320 to 6000 per side); previews use a reduced resolution. For physical print sizing, use the print action rather than relying on PNG resolution metadata. Layout processing stays in the browser.

Home preview photographs are stored locally, sourced from Unsplash: [mountain](https://images.unsplash.com/photo-1464822759023-fed622ff2c3b) and [lake](https://images.unsplash.com/photo-1501785888041-af3ef285b470).

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
