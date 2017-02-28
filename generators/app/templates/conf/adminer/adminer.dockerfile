FROM vcarreira/nginx-php7-fpm:latest

LABEL "com.github.vcarreira.yo-generated"=""

COPY entry-point.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]
