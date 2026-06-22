FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/nginx.conf.template

CMD ["sh", "-c", "envsubst '$NGINX_RESOLVER $API_GATEWAY_HOST $API_GATEWAY_PORT $MEMBER_SERVICE_1_HOST $MEMBER_SERVICE_1_PORT $MEMBER_SERVICE_2_HOST $MEMBER_SERVICE_2_PORT' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf && nginx -g 'daemon off;'"]
