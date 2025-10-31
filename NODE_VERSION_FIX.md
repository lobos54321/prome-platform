# Node.js Version Compatibility Fix

## Issue
The application was crashing on Zeabur deployment with the following error:

```
ReferenceError: File is not defined
    at Object.<anonymous> (/app/node_modules/.pnpm/undici@7.16.0/node_modules/undici/lib/web/webidl/index.js:531:48)
```

Container was running on `Node.js v18.20.8` despite the Dockerfile specifying Node.js 20.

## Root Cause
1. **Missing engines field**: The `package.json` lacked an `engines` field specifying the required Node.js version
2. **Platform default**: Zeabur defaulted to Node.js 18 when no explicit version was specified in package.json
3. **Dependency incompatibility**: 
   - `@supabase/supabase-js` uses `undici@7.16.0` as a dependency
   - `undici@7.16.0` has a known compatibility issue with Node.js 18
   - The `File` global is not available in Node.js 18's global scope

## Solution
Added the `engines` field to `package.json`:

```json
"engines": {
  "node": ">=20.0.0",
  "pnpm": ">=8.10.0"
}
```

## Why This Works
1. **Explicit version requirement**: Deployment platforms like Zeabur will now use Node.js 20+ as specified
2. **Compatible with dependencies**: Node.js 20 includes the `File` global that undici requires
3. **Aligns with Dockerfile**: Both the Dockerfile and package.json now consistently specify Node.js 20
4. **Follows best practices**: @supabase/supabase-js officially deprecates Node.js 18 support

## Verification
- ✅ Build process tested successfully with Node.js 20.19.5
- ✅ Server starts without the undici error
- ✅ No breaking changes to existing functionality
- ✅ Dockerfile already uses `node:20-alpine` base image

## Additional Context
The error message from Supabase confirmed this issue:
```
⚠️  Node.js 18 and below are deprecated and will no longer be supported 
in future versions of @supabase/supabase-js. Please upgrade to Node.js 20 
or later. For more information, visit: 
https://github.com/orgs/supabase/discussions/37217
```

## Prevention
- Always specify the `engines` field in `package.json` for production applications
- Keep Node.js version in sync between:
  - Dockerfile base image
  - package.json engines field
  - CI/CD configuration
  - Local development environment
