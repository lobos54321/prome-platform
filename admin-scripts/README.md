# Admin Scripts

This folder contains administrative scripts for managing the ProMe platform.

## add-credits.js

Adds credits to a user account (ES6 modules version).

## add-credits.cjs

Adds credits to a user account (CommonJS version - use if you encounter ES6 module issues).

### Prerequisites

1. Install dependencies: `npm install`
2. Ensure your `.env` file contains the Supabase configuration:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### Usage

#### ES6 Modules Version (recommended)
```bash
node admin-scripts/add-credits.js <email> <credits> [description]
```

#### CommonJS Version (fallback)
```bash
node admin-scripts/add-credits.cjs <email> <credits> [description]
```

### Examples

```bash
# Add 10000 credits to the admin account (ES6 version)
node admin-scripts/add-credits.js lobos54321@gmail.com 10000 "Initial admin credits"

# Add 5000 credits with custom description (CommonJS version)
node admin-scripts/add-credits.cjs user@example.com 5000 "Bonus credits for testing"
```

### What it does

1. Finds the user by email address
2. Updates their credit balance
3. Creates a billing record for audit purposes
4. Provides detailed console output of the operation

### Notes

- The script requires the user to already exist in the database
- Credits are added to the existing balance (not replaced)
- A billing record is created for tracking purposes
- If the billing record fails, the credit addition will still succeed
- Both ES6 and CommonJS versions are functionally identical
- Use the CommonJS version if you encounter "Cannot use import statement outside a module" errors