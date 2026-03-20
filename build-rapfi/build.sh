#!/bin/bash
# Build Rapfi engine compatible with RHEL 8 / AlmaLinux 8 (glibc 2.28)
# Uses Docker to compile, then extracts binaries and cleans up

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENGINE_DIR="$(dirname "$SCRIPT_DIR")/engine"
IMAGE_NAME="rapfi-builder"
CONTAINER_NAME="rapfi-build-temp"

echo "========================================"
echo "  Rapfi Engine Builder (glibc 2.28)"
echo "========================================"
echo ""
echo "Target: AlmaLinux 8 (RHEL 8 compatible)"
echo "Output: ${ENGINE_DIR}"
echo ""

# Step 1: Build Docker image
echo "[1/4] Building Docker image..."
docker build -t "${IMAGE_NAME}" "${SCRIPT_DIR}"

# Step 2: Create temporary container to extract binaries
echo "[2/4] Extracting binaries..."
docker create --name "${CONTAINER_NAME}" "${IMAGE_NAME}" /bin/true 2>/dev/null || {
    docker rm -f "${CONTAINER_NAME}" 2>/dev/null
    docker create --name "${CONTAINER_NAME}" "${IMAGE_NAME}" /bin/true
}

# Step 3: Copy binaries out
echo "[3/4] Copying to engine directory..."

# Backup old binaries
if [ -f "${ENGINE_DIR}/pbrain-rapfi-linux-clang-avx512" ]; then
    cp "${ENGINE_DIR}/pbrain-rapfi-linux-clang-avx512" \
       "${ENGINE_DIR}/pbrain-rapfi-linux-clang-avx512.old"
    echo "  Backed up old avx512 binary"
fi

if [ -f "${ENGINE_DIR}/pbrain-rapfi-linux-clang-avx2" ]; then
    cp "${ENGINE_DIR}/pbrain-rapfi-linux-clang-avx2" \
       "${ENGINE_DIR}/pbrain-rapfi-linux-clang-avx2.old"
    echo "  Backed up old avx2 binary"
fi

# Extract new binaries from builder stage
docker cp "${CONTAINER_NAME}:/build/Rapfi/Rapfi/build/pbrain-rapfi" \
    "${ENGINE_DIR}/pbrain-rapfi-linux-clang-avx512"
docker cp "${CONTAINER_NAME}:/build/Rapfi/Rapfi/build-avx2/pbrain-rapfi" \
    "${ENGINE_DIR}/pbrain-rapfi-linux-clang-avx2"

chmod +x "${ENGINE_DIR}/pbrain-rapfi-linux-clang-avx512"
chmod +x "${ENGINE_DIR}/pbrain-rapfi-linux-clang-avx2"

echo "  Copied pbrain-rapfi-linux-clang-avx512"
echo "  Copied pbrain-rapfi-linux-clang-avx2"

# Step 4: Cleanup Docker resources
echo "[4/4] Cleaning up Docker resources..."
docker rm -f "${CONTAINER_NAME}" 2>/dev/null
docker rmi -f "${IMAGE_NAME}" 2>/dev/null

echo ""
echo "========================================"
echo "  Build complete!"
echo "========================================"
echo ""
echo "New binaries:"
ls -lh "${ENGINE_DIR}/pbrain-rapfi-linux-clang-avx512" \
       "${ENGINE_DIR}/pbrain-rapfi-linux-clang-avx2" 2>/dev/null
echo ""
echo "To verify on your server, run:"
echo "  ldd ./pbrain-rapfi-linux-clang-avx512"
echo "  echo 'START 15' | ./pbrain-rapfi-linux-clang-avx512"
