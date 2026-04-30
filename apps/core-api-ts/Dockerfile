FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN corepack enable && pnpm install --no-frozen-lockfile

COPY . .
RUN pnpm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
