# Quick Start: ECS Worker Deployment

Quick reference for deploying the ECS worker.

## Prerequisites Checklist

- [ ] AWS account with CLI configured
- [ ] Docker installed
- [ ] Redis instance (ElastiCache, Upstash, or local)
- [ ] Environment variables ready

## 5-Minute Setup

### 1. Set Up Redis

**Option A: Upstash (Fastest)**
1. Create account at upstash.com
2. Create Redis database
3. Copy REST URL → `REDIS_URL`

**Option B: Local (Testing)**
```bash
docker run -d -p 6379:6379 redis:7-alpine
export REDIS_URL=redis://localhost:6379
```

### 2. Configure Vercel

Add to Vercel environment variables:
```
REDIS_URL=your-redis-url
```

### 3. Set Up AWS (One-Time)

```bash
# Run setup script
cd infrastructure
./setup-aws.sh

# Create IAM roles (see ECS_DEPLOYMENT.md)
# Create secrets in Secrets Manager (see ECS_DEPLOYMENT.md)
```

### 4. Deploy

```bash
# Update task definition with your ARNs
# Edit infrastructure/ecs-task-definition.json

# Create service
export SUBNET_IDS="subnet-xxx,subnet-yyy"
export SECURITY_GROUP_ID="sg-xxx"
./infrastructure/create-service.sh

# Deploy
./infrastructure/deploy.sh
```

### 5. Verify

```bash
# Check service status
aws ecs describe-services \
    --cluster daemonfetch-cluster \
    --services daemonfetch-worker

# View logs
aws logs tail /ecs/daemonfetch-worker --follow
```

## Test It

1. Mention @daemonagent with "show me my daemon"
2. Check CloudWatch logs for job processing
3. Verify reply appears on Farcaster

## Common Commands

```bash
# View logs
aws logs tail /ecs/daemonfetch-worker --follow

# Scale workers
aws ecs update-service \
    --cluster daemonfetch-cluster \
    --service daemonfetch-worker \
    --desired-count 2

# Restart service
aws ecs update-service \
    --cluster daemonfetch-cluster \
    --service daemonfetch-worker \
    --force-new-deployment
```

## Troubleshooting

**Worker not starting?**
- Check IAM roles exist
- Verify secrets in Secrets Manager
- Check CloudWatch logs

**Jobs not processing?**
- Verify Redis connection
- Check worker logs
- Ensure worker container is running

**Need help?**
See full guide: `docs/ECS_DEPLOYMENT.md`
