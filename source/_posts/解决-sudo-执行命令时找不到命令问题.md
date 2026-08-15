---
title: 解决 sudo 执行命令时找不到命令问题
date: 2020-01-15 17:04:24
tags:
    - Linux
---

## 问题原因

Linux 系统中在使用 sudo 执行命令时是为当前用户赋予临时的 root 权限，考虑到安全性等相关问题，sudo 执行命令时会重置 PATH，此时 PATH 中是不包含用户配置的很多命令的路径的。所以会发现 sudo 执行命令时可能存在找不到的情况。

<!-- more -->

比如我们使用 Node.js 的版本管理工具如：nvm 安装的 Node.js 存放于 ~/.nvm/version/node/vx.x.x/bin 中，并且 nvm 会在 PATH 中加入该路径，正常是可以使用 node 命令，但是 `sudo node` 时由于 PATH 被重置， node 命令是找不到的。我们一般情况下不会用 sudo 去运行 node 命令，但是很多时候我们 npm install -g 安装的命令，如果需要操作系统某些文件或功能，是需要 sudo 执行的。

## 解决方案

### 软链接方案

在使用 sudo 执行命令时，被重置的 PATH 中是包含 /usr/local/bin 的，所以可以将需要的命令通过软链接的方式 `ln -s /home/xxx/.nvm/version/node/vx.x.x/bin/node /usr/local/bin` 放到 /usr/local/bin 中，然后 sudo 运行命令就可以正常执行了。

### 修改 sudo 时重置 PATH 的默认值

通过软链接的方式对于少部分命令是可行的，还是 npm install -g 的这个场景，如果安装了很多需要 sudo 权限执行的命令，每个都通过软链接的方式比较繁琐，那么我们可以通过修改 sudo 时重置 PATH 的默认值，将 ~/.nvm/version/node/vx.x.x/bin 这个路径加入到 PATH 中。

使用 `sudo vim /etc/sudoers` 打开文件，然后找到 secure_path 这一行，在其中加入 ~/.nvm/version/node/vx.x.x/bin，然后通过 `:wq!` 保存即可，这里使用 vim 强制保存是因为 /etc/sudoers 文件是只读权限。

修改 sudo 时重置 PATH 的默认值方式需要多加注意安全问题，保证加入到 PATH 的路径中包含的命令是可以被信任的，如果不能够完全信任的情况下，还是建议使用软链接的方式针对性处理需要用到的命令。
