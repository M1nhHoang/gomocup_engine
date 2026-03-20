FROM almalinux:8 AS builder

# Install build dependencies
RUN dnf install -y epel-release && \
    /usr/bin/crb enable && \
    dnf install -y \
      gcc-toolset-12-gcc-c++ \
      clang \
      cmake \
      git \
      make \
      libatomic \
      libstdc++-static \
      gcc-toolset-12-libatomic-devel \
    && dnf clean all

# Use GCC 12 toolchain (better library compatibility on RHEL 8)
ENV PATH="/opt/rh/gcc-toolset-12/root/usr/bin:${PATH}"
ENV LD_LIBRARY_PATH="/opt/rh/gcc-toolset-12/root/usr/lib64"

WORKDIR /build

# Clone Rapfi source
RUN git clone --depth 1 https://github.com/dhbloo/Rapfi.git

# Build AVX-512 version using GCC 12 (for best glibc 2.28 compat)
WORKDIR /build/Rapfi/Rapfi
RUN mkdir -p build && cd build && \
    cmake .. \
      -DCMAKE_BUILD_TYPE=Release \
      -DCMAKE_C_COMPILER=gcc \
      -DCMAKE_CXX_COMPILER=g++ \
      -DUSE_SSE=ON \
      -DUSE_AVX2=ON \
      -DUSE_AVX512=ON \
      -DENABLE_LTO=ON \
      -DCMAKE_EXE_LINKER_FLAGS="-static-libgcc -static-libstdc++" \
    && make -j$(nproc) && \
    strip pbrain-rapfi && \
    echo "=== AVX512 BUILD SUCCESS ===" && \
    ldd pbrain-rapfi && \
    ls -lh pbrain-rapfi

# Also build AVX2 version as fallback
RUN mkdir -p /build/Rapfi/Rapfi/build-avx2 && \
    cd /build/Rapfi/Rapfi/build-avx2 && \
    cmake .. \
      -DCMAKE_BUILD_TYPE=Release \
      -DCMAKE_C_COMPILER=gcc \
      -DCMAKE_CXX_COMPILER=g++ \
      -DUSE_SSE=ON \
      -DUSE_AVX2=ON \
      -DUSE_AVX512=OFF \
      -DENABLE_LTO=ON \
      -DCMAKE_EXE_LINKER_FLAGS="-static-libgcc -static-libstdc++" \
    && make -j$(nproc) && \
    strip pbrain-rapfi && \
    echo "=== AVX2 BUILD SUCCESS ===" && \
    ldd pbrain-rapfi && \
    ls -lh pbrain-rapfi

# Copy binaries to output directory
RUN mkdir -p /output && \
    cp /build/Rapfi/Rapfi/build/pbrain-rapfi /output/pbrain-rapfi-linux-avx512 && \
    cp /build/Rapfi/Rapfi/build-avx2/pbrain-rapfi /output/pbrain-rapfi-linux-avx2 && \
    chmod +x /output/pbrain-rapfi-linux-*
