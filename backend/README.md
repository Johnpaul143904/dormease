<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## DormEase API

The API listens on `http://localhost:3001/api`. Clerk handles frontend
authentication. Protected API requests must include a Clerk session token in
the `Authorization: Bearer <token>` header. The API validates the session and
loads the PostgreSQL user ID and role; it does not trust role claims from the
client. Tenant-specific routes use that authenticated database account and do
not accept a client-supplied tenant ID.

| Resource    | Admin/staff                                                       | Tenant                              |
| ----------- | ----------------------------------------------------------------- | ----------------------------------- |
| Profile     | `GET/PATCH /auth/profile`                                         | `GET/PATCH /auth/profile`           |
| Rooms       | `GET/POST /rooms`, `GET/PATCH/DELETE /rooms/:id`                  | —                                   |
| Tenants     | `GET/POST /tenants`, `GET/PATCH/DELETE /tenants/:id`              | `GET /tenants/me`                   |
| Assignments | `GET/POST /assignments`, `PATCH /assignments/:id/terminate`       | —                                   |
| Payments    | `GET/POST /payments`, `PATCH /payments/:id`                       | `GET /payments/me`                  |
| Maintenance | `GET/POST /maintenance`, `PATCH /maintenance/:id`                 | `GET/POST /maintenance/me`          |
| Invitations | `GET/POST /room-invitations`, `POST /room-invitations/:id/revoke` | Accept/reject an invitation by code |

Set `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`,
`CLERK_AUTHORIZED_PARTIES`, `CORS_ORIGIN`, and `ADMIN_INVITATION_CODE` in the
backend environment. `CLERK_AUTHORIZED_PARTIES` is a comma-separated list of
allowed frontend origins (for example, `http://localhost:3000` locally and the
deployed HTTPS frontend origin in production). Use the configured
`ADMIN_INVITATION_CODE` only for authorized admin provisioning. Do not commit or
share credentials.

The Vercel `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, Vercel server-only
`NUXT_CLERK_SECRET_KEY`, and Render `CLERK_PUBLISHABLE_KEY` /
`CLERK_SECRET_KEY` must all identify the same Clerk production instance (use
live keys in production). A successful API session-token verification confirms
the token belongs to the backend's configured instance; deployment environment
values must still be checked in Vercel and Render when diagnosing
production-only failures. Never expose the secret keys to browser code.

If provisioning finds the same verified email on a user row linked to another
Clerk ID, it intentionally does not replace that ID. Re-registering or matching
the email is not account recovery. A designated administrator must verify
control of the new Clerk identity and independently verify the claimant's
ownership of the existing DormEase account using its established records. For
a stale/deleted Clerk identity, require documented support approval and an
audited, narrowly scoped update of only that user's `clerkUserId`, guarded by
the previously stored ID and the uniqueness constraint. If ownership cannot be
established independently of email, leave the link unchanged and escalate; do
not modify roles, tenant relations, assignments, payments, or other records.

Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and
`CLOUDINARY_API_SECRET` in the backend environment for payment receipt uploads.
Keep the API secret server-side; never configure Cloudinary credentials in the
Nuxt frontend. Receipts are uploaded as authenticated Cloudinary assets and
delivered through the existing authenticated API endpoint.

For the Nuxt deployment, configure `NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
`NUXT_CLERK_SECRET_KEY`, and `NUXT_API_BASE_URL`. The Nuxt API base should point
to the Render API origin with the `/api` prefix; browser requests use the
same-origin frontend proxy.

The Clerk identity migration is additive: it makes `User.password` nullable for
new Clerk-backed accounts and adds a unique nullable `User.clerkUserId`. It does
not delete users, password hashes, role data, relations, or password-reset
tables. Generate the local client with:

```bash
npx prisma generate --config prisma7.config.ts
```

The migration has not been applied to any database. Review and apply it through
the deployment's normal backup and migration process; never use database reset
or destructive schema commands.

The Cloudinary receipt migration is also additive. It keeps existing
`PaymentSubmission.proofData` bytes and makes that field nullable for new
Cloudinary-backed receipts. Existing receipt reads continue to use `proofData`;
new receipt reads use the stored Cloudinary asset metadata. A durable deletion
queue retries Cloudinary cleanup when payment records are removed with a
tenant. Generate the local client with:

```bash
npx prisma generate --config prisma7.config.ts
```

Before deploying this backend version, review and apply the new migration only
through the approved database migration process. This integration does not run
production migrations. Do not run `prisma migrate reset`.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

To add it to this project, run this and approve the code it prints at [observe.nestjs.com/link](https://observe.nestjs.com/link) - signing up for free if you have no account:

```bash
$ npx @nestjs/observe link
```

It installs `@nestjs/observe`, wires it into `AppModule` and `main.ts`, and writes the app key and secret into `.env`, which every `nest start` script (`start`, `start:dev`, `start:debug`) then loads. In production, set `OBSERVE_APP_KEY` and `OBSERVE_APP_SECRET` in the environment instead.

Or do it by hand:

```bash
$ npm install @nestjs/observe
```

Then follow the [setup guide](https://docs.nestjs.com/observability/sdk) - it takes a single import and an app key.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
