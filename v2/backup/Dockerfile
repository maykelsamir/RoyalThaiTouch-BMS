FROM postgres:16-alpine

RUN apk add --no-cache bash coreutils tar gzip tzdata

COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

ENTRYPOINT ["/usr/local/bin/backup.sh"]
