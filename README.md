# UDAMAN 2.0

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

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!


# ToDo Notes For Later
1. Implement a standard, response shape from controllers. Something like:
    ```js
    return { message: "Succesfully did action", data: payload }
    ```
    Doesn't need to be fancy, but controller seems like the appropriate layer to handle basic logging & messages. Messages can be used in Toasts in the UI to show confirmations/errors to the user.
2. Set consistent log levels, maybe info for controllers, debug for models & collections.

3. Setup testing for the write methods, anything using CREATE, INSERT, DELETE, UPDATE. Much of this code has been ai generated, and before putting the app on prod it's important that these actions are reviewed carefully. 
    - Note that Deletes need to be reviewed so that they aren't leaving orphaned records. 
    - Updates, Insert, Creates need to be reviewed to ensure related records are also updated or created where relevant.
    - Claude's gotten pretty great, but it still often misses the broader context when methods are interconnected.


# Migrations needed
1. dataPortalName is appears to be the only camelCase name in a database of snake_case names. setup a migration to rename to data_portal_name.
2. 

# Questions for Peter
1. Is Forecast Upload still used?
2. Is FC Universe used (would it be if we added some new features?)
3. Any Reason to keep AREMOS comparison fields/features like diff & missing
- check for any other abandoned or deprecated items