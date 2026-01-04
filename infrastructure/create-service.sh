#!/bin/bash
# Create ECS Service Script
# Run this after setting up the cluster and task definition

set -e

REGION=${AWS_REGION:-us-east-1}
CLUSTER_NAME=${CLUSTER_NAME:-daemonfetch-cluster}
SERVICE_NAME=${SERVICE_NAME:-daemonfetch-worker}
TASK_DEFINITION=${TASK_DEFINITION:-daemonfetch-worker}
SUBNET_IDS=${SUBNET_IDS:-subnet-12345,subnet-67890}
SECURITY_GROUP_ID=${SECURITY_GROUP_ID:-sg-12345}

echo "🚀 Creating ECS service..."
echo "Cluster: $CLUSTER_NAME"
echo "Service: $SERVICE_NAME"
echo "Task Definition: $TASK_DEFINITION"

# Check if service already exists
if aws ecs describe-services --cluster ${CLUSTER_NAME} --services ${SERVICE_NAME} --region ${REGION} 2>/dev/null | grep -q ${SERVICE_NAME}; then
    echo "⚠️  Service already exists. Use update-service instead."
    exit 1
fi

echo ""
echo "Creating service with:"
echo "  Subnets: $SUBNET_IDS"
echo "  Security Group: $SECURITY_GROUP_ID"

aws ecs create-service \
    --cluster ${CLUSTER_NAME} \
    --service-name ${SERVICE_NAME} \
    --task-definition ${TASK_DEFINITION} \
    --desired-count 1 \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[${SUBNET_IDS}],securityGroups=[${SECURITY_GROUP_ID}],assignPublicIp=ENABLED}" \
    --region ${REGION}

echo ""
echo "✅ Service created!"
echo "Service: ${SERVICE_NAME}"
echo "Cluster: ${CLUSTER_NAME}"
