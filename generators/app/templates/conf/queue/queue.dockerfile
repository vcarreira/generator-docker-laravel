FROM vcarreira/php7:latest

LABEL "com.github.vcarreira.yo-generated"=""

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    supervisor \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /var/log/supervisor /var/www

COPY queue-supervisor.conf /etc/supervisor/conf.d/queue.conf

VOLUME ["/var/www"]

CMD ["/usr/bin/supervisord"]
