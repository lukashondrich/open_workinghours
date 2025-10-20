FROM node:20-alpine AS base

WORKDIR /app

ARG NEXT_PUBLIC_API_PORT=8000
ENV NEXT_PUBLIC_API_PORT=${NEXT_PUBLIC_API_PORT}

COPY package.json ./
COPY tsconfig.json ./
COPY next.config.js ./
COPY next-env.d.ts ./
COPY .eslintrc.json ./
COPY src ./src

RUN npm install

RUN npm run build

# Ensure standalone bundle has access to static assets
RUN mkdir -p .next/standalone/.next && cp -r .next/static .next/standalone/.next/static

EXPOSE 3000

CMD ["node", ".next/standalone/server.js"]
