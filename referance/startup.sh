#!/bin/bash

# Colors for nicer logging
GREEN="\033[0;32m"
NC="\033[0m" # No Color

echo -e "${GREEN}Starting Python HTTP server on port 8080...${NC}"
python3 -m http.server 8080 > http_server.log 2>&1 &
HTTP_PID=$!

echo -e "${GREEN}Starting proxy on port 9000...${NC}"
python3 proxy.py > proxy.log 2>&1 &
PROXY_PID=$!

echo
echo -e "${GREEN}Both servers started successfully.${NC}"
echo " - HTTP Server PID:  $HTTP_PID"
echo " - Proxy PID:        $PROXY_PID"
echo
echo "Dashboard → http://localhost:8080/dashboard.html"
echo
echo "Logs:"
echo " - http_server.log"
echo " - proxy.log"
echo

# Trap Ctrl+C to stop both servers gracefully
trap "echo; echo 'Stopping servers...'; kill $HTTP_PID $PROXY_PID; exit 0" SIGINT

# Keep script running so trap works
while true; do
    sleep 1
done
