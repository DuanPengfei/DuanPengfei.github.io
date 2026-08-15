---
title: Respberry Pi 4 使用 Ubuntu 20.10 系统
date: 2020-11-09 15:18:40
tags:
    - Respberry Pi
    - Linux
    - Ubuntu
---

### USB 鼠标延迟

USB 鼠标延迟是由于 Raspberry Pi 使用恒定的轮训率，鼠标轮训率的枚举值含义如下：

- usbhid.mousepoll=0：设备声明的轮训率
- usbhid.mousepoll=1： 1000Hz
- usbhid.mousepoll=2： 500Hz
- usbhid.mousepoll=4： 250Hz
- usbhid.mousepoll=8： 125Hz
- usbhid.mousepoll=10：100Hz（Raspberry Pi 默认值）

<!-- more -->

修复鼠标延迟问题，需要我们设置使用设备声明的轮训率，打开 `/boot/firmware/cmdline.txt` 在行末尾加入 `usbhid.mousepoll=0` 与前一项配置以空格分隔，然后重启生效。

