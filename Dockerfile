FROM node:22-alpine
WORKDIR /app
# zero runtime dependencies — just the server, libs, public assets and prebuilt data
COPY server.js ./
COPY lib ./lib
COPY public ./public
COPY data ./data
# runtime-writable dir for the view counter (bind-mounted in compose so it survives rebuilds)
RUN mkdir -p /app/var
ENV PORT=10091
ENV VAR_DIR=/app/var
EXPOSE 10091
CMD ["node", "server.js"]
