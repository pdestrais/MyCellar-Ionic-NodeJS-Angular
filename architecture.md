# MyCellar Application - Architecture Documentation

## Overview

**MyCellar** is a full-stack wine cellar management application built with Angular/Ionic for the frontend and Node.js/Express for the backend. The application supports multiple deployment targets including web browsers, Progressive Web Apps (PWA), mobile devices, and desktop (via Electron).

**Version:** 4.6.2 (client) / 4.4.4 (server)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Angular 21  │  │    PouchDB   │  │     NgRx     │          │
│  │  + Ionic 8   │  │    Local     │  │    State     │          │
│  │              │  │   Storage    │  │  Management  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                  │                  │                  │
└─────────┼──────────────────┼──────────────────┼──────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Network Layer                               │
│              HTTP/REST APIs  ◄──►  Sync Protocol                │
└─────────────────────────────────────────────────────────────────┘
          │                                      │
          ▼                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Server Layer                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Node.js    │  │     JWT      │  │   Mailjet    │          │
│  │  + Express   │  │     Auth     │  │    Email     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
          │                                      │
          ▼                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Data Layer                                │
│  ┌──────────────────────────┐  ┌──────────────────────────┐    │
│  │   Cloudant/CouchDB       │  │  IBM Cloud Object        │    │
│  │   (Remote Database)      │  │  Storage (S3)            │    │
│  └──────────────────────────┘  └──────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend

- **Framework:** Angular 21 with Ionic 8
- **State Management:** NgRx (Store, Effects, Operators)
- **Local Database:** PouchDB 7.2.2
- **UI Components:** Ionic Components (standalone)
- **Internationalization:** ngx-translate
- **Routing:** Angular Router with lazy loading
- **PWA:** Angular Service Worker
- **Desktop:** Electron
- **Mobile:** Capacitor 5.6.0
- **Additional Libraries:**
  - D3.js for data visualization
  - jsPDF for report generation
  - Pica for image optimization
  - dayjs for date handling

### Backend

- **Runtime:** Node.js 22.x
- **Framework:** Express 4.x
- **Authentication:** JSON Web Tokens (JWT)
- **Database:** Cloudant/CouchDB (remote sync)
- **Object Storage:** IBM Cloud Object Storage (S3-compatible)
- **Email:** Mailjet API
- **File Upload:** Multer
- **Utilities:** Axios, body-parser, compression, CORS, jsrender

### DevOps & Deployment

- **Containerization:** Docker (multi-stage builds)
- **Cloud Platforms:**
  - IBM Cloud (Cloud Foundry & Code Engine)
  - Google App Engine
- **Build Tools:** Angular CLI, npm/yarn

---

## Application Architecture

### 1. Client Architecture

#### Component Structure

```
client/src/app/
├── app.component.ts          # Root component
├── app.module.ts             # Root module with NgRx setup
├── app-routing.module.ts     # Route definitions with lazy loading
├── guards/                   # Route guards (AuthGuard)
├── models/                   # Data models
│   └── cellar.model.ts      # VinModel, TypeModel, AppellationModel, etc.
├── services/                 # Business logic services
│   ├── pouchdb.service.ts   # Local database operations & sync
│   ├── auth.service.ts      # Authentication
│   ├── menu.service.ts      # Menu management
│   └── user-management.service.ts
├── state/                    # NgRx state management
│   ├── app.state.ts         # Root state definition
│   ├── vin/                 # Wine state (actions, effects, reducers, selectors)
│   ├── type/                # Wine type state
│   ├── appellation/         # Appellation state
│   └── origine/             # Origin state
└── [feature-modules]/        # Lazy-loaded feature modules
    ├── home/                # Dashboard
    ├── vin/                 # Wine management
    ├── authentication/      # Login/Register
    ├── user-management/     # User profile
    ├── stats/               # Statistics
    ├── rapport/             # Reports
    ├── ready-to-drink/      # Wines ready to consume
    ├── vintage/             # Vintage information
    ├── appellation/         # Appellation management
    ├── type/                # Wine type management
    └── region/              # Region management
```

