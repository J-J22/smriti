# Smriti is a no-build-step static PWA, so this is a single-stage copy into nginx.
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

WORKDIR /usr/share/nginx/html
COPY index.html manifest.json sw.js ./
COPY css/ ./css/
COPY js/ ./js/
COPY content/ ./content/
COPY assets/ ./assets/

EXPOSE 80
