# Web de la oficina (Next.js). Se construye desde la raíz del monorepo: necesita packages/.
FROM node:24-slim AS construir
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY web/package.json web/
COPY packages/ packages/
# Solo la web y sus paquetes internos: nada de la app Android.
RUN npm ci --workspace web --include-workspace-root --ignore-scripts
COPY web/ web/
RUN npm run build --workspace web

FROM node:24-slim
WORKDIR /repo
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=construir /repo /repo
USER node
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "web", "--", "--port", "3000", "--hostname", "0.0.0.0"]
