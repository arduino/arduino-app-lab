FROM golang:1.26.1 AS go

ARG BINARY_NAME
RUN test -n "${BINARY_NAME}" || (echo "Error: BINARY_NAME is not set" && exit 1)
ARG VERSION
RUN test -n "${VERSION}" || (echo "Error: VERSION is not set" && exit 1)
ARG REVISION="1"
ARG ARCH
RUN test -n "${ARCH}" || (echo "Error: ARCH is not set" && exit 1)

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
	build-essential \
	libgtk-3-dev \
	libwebkit2gtk-4.1-dev \
	ca-certificates \
	curl \
	xz-utils

# Install a pinned Node.js version so the frontend build behaves consistently
# with the other platform builds. Node 18 does not enable require(ESM), which
# avoids the ERR_REQUIRE_CYCLE_MODULE failure that newer Node versions hit when
# Vite loads its config through @vitejs/plugin-react.
ENV NODE_VERSION=18.15.0
RUN curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-arm64.tar.xz" -o /tmp/node.tar.xz && \
    tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 && \
    rm /tmp/node.tar.xz && \
    node --version && npm --version

RUN go install github.com/wailsapp/wails/v2/cmd/wails@latest
RUN npm install -g yarn

COPY . /app
WORKDIR /app
RUN --mount=type=secret,id=npm_token_id \
  export NPM_TOKEN=$(cat /run/secrets/npm_token_id) \
  && echo "NPM_TOKEN=${NPM_TOKEN}" > .env \
  && yarn install --immutable 

WORKDIR /app/standalone-apps/app-lab-desktop
ENV GOOS=linux
ENV GOARCH=arm64
ENV CGO_ENABLED=1
RUN --mount=type=secret,id=npm_token_id \
  export NPM_TOKEN=$(cat /run/secrets/npm_token_id) \
  && git config --global url."https://${NPM_TOKEN}:x-oauth-basic@github.com/bcmi-labs".insteadOf "https://github.com/bcmi-labs" \
  && wails build --devtools --platform linux/${ARCH} -tags webkit2_41 -webview2 download -o ${BINARY_NAME} -ldflags="-X 'main.version=${VERSION}'"

FROM debian:bookworm AS debian

ARG VERSION
RUN test -n "${VERSION}" || (echo "Error: VERSION is not set" && exit 1)
ARG ARCH
RUN test -n "${ARCH}" || (echo "Error: ARCH is not set" && exit 1)
ARG DEB_NAME
RUN test -n "${DEB_NAME}" || (echo "Error: DEB_NAME is not set" && exit 1)
ARG BINARY_NAME
RUN test -n "${BINARY_NAME}" || (echo "Error: BINARY_NAME is not set" && exit 1)
ARG REVISION="1"

RUN apt-get update && apt-get install -y sed

COPY ./standalone-apps/app-lab-desktop/build/debian/${DEB_NAME} /${DEB_NAME}/
# The copyright file is assembled by dev-utils/al-license/licensed.sh and
# gitignored, so a plain COPY of the tree happily omits it. Refuse to build a
# .deb without it: Debian policy requires the file, and local builds go
# straight onto boards via `yarn install:arduino-app-lab:deb`.
RUN test -s /${DEB_NAME}/usr/share/doc/arduino-app-lab/copyright \
  || (echo "copyright missing - run: yarn build-copyright:arduino-app-lab-desktop" && exit 1)
COPY --from=go /app/standalone-apps/app-lab-desktop/build/bin/${BINARY_NAME} /${DEB_NAME}/usr/bin/${BINARY_NAME}
COPY --from=go /app/standalone-apps/app-lab-desktop/internal/app/ArduinoAppLab.desktop /${DEB_NAME}/usr/share/applications/ArduinoAppLab.desktop

# # Go application are tagged with `v` prefix, this remove the first v if present
RUN export VERSION=$(echo "${VERSION}" | sed -e "s/^v\(.*\)/\1/") && \
  sed -i "s/\$ARCH/${ARCH}/" /${DEB_NAME}/DEBIAN/control && \
  sed -i "s/\$VERSION/${VERSION}/" /${DEB_NAME}/DEBIAN/control && \
  sed -i "s/\$VERSION/${VERSION}/" /${DEB_NAME}/usr/share/applications/ArduinoAppLab.desktop && \
  sed -i "s/\$BINARY_PATH/\/usr\/bin\/${BINARY_NAME}/" /${DEB_NAME}/usr/share/applications/ArduinoAppLab.desktop && \
  sed -i "s/\$WM_CLASS/${BINARY_NAME}/" /${DEB_NAME}/usr/share/applications/ArduinoAppLab.desktop && \
  sed -i "s/\$ICON/arduino-app-lab/" /${DEB_NAME}/usr/share/applications/ArduinoAppLab.desktop && \
  cp /${DEB_NAME}/usr/share/applications/ArduinoAppLab.desktop /${DEB_NAME}/etc/xdg/autostart/ArduinoAppLab.desktop && \
  dpkg-deb --build --root-owner-group /${DEB_NAME} && \
  mv /${DEB_NAME}.deb "/${DEB_NAME}_${VERSION}-${REVISION}_${ARCH}.deb"

FROM scratch

COPY --from=debian /*.deb /