#### State Management (NgRx)

The application uses **NgRx** for centralized state management with the following pattern:

```
Component ──dispatch──> Action ──> Reducer ──> New State
    ▲                      │                      │
    │                      ▼                      │
    │                   Effects                   │
    │                      │                      │
    │                      ▼                      │
    │                  Service (API)              │
    │                      │                      │
    └──────select─────────┴──────────────────────┘
```

**State Structure:**

- **VinState:** Wine inventory management
  - `vins`: Map of wines (key: wine.\_id)
  - `status`: pending | loading | error | saved | deleted | loaded | noop
  - `error`: Error messages
  - `eventLog`: Array of state change events
  - `source`: internal | external (for tracking change origin)
  - `currentWine`: Currently selected wine

- **TypeState:** Wine types (Red, White, Rosé, etc.)
- **AppellationState:** Wine appellations
- **OrigineState:** Wine origins/regions

**Key Features:**

- Event logging for tracking state changes
- Source tracking (internal vs external changes)
- Optimistic updates with conflict resolution
- Status tracking for UI feedback
- Duplicate event detection

#### Data Synchronization

```
┌──────────────┐
│ User Action  │
└──────┬───────┘
       │
       ▼
┌──────────────┐     ┌──────────────┐
│  NgRx Store  │────>│   PouchDB    │
│              │     │   (Local)    │
└──────────────┘     └──────┬───────┘
       ▲                    │
       │                    │ Sync
       │                    ▼
       │             ┌──────────────┐
       │             │   Cloudant   │
       │             │   (Remote)   │
       │             └──────┬───────┘
       │                    │
       └────────────────────┘
         External Changes
```

**PouchDB Service Features:**

- Bidirectional sync with remote Cloudant database
- Live replication with retry logic
- Change feed monitoring (`dbChanges$` observable)
- Event-driven architecture (`dbEvents$` observable)
- Conflict resolution
- Database destruction and recreation for full sync

**Event Types:**

- `docInsert` - Document inserted
- `docUpdate` - Document updated
- `docDelete` - Document deleted
- `dbReplicationStarted` - Replication started
- `dbReplicationCompleted` - Replication completed
- `dbReplicationFailed` - Replication failed
- `dbSyncStarted` - Sync started
- `dbSynchronized` - Sync completed
- `dbSyncFailed` - Sync failed
- `winesReadyToLoad` - Wines ready to load

#### Routing & Navigation

The application uses **lazy loading** for optimal performance:

- Protected routes with `AuthGuard`
- Feature modules loaded on demand
- Route data for component behavior (list vs edit modes)

**Main Routes:**

- `/` → redirects to `/home`
- `/home` - Dashboard (protected)
- `/vin` - Wine list (protected)
- `/vin/:id` - Wine detail/edit (protected)
- `/appellations` - Appellation list (protected)
- `/appellation` - New appellation (protected)
- `/appellation/:id` - Edit appellation (protected)
- `/types` - Wine type list (protected)
- `/type` - New wine type (protected)
- `/type/:id` - Edit wine type (protected)
- `/regions` - Region list (protected)
- `/region` - New region (protected)
- `/region/:id` - Edit region (protected)
- `/stats` - Statistics (protected)
- `/readytodrink` - Ready to drink wines (protected)
- `/rapport` - Reports (protected)
- `/vintage` - Vintage information
- `/login` - User login
- `/register` - User registration
- `/user-management` - User profile management
- `/about` - About page

---

### 2. Server Architecture

#### API Structure

