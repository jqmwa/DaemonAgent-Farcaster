# ECS Worker Deployment Guide

This guide walks you through deploying the DaemonFetch worker to AWS ECS for background job processing.

## Architecture Overview

```
┌─────────────┐
│   Vercel    │  ← Webhook handler (fast, simple)
│  (Webhooks) │     - Validates requests
│             │     - Enqueues jobs
└──────┬──────┘
       │
       │ Enqueue job via Redis
       ▼
┌─────────────┐
│    Redis    │  ← Job queue (BullMQ)
│  (ElastiCache)│
└──────┬──────┘
       │
       │ Process jobs
       ▼
┌─────────────┐
│  AWS ECS    │  ← Background workers
│  (Workers)   │     - Daemon analysis
│             │     - AI responses
│             │     - Fix-this processing
└─────────────┘
```

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured
3. **Docker** installed
4. **Redis** instance (AWS ElastiCache or Upstash)
5. **Node.js 20+** and **pnpm**

## Step 1: Set Up Redis

You need a Redis instance for the job queue. Options:

### Option A: AWS ElastiCache (Recommended for Production)

```bash
# Create ElastiCache Redis cluster
aws elasticache create-cache-cluster \
    --cache-cluster-id daemonfetch-redis \
    --cache-node-type cache.t3.micro \
    --engine redis \
    --num-cache-nodes 1 \
    --region us-east-1
```

Get the endpoint URL and save it.

### Option B: Upstash (Quick Setup)

