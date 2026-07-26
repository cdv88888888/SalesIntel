#!/bin/bash
echo "Starting deployment retry loop..."
for i in {1..10}; do
  npx -y firebase-tools@latest deploy --only hosting --project sales-intel-cdv-2026
  if [ $? -eq 0 ]; then
    echo "Deployment successful!"
    exit 0
  fi
  echo "Deployment locked (409) or failed. Retrying in 60 seconds..."
  sleep 60
done
echo "Deployment failed after 10 retries."
