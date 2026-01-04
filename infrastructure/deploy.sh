#!/bin/bash
# Deployment script for ECS worker
# Usage: ./infrastructure/deploy.sh [environment]

set -e

ENVIRONMENT=${1:-production}
REGION=${AWS_REGION:-us-east-1}
ECR_REPO=${ECR_REPO:-daemonfetch-worker}
CLUSTER_NAME=${CLUSTER_NAME:-daemonfetch-cluster}
SERVICE_NAME=${SERVICE_NAME:-daemonfetch-worker}

echo "🚀 Deploying DaemonFetch worker to ECS..."
echo "Environment: $ENVIRONMENT"
echo "Region: $REGION"
echo "ECR Repo: $ECR_REPO"
echo "Cluster: $CLUSTER_NAME"
echo "Service: $SERVICE_NAME"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install it first."
    exit 1
fi

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}"

echo ""
echo "📦 Step 1: Building Docker image..."
docker build -f Dockerfile.worker -t ${ECR_REPO}:latest .
docker tag ${ECR_REPO}:latest ${ECR_URI}:latest

echo ""
echo "📤 Step 2: Pushing to ECR..."
# Login to ECR
aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ECR_URI}

# Create ECR repo if it doesn't exist
aws ecr describe-repositories --repository-names ${ECR_REPO} --region ${REGION} 2>/dev/null || \
    aws ecr create-repository --repository-name ${ECR_REPO} --region ${REGION}

# Push image
docker push ${ECR_URI}:latest

echo ""
echo "📝 Step 3: Updating ECS task definition..."
# Update task definition with new image
TASK_DEF=$(cat infrastructure/ecs-task-definition.json | \
    sed "s|YOUR_ECR_REPO_URI|${ECR_URI}|g" | \
    sed "s|YOUR_ACCOUNT_ID|${ACCOUNT_ID}|g" | \
    sed "s|REGION|${REGION}|g")

# Register new task definition
TASK_DEF_ARN=$(echo "$TASK_DEF" | aws ecs register-task-definition --cli-input-json file:///dev/stdin --region ${REGION} --query 'taskDefinition.taskDefinitionArn' --output text)

echo "✅ Task definition registered: $TASK_DEF_ARN"

echo ""
echo "🔄 Step 4: Updating ECS service..."
# Update service with new task definition
aws ecs update-service \
    --cluster ${CLUSTER_NAME} \
    --service ${SERVICE_NAME} \
    --task-definition ${TASK_DEF_ARN} \
    --force-new-deployment \
    --region ${REGION} > /dev/null

echo "✅ Service update initiated"

echo ""
echo "⏳ Step 5: Waiting for service to stabilize..."
aws ecs wait services-stable \
    --cluster ${CLUSTER_NAME} \
    --services ${SERVICE_NAME} \
    --region ${REGION}

echo ""
echo "✅ Deployment complete!"
echo "Service: ${SERVICE_NAME}"
echo "Cluster: ${CLUSTER_NAME}"
echo "Task Definition: ${TASK_DEF_ARN}"
