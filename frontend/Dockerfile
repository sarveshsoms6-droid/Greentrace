# Stage 1: Build the React + Vite static bundle
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and build
COPY . .

# Accept build-time arguments for Vite environment variables
ARG VITE_API_BASE_URL
ARG VITE_TEZOS_NETWORK=shadownet
ARG VITE_TEZOS_RPC_URL=https://rpc.shadownet.teztnets.com
ARG VITE_EXPLORER_URL=https://shadownet.tzkt.io
ARG VITE_CONTRACT_ADDRESS
ARG VITE_ORGANIZER_ADDRESSES

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_TEZOS_NETWORK=$VITE_TEZOS_NETWORK \
    VITE_TEZOS_RPC_URL=$VITE_TEZOS_RPC_URL \
    VITE_EXPLORER_URL=$VITE_EXPLORER_URL \
    VITE_CONTRACT_ADDRESS=$VITE_CONTRACT_ADDRESS \
    VITE_ORGANIZER_ADDRESSES=$VITE_ORGANIZER_ADDRESSES

RUN npm run build

# Stage 2: Serve with Nginx Alpine
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

