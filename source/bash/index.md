---
title: 常用命令
date: 2019-11-14 11:50:12
---

## 删除目录下指定文件

- `find ${path} -name "${filename}" -exec rm -rf {} \;`

  `-exec` 是 `find` 的一个选项，用于后续执行命令，`{}` 代表 `find` 查找到的结果，`\;` 是 `;` 的转义，是 `-exec` 的命令终止符


- `find ${path} -name "${filename}" | xargs rm -rf`

  `xargs` 命令是将上一个命令的结果传递给下一个命令当做参数，配合上管道操作 `|`，将 `find` 命令的搜索结果传递给 `rm -rf` 进行删除，从而达到删除目录下指定文件的目的


## 递归查看目录

- `ls -ld $(find $PWD)`

