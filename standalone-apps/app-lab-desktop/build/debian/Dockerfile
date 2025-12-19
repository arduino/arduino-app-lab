FROM golang:1.25 AS go

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
	npm 

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
COPY --from=go /app/standalone-apps/app-lab-desktop/build/bin/${BINARY_NAME} /${DEB_NAME}/usr/bin/${BINARY_NAME}

# # Go application are tagged with `v` prefix, this remove the first v if present
RUN export VERSION=$(echo "${VERSION}" | sed -e "s/^v\(.*\)/\1/") && \
  sed -i "s/\$ARCH/${ARCH}/" /${DEB_NAME}/DEBIAN/control && \
  sed -i "s/\$VERSION/${VERSION}/" /${DEB_NAME}/DEBIAN/control && \
  sed -i "s/\$VERSION/${VERSION}/" /${DEB_NAME}/usr/share/applications/ArduinoAppLab.desktop && \
  sed -i "s/\$BINARY_PATH/\/usr\/bin\/${BINARY_NAME}/" /${DEB_NAME}/usr/share/applications/ArduinoAppLab.desktop && \
  sed -i "s/\$BINARY_PATH/\/usr\/bin\/${BINARY_NAME}/" /${DEB_NAME}/etc/xdg/autostart/ArduinoAppLab.desktop && \
  dpkg-deb --build --root-owner-group /${DEB_NAME} && \
  mv /${DEB_NAME}.deb "/${DEB_NAME}_${VERSION}-${REVISION}_${ARCH}.deb"

FROM scratch

COPY --from=debian /*.deb /