```
server/
├── server.js                 # Main Express application
├── config.json              # Configuration file
├── s3/                      # IBM Cloud Object Storage integration
│   ├── s3Client.js         # S3 client initialization (IAM/HMAC)
│   ├── endpoints.js        # Endpoint discovery and management
│   ├── bucket.js           # Bucket operations (list, create)
│   └── object.js           # Object CRUD operations
└── templates/               # Email templates (jsrender)
    ├── confirmEmailTmpl.html
    ├── confirmRegistrationTmpl.html
    ├── approveReqTmpl.html
    └── emailTmpl1.html
```

#### Key API Endpoints

**Authentication & User Management:**

- `POST /api/login` - User authentication (returns JWT + DB credentials)
- `POST /api/register` - New user registration request
- `GET /api/user/:username` - Get user details
- `POST /api/updateUserData` - Update user profile
- `POST /api/changePassword` - Change user password
- `POST /api/resetPassword` - Reset forgotten password
- `GET /api/approveUserSignupRequest/:id` - Admin approval workflow
- `GET /api/processUserRequestConfirmation/:id` - Email confirmation
- `POST /api/sendEMail` - Send email notifications

**Wine Image Management:**

- `POST /api/uploadWineImage` - Upload wine photos to S3
- `GET /api/getWineImage/:imageName` - Retrieve wine images
- `DELETE /api/deleteWineImage/:imageName` - Delete wine images
- `GET /api/listWineImages` - List all wine images

**System:**

- `GET /api/ping` - Health check and version info

#### Authentication Flow

```
┌────────┐                                    ┌────────┐
│ Client │                                    │ Server │
└───┬────┘                                    └───┬────┘
    │                                             │
    │  POST /api/register                         │
    ├────────────────────────────────────────────>│
    │                                             │
    │                                             │ Create user request
    │                                             │ in user-mngt-app DB
    │                                             │
    │                                             │ Send approval email
    │                                             │ to admin
    │                                             │
    │  Registration request created               │
    │<────────────────────────────────────────────┤
    │                                             │

┌───────┐
│ Admin │ Receives email, clicks approval link
└───┬───┘
    │  GET /api/approveUserSignupRequest/:id
    ├────────────────────────────────────────────>│
    │                                             │
    │                                             │ Send confirmation
    │                                             │ email to user
    │                                             │
    │  Approval sent                              │
    │<────────────────────────────────────────────┤
    │                                             │

┌────────┐
│  User  │ Receives email, clicks confirmation link
└───┬────┘
    │  GET /api/processUserRequestConfirmation/:id│
    ├────────────────────────────────────────────>│
    │                                             │
    │                                             │ Create user in
    │                                             │ app-users DB
    │                                             │
    │                                             │ Create user's
    │                                             │ personal DB
    │                                             │
    │  Account created                            │
    │<────────────────────────────────────────────┤
    │                                             │
    │  POST /api/login                            │
    ├────────────────────────────────────────────>│
    │                                             │
    │                                             │ Verify credentials
    │                                             │
    │  JWT token + DB credentials                 │
    │<────────────────────────────────────────────┤
    │                                             │
```

**Security Features:**

- JWT-based authentication with configurable expiration
- Password hashing with crypto (SHA-256)
- Email verification workflow
- Admin approval for new users
- Per-user database isolation
- Secure token storage in localStorage

#### Database Architecture

**Cloudant/CouchDB Structure:**

- `app-users` - User accounts and profiles
  - Contains: username, password (hashed), email, firstname, lastname, address, phone, admin flag
- `user-mngt-app` - User management requests
  - Registration requests
  - Password reset requests
  - Email confirmation tracking
- `cellar-{username}` - Per-user wine databases
  - Isolated data per user
  - Contains wines, appellations, types, regions

**Benefits:**

- Data isolation per user (security & privacy)
- Offline-first capability with PouchDB sync
- Automatic conflict resolution
- Scalable multi-tenant architecture
- No need for complex authorization logic

#### Object Storage (IBM Cloud S3)

**Features:**

- Wine photo storage in cloud
- Image upload with metadata (name, width, height, orientation, fileType)
- HMAC or IAM authentication support
- Automatic endpoint discovery
- Bucket and object management operations
- Multipart upload support via Multer

