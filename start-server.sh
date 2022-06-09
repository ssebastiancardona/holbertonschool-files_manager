#!/usr/bin/env bash
DB_HOST=localhost DB_PORT=27017 DB_DATABASE=files_manager PORT=5000 FOLDER_PATH=`pwd`/local_storage npm run start-server > /dev/null 2>&1 &

while true; do
    curl -s -o /dev/null http://localhost:5000/status ;
    statusCode=$?
    if [ $statusCode -eq 0 ]; then
        break
    fi
    sleep 2
done

sleep 2

while true; do
    curl -s -o /dev/null http://localhost:5000/status ;
    statusCode=$?
    if [ $statusCode -eq 0 ]; then
        break
    fi
    sleep 2
done
