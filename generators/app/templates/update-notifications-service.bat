@ECHO OFF
docker-compose stop notifications-daemon
docker-compose rm -f notifications-daemon
docker-compose build notifications-daemon
docker-compose up -d notifications-daemon
FOR /F "tokens=1" %%A IN ('docker images -f "dangling=true" -q') DO docker rmi %%A
