
## Como Instalar o Sistema - RECOMENDADO Ubuntu 18.04

All instructions below assumes you are NOT running as root, since it will give an error in puppeteer. So let's start creating a new user and granting sudo privileges to it:

```bash
adduser deploy
usermod -aG sudo deploy
```

Now we can login with this new user:

```bash
su deploy
```

You'll need two subdomains forwarding to yours VPS ip to follow these instructions. We'll use `myapp.mydomain.com` to frontend and `api.mydomain.com` to backend in the following example.

Update all system packages:

```bash
sudo apt update && sudo apt upgrade
```

Install node and confirm node command is available:

```bash
curl -fsSL https://deb.nodesource.com/setup_14.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
npm -v
```

Install docker and add you user to docker group:

```bash
sudo apt install apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu bionic stable"
sudo apt update
sudo apt install docker-ce
sudo systemctl status docker
sudo usermod -aG docker ${USER}
su - ${USER}
```

Create Mysql Database using docker:
_Note_: change MYSQL_DATABASE, MYSQL_PASSWORD, MYSQL_USER and MYSQL_ROOT_PASSWORD.

```bash
docker run --name whaticketdb -e MYSQL_ROOT_PASSWORD=strongpassword -e MYSQL_DATABASE=whaticket -e MYSQL_USER=whaticket -e MYSQL_PASSWORD=whaticket --restart always -p 3306:3306 -d mariadb:latest --character-set-server=utf8mb4 --collation-server=utf8mb4_bin
```

Clone this repository:

```bash
cd ~
git clone https://github.com/canove/whaticket whaticket
```

Create backend .env file and fill with details:

```bash
cp whaticket/backend/.env.example whaticket/backend/.env
nano whaticket/backend/.env
```

```bash
NODE_ENV=
BACKEND_URL=https://api.mydomain.com      #USE HTTPS HERE, WE WILL ADD SSL LATTER
FRONTEND_URL=https://myapp.mydomain.com   #USE HTTPS HERE, WE WILL ADD SSL LATTER, CORS RELATED!
PROXY_PORT=443                            #USE NGINX REVERSE PROXY PORT HERE, WE WILL CONFIGURE IT LATTER
PORT=8080

DB_HOST=localhost
DB_DIALECT=
DB_USER=
DB_PASS=
DB_NAME=

JWT_SECRET=3123123213123
JWT_REFRESH_SECRET=75756756756
```

Install puppeteer dependencies:

```bash
sudo apt-get install -y libxshmfence-dev libgbm-dev wget unzip fontconfig locales gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils
```

Install backend dependencies, build app, run migrations and seeds:

```bash
cd whaticket/backend
npm install
npm run build
npx sequelize db:migrate
npx sequelize db:seed:all
```

Start it with `npm start`, you should see: `Server started on port...` on console. Hit `CTRL + C` to exit.

Install pm2 **with sudo**, and start backend with it:

```bash
sudo npm install -g pm2
pm2 start dist/server.js --name whaticket-backend
```

Make pm2 auto start afeter reboot:

```bash
pm2 startup ubuntu -u `YOUR_USERNAME`
```

Copy the last line outputed from previus command and run it, its something like:

```bash
sudo env PATH=\$PATH:/usr/bin pm2 startup ubuntu -u YOUR_USERNAME --hp /home/YOUR_USERNAM
```

Go to frontend folder and install dependencies:

```bash
cd ../frontend
npm install
```

Edit .env file and fill it with your backend address, it should look like this:

```bash
REACT_APP_BACKEND_URL = https://api.mydomain.com/
```

Build frontend app:

```bash
npm run build
```

Start frontend with pm2, and save pm2 process list to start automatically after reboot:

```bash
pm2 start server.js --name whaticket-frontend
pm2 save
```

To check if it's running, run `pm2 list`, it should look like:

```bash
deploy@ubuntu-whats:~$ pm2 list
┌─────┬─────────────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id  │ name                    │ namespace   │ version │ mode    │ pid      │ uptime │ .    │ status    │ cpu      │ mem      │ user     │ watching │
├─────┼─────────────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 1   │ whaticket-frontend      │ default     │ 0.1.0   │ fork    │ 179249   │ 12D    │ 0    │ online    │ 0.3%     │ 50.2mb   │ deploy   │ disabled │
│ 6   │ whaticket-backend       │ default     │ 1.0.0   │ fork    │ 179253   │ 12D    │ 15   │ online    │ 0.3%     │ 118.5mb  │ deploy   │ disabled │
└─────┴─────────────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘

```

Install nginx:

```bash
sudo apt install nginx
```

Remove nginx default site:

```bash
sudo rm /etc/nginx/sites-enabled/default
```

Create a new nginx site to frontend app:

```bash
sudo nano /etc/nginx/sites-available/whaticket-frontend
```

Edit and fill it with this information, changing `server_name` to yours equivalent to `myapp.mydomain.com`:

```bash
server {
  server_name myapp.mydomain.com;

  location / {
    proxy_pass http://127.0.0.1:3333;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_cache_bypass $http_upgrade;
  }
}
```

Create another one to backend api, changing `server_name` to yours equivalent to `api.mydomain.com`, and `proxy_pass` to your localhost backend node server URL:

```bash
sudo cp /etc/nginx/sites-available/whaticket-frontend /etc/nginx/sites-available/whaticket-backend
sudo nano /etc/nginx/sites-available/whaticket-backend
```

```bash
server {
  server_name api.mydomain.com;

  location / {
    proxy_pass http://127.0.0.1:8080;
    ......
}
```

Create a symbolic links to enalbe nginx sites:

```bash
sudo ln -s /etc/nginx/sites-available/whaticket-frontend /etc/nginx/sites-enabled
sudo ln -s /etc/nginx/sites-available/whaticket-backend /etc/nginx/sites-enabled
```

By default, nginx limit body size to 1MB, what isn't enough to some media uploads. Lets change it to 20MB adding a new line to config file:

```bash
sudo nano /etc/nginx/nginx.conf
...
http {
    ...
    client_max_body_size 20M; # HANDLE BIGGER UPLOADS
}
```

Test nginx configuration and restart server:

```bash
sudo nginx -t
sudo service nginx restart
```

Now, enable SSL (https) on your sites to use all app features like notifications and sending audio messages. A easy way to this is using Certbot:

Install certbot:

```bash
sudo add-apt-repository ppa:certbot/certbot
sudo apt update
sudo apt install python-certbot-nginx
```

Enable SSL on nginx (Fill / Accept all information asked):

```bash
sudo certbot --nginx
```

## Upgrading

WhaTicket is a working in progress and we are adding new features frequently. To update your old installation and get all the new features, you can use a bash script like this:

**Note**: Always check the .env.example and adjust your .env file before upgrading, since some new variable may be added.

```bash
nano updateWhaticket
```

```bash
#!/bin/bash
echo "Updating Whaticket, please wait."

cd ~
cd whaticket
git pull
cd backend
npm install
rm -rf dist
npm run build
npx sequelize db:migrate
npx sequelize db:seed
cd ../frontend
npm install
rm -rf build
npm run build
pm2 restart all

echo "Update finished. Enjoy!"
```

Make it executable and run it:

```bash
chmod +x updateWhaticket
./updateWhaticket
```