**S3 Operations:**

- `putObject` - Upload single object
- `putImage` - Upload image with metadata
- `putObjects` - Batch upload
- `getObject` - Download object
- `headObject` - Get object metadata
- `deleteObject` - Delete object
- `listBuckets` - List available buckets
- `listObjects` - List objects in bucket

---

### 3. Data Models

#### Core Entities

**VinModel (Wine):**

```typescript
{
  _id: string              // Unique identifier (PouchDB/CouchDB)
  _rev: string             // Revision for conflict resolution
  nom: string              // Wine name
  annee: string            // Vintage year
  nbreBouteillesAchat: number    // Bottles purchased
  nbreBouteillesReste: number    // Bottles remaining
  prixAchat: number        // Purchase price
  dateAchat: string        // Purchase date
  remarque?: string        // Notes/comments
  localisation: string     // Storage location in cellar
  contenance?: string      // Bottle size (750ml, 1.5L, etc.)
  appellation: AppellationModel  // Wine appellation
  origine: OrigineModel    // Geographic origin
  type: TypeModel          // Wine type (Red, White, etc.)
  cepage?: string          // Grape variety
  apogee?: string          // Peak drinking period
  GWSScore?: number        // Global Wine Score
  rating?: number          // User rating (1-5)
  photo?: {                // Photo metadata
    name: string
    width: number
    height: number
    orientation: string
    fileType: string
    binary?: any
  }
  cotes?: CoteModel[]      // Critic scores
  history: HistoryModel[]  // Consumption/adjustment history
  lastUpdated?: string     // Last modification timestamp
}
```

**TypeModel (Wine Type):**

```typescript
{
  _id: string; // Unique identifier
  _rev: string; // Revision
  nom: string; // Type name (Rouge, Blanc, Rosé, etc.)
}
```

**AppellationModel:**

```typescript
{
  _id: string; // Unique identifier
  _rev: string; // Revision
  courte: string; // Short name
  longue: string; // Full name
}
```

**OrigineModel (Geographic Origin):**

```typescript
{
  _id: string              // Unique identifier
  _rev: string             // Revision
  pays: string             // Country
  region: string           // Region
  groupVal?: string        // Grouping value for statistics
}
```

**HistoryModel (Consumption History):**

```typescript
{
  type: string; // 'consumption' | 'adjustment'
  difference: number; // Number of bottles (+/-)
  date: string; // Date of event
  comment: string; // Optional comment
}
```

**CoteModel (Critic Score):**

```typescript
{
  _id: string; // Unique identifier
  criticName: string; // Critic name
  score: number; // Score (typically 0-100)
}
```

**UserModel:**

```typescript
{
  username: string; // Unique username
  password: string; // Hashed password
  firstname: string; // First name
  lastname: string; // Last name
  email: string; // Email address
  address: string; // Physical address
  phone: string; // Phone number
  token: string; // JWT token (client-side only)
  admin: boolean; // Admin flag
}
```

---

## Deployment Architecture

### Multi-Platform Support

```
                    ┌─────────────────┐
                    │  Source Code    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Build Process  │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
    ┌───────▼──────┐  ┌──────▼──────┐  ┌─────▼──────┐
    │  Web/PWA     │  │  Electron   │  │   Mobile   │
    │    Build     │  │    Build    │  │   Build    │
    └───────┬──────┘  └──────┬──────┘  └─────┬──────┘
            │                │                │
    ┌───────┼────────┐       │                │
    │       │        │       │                │
    ▼       ▼        ▼       ▼                ▼
┌────────┐ ┌────┐ ┌────┐ ┌──────┐      ┌──────────┐
│IBM CF  │ │IBM │ │GCP │ │.dmg  │      │iOS/      │
│        │ │Code│ │App │ │macOS │      │Android   │
│        │ │Eng.│ │Eng.│ │      │      │Capacitor │
└────────┘ └────┘ └────┘ └──────┘      └──────────┘
```

