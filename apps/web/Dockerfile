FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN corepack enable && pnpm install
COPY . .
EXPOSE 3000
ENV NEXT_TELEMETRY_DISABLED=1
CMD ["pnpm", "exec", "next", "dev", "--hostname", "0.0.0.0", "--port", "3000"]
