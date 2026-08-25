#base image-
FROM node:20

# working directory-
WORKDIR app/

COPY package*.json ./

RUN npm ci

COPY . .

EXPOSE 5000

CMD ["npm","start"]

