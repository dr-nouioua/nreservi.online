FROM node:22-alpine
WORKDIR /app

# 1. Enable corepack for package tracking
RUN corepack enable

# 2. Copy application codebase and configurations
COPY . .

# 3. Clean install all dependencies
RUN npm install

# 4. Set production flags so TanStack builds global routing contexts
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# 5. Compile the framework application code natively
RUN npm run build

EXPOSE 3000

# 6. Execute using vinxi's absolute production engine runner
CMD [ "npx", "vinxi", "start" ]