### Build Configurations

**Development:**

```bash
# Backend (from project root)
yarn run startdev          # Node.js with debugging on port 8080
                          # Uses .env.dev configuration

# Frontend (from client directory)
yarn start                # Angular dev server on port 4200
                          # Hot reload enabled
```

**Production:**

1. **Web/PWA:**

   ```bash
   # Build frontend
   cd client
   ionic build --prod     # or: yarn buildProd

   # Build backend
   cd ..
   npm run startprod      # Uses .env.prod configuration

   # Deploy to IBM Cloud Foundry
   cf login
   cf push

   # OR Deploy to IBM Code Engine (Docker)
   ./createPushDockerImageToIBMCloud.sh

   # OR Deploy to Google App Engine
   gcloud app deploy --project <PROJECT_ID>
   ```

2. **Electron Desktop:**

   ```bash
   cd client
   yarn buildElectron     # Build with base-href ./
   electron .             # Test locally
   yarn dist              # Create distributable (.dmg for macOS)
   ```

3. **Mobile (iOS/Android):**
   ```bash
   cd client
   ionic build --prod
   # Use Capacitor CLI for platform-specific builds
   npx cap add ios
   npx cap add android
   npx cap sync
   npx cap open ios       # Opens Xcode
   npx cap open android   # Opens Android Studio
   ```

### Docker Multi-Stage Build

The `Dockerfile` uses a two-stage build for optimal image size:

**Stage 1: Build (node:lts-hydrogen)**

- Install dependencies
- Install Angular CLI
- Build production Angular app
- Output to `www` directory

**Stage 2: Production (node:hydrogen-alpine3.17)**

- Copy built frontend from stage 1
- Copy backend code
- Install production dependencies only
- Expose port 8080
- Run Node.js server

**Benefits:**

- Smaller final image (~200MB vs ~1GB)
- Faster deployments
- Separation of build and runtime dependencies
- Security (no build tools in production)

### Environment Configuration

**Environment Variables (.env files):**

```
dbProtocol=https
dbHost=<cloudant-host>
dbHostServiceUsername=<username>
dbHostServicePassword=<password>
mailUserId=<mailjet-api-key>
mailUserSecret=<mailjet-secret>
jwtSecret=<jwt-secret>
jwtExpiresIn=24h
cosApiKey=<ibm-cos-api-key>
cosResourceInstanceId=<ibm-cos-instance-id>
cosBucketName=<bucket-name>
```

**Configuration Files:**

- `.env.dev` - Development settings
- `.env.prod` - Production settings
- `server/config.json` - Server configuration
- `client/src/environments/environment.ts` - Angular dev environment
- `client/src/environments/environment.prod.ts` - Angular prod environment

---

## Key Features

### 1. Offline-First Architecture

- **PouchDB** for local storage with full CRUD operations
- Automatic sync when online connection is available
- Conflict resolution using CouchDB's MVCC
- Works completely offline - no internet required for core functionality
- Queue-based sync for pending changes

### 2. Real-Time Synchronization

- Live replication between local PouchDB and remote Cloudant
- Change feed monitoring with reactive observables
- Event-driven updates propagated through NgRx store
- Optimistic UI updates with rollback on failure
- Bidirectional sync (local ↔ remote)

### 3. Multi-Tenant Design

- Per-user database isolation (`cellar-{username}`)
- Secure data separation at database level
- Scalable architecture supporting unlimited users
- No cross-user data leakage
- Simplified authorization (database-level)

### 4. Progressive Web App (PWA)

- Service Worker for offline support
- App-like experience in browsers
- Installable on devices (Add to Home Screen)
- Background sync capability
- Push notifications ready
- Responsive design for all screen sizes

### 5. Cross-Platform

