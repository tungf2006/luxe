# Luxe PostgreSQL Schema — Design Documentation

## 1. ERD Relationship Diagram

```mermaid
erDiagram
    AUTH_USERS["auth.users"] {
        uuid id PK
        string email
        string role
        jsonb user_metadata
        timestamptz created_at
        timestamptz updated_at
    }

    PROFILES["profiles"] {
        uuid id PK "FK → auth.users"
        string full_name
        string avatar_url
        string currency "default: VND"
        string payday "default: '1st'"
        string budget_period "default: 'monthly'"
        boolean onboarding_complete "default: false"
        timestamptz created_at
        timestamptz updated_at
    }

    CATEGORIES["categories"] {
        uuid id PK
        uuid user_id FK "NULL = system default"
        string key
        string name
        string icon
        string color
        string type "enum: income, expense"
        boolean is_default
        integer sort_order
        timestamptz created_at
    }

    ACCOUNTS["accounts"] {
        uuid id PK
        uuid user_id FK
        string name
        account_type type "enum"
        numeric(15,2) balance
        string currency "default: VND"
        string icon
        boolean is_default
        timestamptz created_at
        timestamptz updated_at
    }

    TRANSACTIONS["transactions"] {
        uuid id PK
        uuid user_id FK
        uuid account_id FK "ON DELETE SET NULL"
        uuid category_id FK "ON DELETE SET NULL"
        string merchant
        numeric(15,2) amount
        transaction_type type "enum"
        transaction_status status "enum"
        date date
        string notes
        boolean is_recurring
        timestamptz created_at
        timestamptz updated_at
    }

    BUDGETS["budgets"] {
        uuid id PK
        uuid user_id FK
        uuid category_id FK "ON DELETE SET NULL"
        string name
        numeric(15,2) limit_amount
        numeric(15,2) spent "trigger-maintained"
        string month "YYYY-MM"
        string color
        timestamptz created_at
        timestamptz updated_at
    }

    GOALS["goals"] {
        uuid id PK
        uuid user_id FK
        string name
        numeric(15,2) target_amount
        numeric(15,2) saved_amount
        date deadline
        boolean is_completed
        string color
        string icon "default: 🎯"
        timestamptz created_at
        timestamptz updated_at
    }

    RECURRING_TX["recurring_transactions"] {
        uuid id PK
        uuid user_id FK
        uuid account_id FK "ON DELETE SET NULL"
        uuid category_id FK "ON DELETE SET NULL"
        string merchant
        numeric(15,2) amount
        transaction_type type "enum"
        recurrence_type recurrence "enum"
        integer day_of_month
        integer day_of_week
        date start_date
        date end_date
        boolean is_active
        date last_generated
        timestamptz created_at
        timestamptz updated_at
    }

    NOTIFICATIONS["notifications"] {
        uuid id PK
        uuid user_id FK
        notification_type type "enum"
        string title
        string message
        boolean is_read
        string action_label
        string action_url
        timestamptz created_at
    }

    AUTH_USERS ||--o{ PROFILES : "1:1 (cascade)"
    AUTH_USERS ||--o{ ACCOUNTS : "1:N (cascade)"
    AUTH_USERS ||--o{ CATEGORIES : "1:N (null=system)"
    AUTH_USERS ||--o{ TRANSACTIONS : "1:N (cascade)"
    AUTH_USERS ||--o{ BUDGETS : "1:N (cascade)"
    AUTH_USERS ||--o{ GOALS : "1:N (cascade)"
    AUTH_USERS ||--o{ RECURRING_TX : "1:N (cascade)"
    AUTH_USERS ||--o{ NOTIFICATIONS : "1:N (cascade)"
    ACCOUNTS ||--o{ TRANSACTIONS : "1:N (set null)"
    ACCOUNTS ||--o{ RECURRING_TX : "1:N (set null)"
    CATEGORIES ||--o{ TRANSACTIONS : "1:N (set null)"
    CATEGORIES ||--o{ BUDGETS : "1:N (set null)"
    CATEGORIES ||--o{ RECURRING_TX : "1:N (set null)"
    TRANSACTIONS }|--|| BUDGETS : "trigger refresh spent"
```

### Design Notes

- **Authentication is separated from business data**: `auth.users` holds auth credentials; `profiles` stores display + financial preferences. This is the standard Supabase pattern.
- **All user-data tables FK directly to `auth.users`** (not to `profiles`). This ensures data exists even if a profile row is somehow missing, and simplifies RLS (only one table to check).
- **Categories use a dual model**: system defaults (`user_id IS NULL, is_default = true`) are visible to all users but read-only; user-custom categories (`user_id = <uuid>, is_default = false`) are owned by the creating user. No trigger-on-signup needed — the app query `user_id.eq.{uid}.or.is_default.eq.true` naturally merges both sets.
- **Transactions FKs use `ON DELETE SET NULL`** on `account_id` and `category_id` to preserve historical records when an account or category is deleted.
- **Budget `spent` is trigger-maintained** for convenience. A background alternative is computing it in-app (the mock `dataService` already does this).
