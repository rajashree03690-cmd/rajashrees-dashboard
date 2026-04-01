# Edge Function Update Guide

## Changes Made

### 1. **Short Order IDs** (Line 107-109)

**Before:**
```typescript
const order_id = `RF-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`.toUpperCase()
// Example: RF-1768990545336-ZFUOPSL
```

**After:**
```typescript
const randomNum = Math.floor(100000 + Math.random() * 900000)
const order_id = `WB${randomNum}`
// Example: WB384726
```

### 2. **Default Order Status** (Line 156)

**Before:**
```typescript
order_status: 'pending',
```

**After:**
```typescript
order_status: 'processing',  // ✅ UPDATED: Default to 'processing' instead of 'pending'
```

---

## Deployment Instructions

### Option 1: Via Supabase CLI

1. Navigate to your project directory
2. Update the Edge Function:
   ```bash
   supabase functions deploy place-order
   ```

### Option 2: Via Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions**
3. Find the `place-order` function
4. Click **Edit**
5. Replace the code with the updated version from `place-order-updated.ts`
6. Click **Deploy**

---

## Testing

After deployment, test by:

1. **Place a test order** from your website
2. **Verify the order ID** format in the database:
   ```sql
   SELECT order_id, order_status, source FROM orders 
   WHERE source = 'WEB' 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```
3. **Expected results:**
   - Order ID: `WB######` (6 digits)
   - Order Status: `processing`
   - Source: `WEB`

---

## Example Order IDs

- ✅ `WB384726`
- ✅ `WB192847`
- ✅ `WB567890`
- ❌ `RF-1768990545336-ZFUOPSL` (old format)

---

## Rollback Plan

If the update causes issues, revert to the previous version:

```typescript
const order_id = `RF-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`.toUpperCase()
order_status: 'pending',
```
