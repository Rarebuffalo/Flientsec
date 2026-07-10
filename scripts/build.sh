#!/usr/bin/env bash

# Compile build script for FlientSec Agent

set -e

# Move to the workspace script directory
CDPATH="" cd -- "$(dirname -- "$0")/.."

echo "Building FlientSec Go Agent..."
mkdir -p agent/bin

cd agent
go mod tidy
go build -o bin/flientsec-agent cmd/agent/main.go
cd ..

echo "Build successful! Binary created at agent/bin/flientsec-agent"
