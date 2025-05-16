-- drop database if exists tizonaserver;
-- create database if not exists tizonaserver;
-- use tizonaserver;
set autocommit=1;
create table if not exists users(
id varchar(24) primary key,
name varchar(35) not null,
username varchar(35) not null,
password varchar(60),
role int default 0,
avatar json,
createdAt datetime default now(),
tokenMinDate datetime default now()
);
select * from users;