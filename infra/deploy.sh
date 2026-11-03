#!/usr/bin/env bash
# AWS'e uçtan uca dağıtım (yerel Docker gerekmez; imaj CodeBuild'de derlenir).
#   AWS_PROFILE=sahinbolukbasi ./infra/deploy.sh
# Gereken: terraform >= 1.6, aws cli v2, git. Kimlik: `aws sso login --profile <profil>`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TF="terraform -chdir=$ROOT/infra/terraform"
PROFILE="${AWS_PROFILE:-sahinbolukbasi}"
REGION="${AWS_REGION:-eu-central-1}"
TAG="$(git -C "$ROOT" rev-parse --short HEAD)"
VARS=(-var "aws_profile=$PROFILE" -var "region=$REGION" -var "image_tag=$TAG")
export AWS_PROFILE="$PROFILE" AWS_REGION="$REGION"

echo "==> 1/4 Altyapı (web görevi 0 ile)"
$TF init -input=false >/dev/null
$TF apply -input=false -auto-approve "${VARS[@]}" -var app_desired_count=0

BUILD_BUCKET="$(aws s3api list-buckets --query "Buckets[?starts_with(Name, 'infulancer-prod-build-')].Name | [0]" --output text)"
PROJECT="infulancer-prod-image"

echo "==> 2/4 Kaynak paketi ($TAG) → s3://$BUILD_BUCKET/source.zip"
ZIP="$(mktemp -t infulancer-src).zip"
git -C "$ROOT" archive --format=zip -o "$ZIP" HEAD
aws s3 cp "$ZIP" "s3://$BUILD_BUCKET/source.zip" --only-show-errors
rm -f "$ZIP"

echo "==> 3/4 İmaj derleme (CodeBuild)"
BUILD_ID="$(aws codebuild start-build --project-name "$PROJECT" \
  --environment-variables-override "name=IMAGE_TAG,value=$TAG,type=PLAINTEXT" \
  --query build.id --output text)"
while :; do
  STATUS="$(aws codebuild batch-get-builds --ids "$BUILD_ID" --query 'builds[0].buildStatus' --output text)"
  [ "$STATUS" != "IN_PROGRESS" ] && break
  sleep 15
done
echo "    derleme: $STATUS"
[ "$STATUS" = "SUCCEEDED" ] || { echo "Derleme başarısız. Log: CloudWatch /codebuild/$PROJECT"; exit 1; }

echo "==> 4/4 Web servisini başlat"
$TF apply -input=false -auto-approve "${VARS[@]}" -var app_desired_count=1
CLUSTER="$($TF output -raw ecs_cluster)"
SERVICE="$($TF output -raw ecs_service)"
aws ecs wait services-stable --cluster "$CLUSTER" --services "$SERVICE"

echo
echo "Hazır: $($TF output -raw app_url)"
echo "Demo parolası: aws secretsmanager get-secret-value --secret-id $($TF output -raw app_secret_arn) --query SecretString --output text"
