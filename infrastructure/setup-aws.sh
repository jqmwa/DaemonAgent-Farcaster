#!/bin/bash
# AWS Infrastructure Setup Script
# This script sets up the basic AWS infrastructure needed for ECS deployment
# Run this once before your first deployment

set -e

REGION=${AWS_REGION:-us-east-1}
CLUSTER_NAME=${CLUSTER_NAME:-daemonfetch-cluster}
ECR_REPO=${ECR_REPO:-daemonfetch-worker}

echo "🏗️  Setting up AWS infrastructure for DaemonFetch..."
echo "Region: $REGION"
echo "Cluster: $CLUSTER_NAME"
echo "ECR Repo: $ECR_REPO"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi

# Get AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "Account ID: $ACCOUNT_ID"

echo ""
echo "📦 Step 1: Creating ECR repository..."
aws ecr create-repository \
    --repository-name ${ECR_REPO} \
    --region ${REGION} \
    --image-scanning-configuration scanOnPush=true \
    2>/dev/null || echo "Repository already exists"

echo ""
echo "🏗️  Step 2: Creating ECS cluster..."
aws ecs create-cluster \
    --cluster-name ${CLUSTER_NAME} \
    --region ${REGION} \
    2>/dev/null || echo "Cluster already exists"

echo ""
echo "📋 Step 3: Creating CloudWatch log group..."
aws logs create-log-group \
    --log-group-name /ecs/daemonfetch-worker \
    --region ${REGION} \
    2>/dev/null || echo "Log group already exists"

echo ""
echo "🔐 Step 4: Setting up IAM roles..."
echo "⚠️  Note: You'll need to create IAM roles manually or use Terraform/CloudFormation"
echo ""
echo "Required IAM roles:"
echo "1. ECS Task Execution Role (ecsTaskExecutionRole)"
echo "   - Permissions: ECR pull, CloudWatch logs, Secrets Manager"
echo ""
echo "2. ECS Task Role (ecsTaskRole)"
echo "   - Permissions: Any AWS services your worker needs to access"
echo ""
echo "You can create these using:"
echo "  aws iam create-role --role-name ecsTaskExecutionRole ..."
echo "  aws iam create-role --role-name ecsTaskRole ..."

echo ""
echo "💾 Step 5: Setting up Secrets Manager..."
echo "⚠️  Note: You'll need to create secrets manually"
echo ""
echo "Required secrets (create in AWS Secrets Manager):"
echo "1. daemonfetch/redis-url"
echo "2. daemonfetch/neynar-api-key"
echo "3. daemonfetch/neynar-signer-uuid"
echo "4. daemonfetch/deepseek-api-key"
echo "5. daemonfetch/bot-fid"
echo ""
echo "Create secrets using:"
echo "  aws secretsmanager create-secret --name daemonfetch/redis-url --secret-string 'redis://...'"

echo ""
echo "✅ Basic infrastructure setup complete!"
echo ""
echo "Next steps:"
echo "1. Create IAM roles (see above)"
echo "2. Create secrets in Secrets Manager (see above)"
echo "3. Update infrastructure/ecs-task-definition.json with your ARNs"
echo "4. Create ECS service (see infrastructure/create-service.sh)"
echo "5. Deploy: ./infrastructure/deploy.sh"
