FROM mysql

LABEL "com.github.vcarreira.yo-generated"=""

COPY conf/my.cnf /etc/mysql/conf.d/
