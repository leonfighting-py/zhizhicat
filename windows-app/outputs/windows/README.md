# Windows 构建输出

GitHub Actions 成功后，下载名为 `zhizhi-windows-x64` 的 artifact，并把内容放在这里。应包含安装版 `ZhizhiPet-Setup-0.1.0.exe`、免安装版 `ZhizhiPet-Portable-0.1.0.exe`、`SHA256SUMS.txt` 和使用说明。

本目录不会在 macOS 上伪造 `.exe`；Windows 可执行文件必须由项目自带的 `windows-build.yml` 在 `windows-latest` 上真实编译。
