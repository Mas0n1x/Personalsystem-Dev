FROM node:20-alpine

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code (including prisma schema)
COPY . .

# Generate Prisma client with the actual schema
RUN npx prisma generate

# Create directories for data
RUN mkdir -p uploads backups

EXPOSE 3001

# Run with tsx (TypeScript execution without compilation)
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npx tsx src/index.ts"]
