# PocketBase User Management Guide

This guide explains how to work with users in PocketBase using the filter syntax and operators.

## Available User Fields

Based on the sample collection schema, the following fields are available for users:

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| username | string | Username (if enabled) |
| email | string | Email address |
| emailVisibility | boolean | Email visibility setting |
| verified | boolean | Email verification status |
| created | date | Creation timestamp |
| updated | date | Last update timestamp |
| name | string | User's full name |
| avatar | file | Profile picture |
| role | select | User role (Manager, Server) |

## PocketBase Filter Syntax

PocketBase uses a SQL-like filter syntax for querying records. Here are the main operators:

### Comparison Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `=` | Equal | `name = "John"` |
| `!=` | Not equal | `role != "Manager"` |
| `>` | Greater than | `created > "2023-01-01"` |
| `>=` | Greater than or equal | `age >= 18` |
| `<` | Less than | `created < "2023-12-31"` |
| `<=` | Less than or equal | `age <= 65` |
| `~` | Contains (case sensitive) | `name ~ "John"` |
| `!~` | Not contains (case sensitive) | `name !~ "Admin"` |
| `?~` | Contains (case insensitive) | `name ?~ "john"` |
| `!?"~` | Not contains (case insensitive) | `name !?~ "admin"` |

### Logical Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `&&` | AND | `role = "Manager" && verified = true` |
| `||` | OR | `role = "Manager" || role = "Admin"` |

### Special Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `= ""` | Is empty | `name = ""` |
| `!= ""` | Is not empty | `name != ""` |
| `:isset` | Is set (not null) | `avatar:isset = true` |
| `:empty` | Is empty (null or "") | `avatar:empty = true` |

## Practical Examples

### Basic User Queries

1. Get all users:
   ```
   (no filter)
   ```

2. Get a specific user by ID:
   ```
   id = "RECORD_ID"
   ```

3. Get users by email:
   ```
   email = "user@example.com"
   ```

4. Get users with a specific name:
   ```
   name = "John Doe"
   ```

5. Get users with names containing "John" (case sensitive):
   ```
   name ~ "John"
   ```

6. Get users with names containing "john" (case insensitive):
   ```
   name ?~ "john"
   ```

### Role-Based Queries

1. Get all managers:
   ```
   role = "Manager"
   ```

2. Get all servers:
   ```
   role = "Server"
   ```

3. Get users with either Manager or Server role:
   ```
   role = "Manager" || role = "Server"
   ```

4. Get verified managers:
   ```
   role = "Manager" && verified = true
   ```

### Date-Based Queries

1. Get users created after a specific date:
   ```
   created > "2023-01-01 00:00:00"
   ```

2. Get users updated in the last 30 days:
   ```
   updated > "2023-04-01 00:00:00"
   ```

### Advanced Queries

1. Get users with avatars:
   ```
   avatar != ""
   ```

2. Get users without avatars:
   ```
   avatar = ""
   ```

3. Get users with public email visibility:
   ```
   emailVisibility = true
   ```

4. Get verified users with names:
   ```
   verified = true && name != ""
   ```

5. Get managers created in the last year:
   ```
   role = "Manager" && created > "2022-01-01"
   ```

## Implementation Examples

### JavaScript/TypeScript Usage

```javascript
import PocketBase from 'pocketbase';

const pb = new PocketBase('https://your-pocketbase-url.com');

// Get all users
const allUsers = await pb.collection('users').getFullList();

// Get users with a filter
const managers = await pb.collection('users').getFullList({
  filter: 'role = "Manager"'
});

// Get a single user by ID
const user = await pb.collection('users').getOne('RECORD_ID');

// Get users with complex filter
const recentManagers = await pb.collection('users').getList(1, 30, {
  filter: 'role = "Manager" && created > "2023-01-01"',
  sort: '-created'
});
```

### Svelte Implementation

```svelte
<script>
  import PocketBase from 'pocketbase';
  
  const pb = new PocketBase('https://your-pocketbase-url.com');
  
  let users = [];
  let loading = true;
  
  async function loadManagers() {
    try {
      const result = await pb.collection('users').getFullList({
        filter: 'role = "Manager"',
        sort: '-created'
      });
      users = result;
    } catch (error) {
      console.error('Error loading managers:', error);
    } finally {
      loading = false;
    }
  }
</script>
```

## Authentication Context

In authenticated requests, you can use special filter variables:

| Variable | Description |
|----------|-------------|
| `@request.auth.id` | Current authenticated user ID |
| `@request.auth.role` | Current authenticated user role |

Example filters using authentication context:

1. Get only the current user's record:
   ```
   id = @request.auth.id
   ```

2. Get all users except the current user:
   ```
   id != @request.auth.id
   ```

3. Get users with the same role as the current user:
   ```
   role = @request.auth.role
   ```

## Best Practices

1. **Always validate filters**: Ensure filters are properly escaped to prevent injection attacks.

2. **Use indexes**: For frequently queried fields, create database indexes in PocketBase.

3. **Limit results**: When querying large datasets, use pagination:
   ```javascript
   const page = await pb.collection('users').getList(1, 50, {
     filter: 'role = "Manager"'
   });
   ```

4. **Handle errors gracefully**: Always wrap filter queries in try/catch blocks.

5. **Use appropriate filter operators**: Choose the most specific operator for your use case to improve performance.

## Role-Based Access Control

Implementing RBAC in your application:

```javascript
// Check if user is a manager
function isManager(user) {
  return user.role === 'Manager';
}

// Check if user is a server
function isServer(user) {
  return user.role === 'Server';
}

// Get users based on current user's role
async function getUsersForCurrentUser(currentUser) {
  if (isManager(currentUser)) {
    // Managers can see all users
    return await pb.collection('users').getFullList();
  } else {
    // Servers can only see themselves
    return [currentUser];
  }
}
```

This guide provides a comprehensive overview of working with users in PocketBase using filter syntax. For more detailed information, refer to the [PocketBase documentation](https://pocketbase.io/docs/).