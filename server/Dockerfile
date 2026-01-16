FROM node:20-alpine

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source code
COPY . .

# Create directories for data
RUN mkdir -p uploads backups

EXPOSE 3001

# Run with tsx (TypeScript execution without compilation)
CMD ["sh", "-c", "npx prisma db push && npx tsx src/index.ts"]