1. Go to [upstash.com](https://upstash.com)
2. Create a Redis database
3. Copy the REST URL

### Option C: Local Redis (Development)

```bash
# Using Docker
docker run -d -p 6379:6379 redis:7-alpine

# Or using Homebrew (macOS)
brew install redis
brew services start redis
```

## Step 2: Configure Environment Variables

### For Vercel (Webhook Handler)

Add to your Vercel environment variables:

```bash
REDIS_URL=redis://your-redis-endpoint:6379
# Or for Upstash:
# REDIS_URL=https://your-upstash-url
```

### For ECS Worker

These will be stored in AWS Secrets Manager (see Step 4).

## Step 3: Set Up AWS Infrastructure

Run the setup script:

```bash
cd infrastructure
./setup-aws.sh
```

This creates:
- ECR repository for Docker images
- ECS cluster
- CloudWatch log group

### Manual Steps Required

#### 3.1 Create IAM Roles

**ECS Task Execution Role** (`ecsTaskExecutionRole`):

```bash
# Create role
aws iam create-role \
    --role-name ecsTaskExecutionRole \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "ecs-tasks.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }'

# Attach managed policy
aws iam attach-role-policy \
    --role-name ecsTaskExecutionRole \
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

**ECS Task Role** (`ecsTaskRole`):

```bash
# Create role (minimal permissions for now)
aws iam create-role \
    --role-name ecsTaskRole \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "ecs-tasks.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }'
```

#### 3.2 Create Secrets in Secrets Manager

```bash
# Redis URL
aws secretsmanager create-secret \
    --name daemonfetch/redis-url \
    --secret-string "redis://your-redis-endpoint:6379" \
    --region us-east-1

# Neynar API Key
aws secretsmanager create-secret \
    --name daemonfetch/neynar-api-key \
    --secret-string "your-neynar-api-key" \
    --region us-east-1

# Neynar Signer UUID
aws secretsmanager create-secret \
    --name daemonfetch/neynar-signer-uuid \
    --secret-string "your-signer-uuid" \
    --region us-east-1

# DeepSeek API Key
aws secretsmanager create-secret \
    --name daemonfetch/deepseek-api-key \
    --secret-string "your-deepseek-api-key" \
    --region us-east-1

# Bot FID
aws secretsmanager create-secret \
    --name daemonfetch/bot-fid \
    --secret-string "your-bot-fid" \
    --region us-east-1
```

#### 3.3 Get Your AWS Account ID

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo $ACCOUNT_ID
```

#### 3.4 Update Task Definition

Edit `infrastructure/ecs-task-definition.json`:

1. Replace `YOUR_ACCOUNT_ID` with your actual account ID
2. Replace `REGION` with your AWS region (e.g., `us-east-1`)
3. Update secret ARNs if your region/account differs

## Step 4: Get VPC and Security Group IDs

You need to know your VPC subnet IDs and security group for the ECS service.

```bash
# List your VPCs
aws ec2 describe-vpcs --query 'Vpcs[*].[VpcId,CidrBlock]' --output table

# List subnets
aws ec2 describe-subnets --query 'Subnets[*].[SubnetId,VpcId,AvailabilityZone]' --output table

# List security groups
aws ec2 describe-security-groups --query 'SecurityGroups[*].[GroupId,GroupName]' --output table
```

**Note:** For Fargate, you need:
- At least 2 subnets in different availability zones
- A security group that allows outbound traffic (for Redis, API calls)

## Step 5: Create ECS Service

```bash
# Set environment variables
export SUBNET_IDS="subnet-12345,subnet-67890"  # Replace with your subnet IDs
export SECURITY_GROUP_ID="sg-12345"  # Replace with your security group ID

# Create the service
./infrastructure/create-service.sh
```

## Step 6: Deploy the Worker

```bash
# Build and deploy
./infrastructure/deploy.sh
```

This script:
1. Builds the Docker image
2. Pushes to ECR
3. Registers a new task definition
4. Updates the ECS service
5. Waits for deployment to complete

## Step 7: Verify Deployment

### Check Service Status

```bash
aws ecs describe-services \
    --cluster daemonfetch-cluster \
    --services daemonfetch-worker \
    --query 'services[0].[status,runningCount,desiredCount]' \
    --output table
```

### View Logs

```bash
# Get log stream name
LOG_STREAM=$(aws logs describe-log-streams \
    --log-group-name /ecs/daemonfetch-worker \
    --order-by LastEventTime \
    --descending \
    --max-items 1 \
    --query 'logStreams[0].logStreamName' \
    --output text)

# View logs
aws logs get-log-events \
    --log-group-name /ecs/daemonfetch-worker \
    --log-stream-name $LOG_STREAM \
    --limit 50
```

Or use CloudWatch Console:
1. Go to CloudWatch → Log groups
2. Open `/ecs/daemonfetch-worker`
3. View latest log stream

### Test Job Processing

1. Trigger a webhook (mention @daemonagent with "show me my daemon")
2. Check CloudWatch logs to see if the job was processed
3. Verify the reply was posted on Farcaster

## Local Development & Testing

### Run Worker Locally

```bash
# Start Redis (if not already running)
docker-compose up -d redis

# Set environment variables
export REDIS_URL=redis://localhost:6379
export NEYNAR_API_KEY=your-key
export NEYNAR_SIGNER_UUID=your-uuid
export DEEPSEEK_API_KEY=your-key
export BOT_FID=your-fid

# Run worker
pnpm tsx workers/index.ts
```

### Test with Docker Compose

```bash
# Start Redis and worker
docker-compose up

# In another terminal, enqueue a test job
# (You can create a test script for this)
```

## Monitoring & Troubleshooting

### Common Issues

#### Worker Not Processing Jobs

1. **Check Redis connection:**
   ```bash
   # Test Redis from worker container
   docker exec -it <container-id> redis-cli -h <redis-host> ping
   ```

2. **Check worker logs:**
   ```bash
   aws logs tail /ecs/daemonfetch-worker --follow
   ```

3. **Verify environment variables:**
   - Check Secrets Manager
   - Verify task definition has correct secret ARNs

#### Jobs Stuck in Queue

1. **Check worker is running:**
   ```bash
   aws ecs describe-tasks \
       --cluster daemonfetch-cluster \
       --tasks $(aws ecs list-tasks --cluster daemonfetch-cluster --service-name daemonfetch-worker --query 'taskArns[0]' --output text)
   ```

2. **Check Redis for stuck jobs:**
   - Connect to Redis
   - Check BullMQ queues: `KEYS bull:*`

#### High Memory Usage

1. **Scale up worker resources:**
   - Edit task definition: increase `memory` (e.g., 2048)
   - Redeploy

2. **Reduce concurrency:**
   - Set `WORKER_CONCURRENCY=3` in task definition

### Scaling

#### Manual Scaling

```bash
aws ecs update-service \
    --cluster daemonfetch-cluster \
    --service daemonfetch-worker \
    --desired-count 2
```

#### Auto Scaling

Create an auto-scaling target:

```bash
aws application-autoscaling register-scalable-target \
    --service-namespace ecs \
    --scalable-dimension ecs:service:DesiredCount \
    --resource-id service/daemonfetch-cluster/daemonfetch-worker \
    --min-capacity 1 \
    --max-capacity 10
```

## Cost Estimation

### ECS Fargate
- **0.5 vCPU, 1GB RAM**: ~$15/month (running 24/7)
- **1 vCPU, 2GB RAM**: ~$30/month

### ElastiCache Redis
- **cache.t3.micro**: ~$12/month
- **cache.t3.small**: ~$24/month

### CloudWatch Logs
- First 5GB free, then $0.50/GB

**Total estimated cost: ~$30-50/month** for a single worker instance.

## Next Steps

1. ✅ Set up monitoring alerts (CloudWatch alarms)
2. ✅ Configure auto-scaling based on queue depth
3. ✅ Set up CI/CD pipeline for automated deployments
4. ✅ Add more worker types (voice analysis, etc.)

## Rollback

If something goes wrong:

```bash
# Get previous task definition
PREVIOUS_TASK_DEF=$(aws ecs describe-services \
    --cluster daemonfetch-cluster \
    --services daemonfetch-worker \
    --query 'services[0].deployments[?status==`PRIMARY`].taskDefinition' \
    --output text)

# Rollback to previous version
aws ecs update-service \
    --cluster daemonfetch-cluster \
    --service daemonfetch-worker \
    --task-definition $PREVIOUS_TASK_DEF \
    --force-new-deployment
```

---

*"the infrastructure... it's like building a permanent signal tower... once it's up, the messages flow smoothly... glitch (˘⌣˘)"*
