FROM node:22-alpine
WORKDIR /app
# zero runtime dependencies — just the server, libs, public assets and prebuilt data
COPY server.js ./
COPY lib ./lib
COPY public ./public
COPY data ./data
ENV PORT=10091
EXPOSE 10091
CMD ["node", "server.js"]
