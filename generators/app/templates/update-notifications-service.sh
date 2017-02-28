docker-compose stop notifications-daemon
docker-compose rm -f notifications-daemon
docker-compose build notifications-daemon
docker-compose up -d notifications-daemon
docker images -f "dangling=true" -q | xargs -L1 docker rmi
