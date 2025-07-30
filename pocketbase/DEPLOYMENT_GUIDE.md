# PocketBase Deployment Guide for Fly.io

This guide explains how to deploy your PocketBase application to Fly.io with persistent storage.

## Changes Made for Persistence

The following changes have been made to ensure your instance remains persistent:

1. `auto_stop_machines` changed from `'stop'` to `'off'` - Prevents the machine from stopping when idle
2. `min_machines_running` changed from `0` to `1` - Ensures at least one machine is always running

These changes ensure your application will remain active and responsive at all times.

## Prerequisites

1. Install the [Fly.io CLI](https://fly.io/docs/getting-started/installing-flyctl/)
2. Create a Fly.io account
3. Authenticate with `fly auth login`

## Deployment Steps

1. Navigate to the pocketbase directory:
   ```bash
   cd pocketbase
   ```

2. Deploy the application:
   ```bash
   fly deploy
   ```

3. If this is your first deployment, you may need to allocate storage:
   ```bash
   fly volumes create pocketbase_data --region iad --size 1
   ```

## Persistent Storage

The application uses a volume mount for persistent storage:
- Volume name: `pocketbase_data`
- Mount path: `/app/pb_data`
- Region: `iad` (Ashburn, Virginia)

All your data will be stored in this persistent volume, ensuring it survives restarts and redeployments.

## Managing Your Application

To check the status of your application:
```bash
fly status
```

To view application logs:
```bash
fly logs
```

To scale your application (optional):
```bash
fly scale count 1
```

## Cost Considerations

With persistence enabled, your application will consume resources continuously. Check Fly.io's pricing for details on how this affects your bill.

For more information, refer to the [Fly.io documentation](https://fly.io/docs/).