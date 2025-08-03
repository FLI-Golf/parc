# Scale PocketBase Machine on Fly.io

## Current PocketBase App
- App Name: `pocketbase-app-1753896437`
- URL: https://pocketbase-production-7050.up.railway.app

## Check Current Machine Status

```bash
# Check current app status
fly status -a pocketbase-app-1753896437

# Check current machine scale
fly scale show -a pocketbase-app-1753896437

# List available VM sizes
fly platform vm-sizes
```

## Recommended Scaling Options

### Option 1: Basic Performance Upgrade (Recommended)
Scale to shared-cpu-2x with more memory:

```bash
# Scale to 2 vCPUs, 512MB base RAM
fly scale vm shared-cpu-2x -a pocketbase-app-1753896437

# Add more memory if needed (1GB total)
fly scale memory 1024 -a pocketbase-app-1753896437
```

### Option 2: Better Performance 
For heavier database usage:

```bash
# Scale to performance-1x (dedicated CPU)
fly scale vm performance-1x -a pocketbase-app-1753896437

# Scale memory to 2GB
fly scale memory 2048 -a pocketbase-app-1753896437
```

### Option 3: High Performance
For production workloads:

```bash
# Scale to performance-2x
fly scale vm performance-2x -a pocketbase-app-1753896437
# This gives 2 dedicated vCPUs + 4GB RAM
```

## Persistent Configuration (Optional)

Create/update your `fly.toml` to make scaling permanent:

```toml
# fly.toml
app = "pocketbase-app-1753896437"

[build]
  image = "pocketbase/pocketbase:latest"

[[vm]]
  size = "shared-cpu-2x"
  memory = "1gb"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true

[[http_service.checks]]
  interval = "10s"
  timeout = "5s"
  grace_period = "5s"
  method = "GET"
  path = "/api/health"
```

## Cost Comparison

- **shared-cpu-1x** (current): ~$2-3/month
- **shared-cpu-2x + 1GB**: ~$5-6/month  
- **performance-1x + 2GB**: ~$15-20/month
- **performance-2x**: ~$30-35/month

## Recommended Steps

1. **Check current status:**
   ```bash
   fly status -a pocketbase-app-1753896437
   fly scale show -a pocketbase-app-1753896437
   ```

2. **Scale to shared-cpu-2x (recommended first step):**
   ```bash
   fly scale vm shared-cpu-2x -a pocketbase-app-1753896437
   fly scale memory 1024 -a pocketbase-app-1753896437
   ```

3. **Monitor performance:**
   ```bash
   fly logs -a pocketbase-app-1753896437
   ```

4. **If still slow, upgrade to performance tier:**
   ```bash
   fly scale vm performance-1x -a pocketbase-app-1753896437
   ```

## Why Scale PocketBase?

- **Better response times** for API calls
- **Handle more concurrent users**
- **Faster database operations**
- **Improved reliability** under load

The shared-cpu-2x upgrade is usually sufficient for small to medium apps and doubles your CPU while staying cost-effective.
