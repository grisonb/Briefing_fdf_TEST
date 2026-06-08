FROM mcr.microsoft.com/playwright:v1.45.3-jammy

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

COPY src ./src

EXPOSE 8080
CMD ["npm", "start"]
