# CalmsSelfRegistration

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.0.4.

## Environment Configuration

This project uses environment-specific configuration files to manage different API endpoints and settings for development and production environments.

### Environment Files

- **Development Environment** (`src/environments/environment.ts`):
  - `production: false`
  - `proURL: 'http://localhost:57080/'`
  - `apiURL: 'http://localhost:57080/api/vims'`
  - `portalApiURL: 'http://localhost:57080/api/portal'`

- **Production Environment** (`src/environments/environment.prod.ts`):
  - `production: true`
  - `proURL: '../'`
  - `apiURL: '../app/api/Vims'`
  - `portalApiURL: '../app/api/portal'`

> **Note:** During build, the environment configuration is automatically replaced based on the build configuration. The development environment is used for `ng serve` and development builds, while the production environment is used for production builds.

## Development server

To start a local development server, run:

```bash
npm start
```

or

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

### Development Build

To build the project for development:

```bash
npm run build:dev
```

or

```bash
ng build --configuration development
```

This will compile your project in development mode and store the build artifacts in the `dist/` directory. The development build uses the `environment.ts` configuration file.

### Production Build

To build the project for production:

```bash
npm run build:prod
```

or

```bash
ng build --configuration production
```

This will compile your project in production mode with optimizations for performance and speed. The production build uses the `environment.prod.ts` configuration file and stores the build artifacts in the `dist/` directory.

### Default Build

To build the project with default settings (production by default):

```bash
npm run build
```

or

```bash
ng build
```

### Watch Mode

To build the project in watch mode (useful during development):

```bash
npm run watch
```

or

```bash
ng build --watch --configuration development
```

This will recompile the project automatically whenever you modify any of the source files.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