- Single codebase for web, mobile, and desktop
- Responsive design with Ionic components
- Platform-specific optimizations via Capacitor
- Native device features access (camera, file system)
- Consistent UX across platforms

### 6. Image Management

- Cloud-based photo storage (IBM Cloud Object Storage S3)
- Image optimization with Pica library
- Metadata tracking (dimensions, orientation, type)
- Efficient retrieval with caching
- Support for multiple image formats

### 7. Internationalization (i18n)

- Multi-language support (English, French)
- ngx-translate integration
- Locale-specific formatting (dates, numbers)
- Easy to add new languages
- Translation files in JSON format

### 8. State Management

- Centralized state with NgRx
- Predictable state updates
- Time-travel debugging support
- Efficient change detection
- Immutable state patterns

### 9. Statistics & Reporting

- D3.js visualizations
- PDF report generation with jsPDF
- Wine inventory analytics
- Ready-to-drink wine tracking
- Vintage quality information

---

## Security Considerations

### Authentication & Authorization

1. **JWT-based Authentication**
   - Secure token generation with configurable expiration
   - Token stored in localStorage (consider httpOnly cookies for enhanced security)
   - Token validation on every API request

2. **Password Security**
   - SHA-256 hashing with salt
   - No plain-text password storage
   - Secure password reset workflow

3. **Email Verification**
   - Two-step registration process
   - Email confirmation required
   - Admin approval workflow

### Data Security

1. **Database Isolation**
   - Per-user databases prevent data leakage
   - No shared data between users
   - Database-level access control

2. **HTTPS/TLS**
   - Encrypted communication in production
   - Secure WebSocket connections for sync

3. **CORS Configuration**
   - Controlled cross-origin access
   - Whitelist-based origin validation

4. **Environment Variables**
   - Sensitive data in `.env` files
   - Never committed to version control
   - Different configs for dev/prod

### API Security

1. **Input Validation**
   - Request parameter validation
   - SQL injection prevention (NoSQL)
   - XSS protection

2. **Rate Limiting**
   - Consider implementing rate limiting for production
   - Prevent brute force attacks

3. **Error Handling**
   - Generic error messages to clients
   - Detailed logging server-side
   - No sensitive data in error responses

---

## Performance Optimizations

### Frontend

1. **Lazy Loading**
   - Feature modules loaded on demand
   - Reduced initial bundle size
   - Faster initial page load

2. **Change Detection**
   - OnPush strategy where applicable
   - Efficient NgRx selectors with memoization
   - Minimal component re-renders

3. **Image Optimization**
   - Pica library for client-side resizing
   - Compressed images in cloud storage
   - Lazy loading of images

4. **Service Worker**
   - Caching strategies for static assets
   - Offline functionality
   - Background sync

5. **Bundle Optimization**
   - Tree shaking in production builds
   - AOT compilation
   - Minification and uglification

### Backend

1. **Compression**
   - gzip compression middleware
   - Reduced payload sizes
   - Faster response times

2. **Database Indexing**
   - PouchDB indexes for common queries
   - Efficient data retrieval
   - Optimized view queries

3. **Caching**
   - Consider Redis for session caching
   - Static asset caching
   - API response caching where appropriate

4. **Connection Pooling**
   - Reuse database connections
   - Reduced connection overhead

### Infrastructure

1. **CDN**
   - Static assets served from CDN
   - Reduced server load
   - Faster global access

2. **Load Balancing**
   - Horizontal scaling capability
   - Distributed load across instances

3. **Container Optimization**
   - Multi-stage Docker builds
   - Minimal base images (Alpine)
   - Efficient layer caching

---

## Development Workflow

```
┌──────────────────┐
│ Local Development│
│  - Hot reload    │
│  - Debug mode    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   Git Commit     │
│  - Feature branch│
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Build & Test    │
│  - Unit tests    │
│  - E2E tests     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Docker Image    │
│  - Multi-stage   │
│  - Optimized     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Deploy to Cloud  │
│  - IBM Cloud     │
│  - Google Cloud  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   Production     │
│  - Monitoring    │
│  - Logging       │
└──────────────────┘
```

