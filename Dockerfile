FROM oven/bun:latest

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install

# Copy Prisma schema and config
COPY prisma ./prisma
COPY prisma.config.ts ./

# Generate Prisma client
RUN rm -rf node_modules/.prisma && \
    DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy" bun run prisma:generate

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Run migrations then start (Render docker runtime has no blueprint startCommand)
CMD ["sh", "-c", "bunx prisma migrate deploy && bun run index.ts"]