### Development Tools

- **VS Code** - Primary IDE
- **Chrome DevTools** - Debugging and profiling
- **Ionic DevApp** - Mobile testing
- **Postman** - API testing
- **Git** - Version control

### Testing Strategy

- **Unit Tests:** Jasmine + Karma
- **E2E Tests:** Protractor (configured but optional)
- **Manual Testing:** Multiple platforms and browsers

### CI/CD Considerations

- Automated builds on commit
- Automated testing pipeline
- Containerized deployments
- Blue-green deployment strategy
- Rollback capability

---

## Monitoring & Maintenance

### Logging

- Server-side logging with console
- Client-side debug logging (debug library)
- Error tracking and reporting
- Performance monitoring

### Database Maintenance

- Regular backups of Cloudant databases
- Compaction to reduce database size
- Replication monitoring
- Conflict resolution monitoring

### Updates & Dependencies

- Regular dependency updates
- Security patch monitoring
- Breaking change management
- Version compatibility testing

---

## Future Enhancements

### Potential Improvements

1. **Enhanced Security**
   - Implement refresh tokens
   - Add rate limiting
   - Implement CSRF protection
   - Add 2FA support

2. **Performance**
   - Implement Redis caching
   - Add GraphQL API option
   - Optimize database queries
   - Implement pagination

3. **Features**
   - Social sharing capabilities
   - Wine recommendations
   - Barcode scanning
   - Integration with wine APIs
   - Advanced search and filtering
   - Wine collection valuation

4. **DevOps**
   - Implement CI/CD pipeline
   - Add automated testing
   - Implement monitoring (Prometheus, Grafana)
   - Add logging aggregation (ELK stack)

5. **Mobile**
   - Native mobile apps (React Native or Flutter)
   - Offline-first mobile experience
   - Push notifications
   - Camera integration for labels

---

## Conclusion

MyCellar is a sophisticated, production-ready application demonstrating modern web development best practices:

- **Architecture:** Clean separation of concerns with client-server architecture
- **Offline-First:** Full functionality without internet connection
- **State Management:** Predictable state with NgRx
- **Multi-Platform:** Single codebase for web, mobile, and desktop
- **Scalability:** Multi-tenant design with per-user databases
- **Security:** JWT authentication, email verification, admin approval
- **Performance:** Optimized builds, lazy loading, compression
- **Maintainability:** Modular structure, TypeScript, clear patterns

The architecture is designed for scalability, maintainability, and excellent user experience across all platforms. The offline-first approach with PouchDB/Cloudant sync provides a robust solution for managing wine collections with seamless synchronization across devices.

---

## Quick Reference

### Key Technologies

- **Frontend:** Angular 21, Ionic 8, NgRx, PouchDB
- **Backend:** Node.js 22, Express 4, JWT
- **Database:** Cloudant/CouchDB
- **Storage:** IBM Cloud Object Storage (S3)
- **Email:** Mailjet
- **Deployment:** Docker, IBM Cloud, Google Cloud

### Important Files

- `client/src/app/app.module.ts` - Root module
- `client/src/app/services/pouchdb.service.ts` - Database sync
- `client/src/app/state/` - NgRx state management
- `server/server.js` - Backend API
- `server/s3/` - Object storage integration
- `Dockerfile` - Container configuration

### Environment Setup

1. Install dependencies: `npm install` (root and client)
2. Configure `.env` files
3. Start backend: `yarn run startdev`
4. Start frontend: `cd client && yarn start`
5. Access at `http://localhost:4200`

### Deployment Commands

- **IBM Cloud Foundry:** `cf push`
- **IBM Code Engine:** `./createPushDockerImageToIBMCloud.sh`
- **Google App Engine:** `gcloud app deploy`
- **Electron:** `yarn buildElectron && yarn dist`
