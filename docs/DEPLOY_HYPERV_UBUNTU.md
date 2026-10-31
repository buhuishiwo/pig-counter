# 部署教程：Windows Server 2022 + Hyper-V + Ubuntu 虚拟机

> **适用场景**：把当前跑在 `47.110.63.70` 的 pig-counter（Docker Compose 三容器）部署到客户内网的
> Windows Server 2022 物理机 —— 在 Hyper-V 里跑一台 Ubuntu 虚拟机，Docker 全栈装在虚拟机内。
>
> 对应 [`MIGRATION_PLAN.md`](MIGRATION_PLAN.md) 里目标系统的 🥈 次选路线（🥇 首选是直接装 Ubuntu Server）。
> 本文档只讲"怎么装、怎么起、怎么验、坏了怎么查"，不重复项目功能说明。

> **已部署现场（2026-10-31）**：Windows 宿主 `192.168.250.1` · Ubuntu VM `192.168.250.2` ·
> Hyper-V NAT 网络 · 项目入口 `http://192.168.250.2:8888`。实测参数见 9.4 节。

**文档版本**：2026-10-31 · 对应代码 v3.0

---

## 目录

- [0. 先读这一节（5 分钟）](#0-先读这一节5-分钟)
- [1. 开工前盘点（Windows 侧）](#1-开工前盘点windows-侧)
- [2. 阶段一：安装 Hyper-V](#2-阶段一安装-hyper-v)
- [3. 阶段二：安装 Ubuntu Server](#3-阶段二安装-ubuntu-server)
- [4. 阶段三：Ubuntu 基线配置](#4-阶段三ubuntu-基线配置)
- [5. 阶段四：安装 Docker](#5-阶段四安装-docker)
- [6. 阶段五：搬运代码、镜像、数据库](#6-阶段五搬运代码镜像数据库)
- [7. 阶段六：前端产物（dist）](#7-阶段六前端产物dist)
- [8. 阶段七：启动服务](#8-阶段七启动服务)
- [9. 阶段八：对外访问](#9-阶段八对外访问)
- [10. 阶段九：验收清单](#10-阶段九验收清单)
- [11. 阶段十：运维](#11-阶段十运维)
- [12. 故障排查手册](#12-故障排查手册)
- [13. 回滚](#13-回滚)
- [附录 A：一页命令速查](#附录-a一页命令速查)
- [附录 B：新旧环境对照](#附录-b新旧环境对照)
- [附录 C：本次部署不修改任何源码](#附录-c本次部署不修改任何源码)

---

## 0. 先读这一节（5 分钟）

### 0.1 目标形态

```
                    内网客户端浏览器
                          │  http://192.168.1.50:8888
                          ▼
┌──────────────────── Windows Server 2022（物理机）─────────────────────┐
│  角色：Hyper-V                                                       │
│  虚拟交换机：vSwitch-External（桥接到物理网卡，VM 与宿主同网段）        │
│                                                                     │
│    ┌──────────────────────────────────────────────────────────┐     │
│    │ Ubuntu 22.04 LTS 虚拟机   pig-count-vm   192.168.1.50     │     │
│    │                                                          │     │
│    │  Docker Engine + Compose v2                              │     │
│    │   ├─ pig-count-nginx     8888:80   ← 唯一对外端口          │     │
│    │   ├─ pig-count-backend   127.0.0.1:8866  FastAPI + OpenCV │     │
│    │   │                                    DNN 跑 ONNX 模型   │     │
│    │   └─ pig-count-mysql     127.0.0.1:3307                   │     │
│    │        卷 pig-counter_mysql_data（全部业务数据）            │     │
│    └──────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

**为什么是"Windows 里套 Ubuntu 虚拟机"而不是"Windows 上直接跑 Docker"**

- Windows Server 2022 不支持 Docker Desktop（授权与支持范围都不覆盖服务器系统）；
- Linux 容器在 Windows 上只能靠 WSL2 或 Hyper-V 里的 Linux 内核；
- 本项目镜像全部基于 `python:3.11-slim-bookworm` / `mysql:8.0` / `nginx` —— **都是 Linux 镜像**，
  Windows 容器跑不了；
- 反过来，容器内是 Debian，**宿主的 Ubuntu 是 22.04 还是 24.04 对镜像零影响**。

### 0.2 三条硬性前提（不满足就先别开工）

| # | 前提 | 怎么确认 | 不满足的后果 |
|:--|:--|:--|:--|
| 1 | CPU 支持虚拟化（VT-x/AMD-V）+ SLAT，且 BIOS 里已开启 | 见 [1.1](#11-硬件与固件) | Hyper-V 装上了也起不了 VM |
| 2 | Windows Server 2022 **本身不是**虚拟机；若是，外层必须开嵌套虚拟化 | 见 [1.2](#12-宿主自己是不是虚拟机) | 无法创建虚拟机 / VM 起不来 |
| 3 | 磁盘剩余 ≥ 120GB，内存 ≥ 16GB（宿主自身还要用） | `Get-PSDrive`、`Get-CimInstance Win32_ComputerSystem` | 构建镜像 / 导数据库时磁盘满 |

### 0.3 你需要提前准备好的东西

| 项 | 说明 |
|:--|:--|
| Ubuntu Server 22.04 ISO | <https://releases.ubuntu.com/22.04/> 下载 `ubuntu-22.04.x-live-server-amd64.iso`（约 2GB） |
| 源服务器 root 权限 | `ssh root@47.110.63.70`，要能从里面导出镜像和数据库 |
| `OCR_API_KEY` | 水印 OCR 用，阿里云 DashScope 的 `sk-` 开头密钥。**丢了不影响识别主流程**，只是水印标签不可用 |
| 一个固定内网 IP + 网关 + DNS | 例如 `192.168.1.50 / 255.255.255.0 / 192.168.1.1`，**必须问客户网管要**，别自己猜 |
| Windows 侧的本地管理员权限 | 装 Hyper-V 角色需要 |

### 0.4 两条路线，先确认走哪条

| | 路线 A：VM 能上外网（推荐） | 路线 B：VM 完全离线 |
|:--|:--|:--|
| 打镜像 | 在 VM 里 `docker compose up -d --build` 现场构建 | 从源服务器 `docker save` 导出，VM 里 `docker load` |
| 前端 dist | 可以现场 `npm run build`，也可以直接拷 | 必须从源服务器拷 `dist/` |
| 依赖下载 | 走 Dockerfile 里已配好的清华 PyPI / Debian 源 | 零下载 |
| 需要准备什么 | 只需代码 + 数据库 dump | 代码包 + `pigcount-images.tar`（约 1.6GB）+ 数据库 dump |
| 风险 | 公网源偶发超时（PyPI/Docker Hub） | 镜像与代码版本可能不一致，需要记录来源 commit |

> **本文主线走路线 A**，路线 B 的差异步骤在 [6.3](#63-在源服务器打三个包) 和 [8.1](#81-加载镜像路线-b) 里单独标注。
> 如果客户明确要求"部署机不联网"，照着 A 走但把 8.1 换成 B 的做法即可，其余步骤完全一致。

### 0.5 全程时间预估

| 阶段 | 纯操作时间 | 备注 |
|:--|:--|:--|
| 装 Hyper-V 角色 | 10 分钟 + 1 次重启 | 重启后可能还要再重启一次 |
| 创建交换机 + 虚拟机 | 5 分钟 | 创建外部交换机瞬间会断网几秒 |
| 装 Ubuntu | 15～25 分钟 | 全程无人值守，看进度就行 |
| 基线配置 + Docker | 15 分钟 | 换源后 apt 很快 |
| 搬运（1.6GB 镜像 + 700MB dump） | 20～60 分钟 | 取决于链路，内网 sftp 大概 30 分钟 |
| 启动 + 导库 | 15 分钟 | 导 700MB 的库要几分钟 |
| 验收 | 15 分钟 | |
| **合计** | **约 2～3 小时**（不含 ISO 下载与客户配合时间） | |

### 0.6 验收总纲

部署完成的判定标准，就是能做到下面 8 条（[第 10 节](#10-阶段九验收清单) 有逐条命令）：

1. `docker compose ps` 三个容器都是 `Up`
2. `curl http://127.0.0.1:8888/api/health` 返回 `"status":"healthy"` 且 `"model_exists":true`
3. 浏览器打开 `http://<VM-IP>:8888` 能看到首页，不是 404/502
4. `detection_records` 行数与源库一致（当前生产 2500 行）
5. 数据库 `select now()` 是北京时间
6. 上传一张猪舍图 → 出标注图和计数
7. 批量识别 40+ 张图不超时、能导出 Excel
8. 宿主重启后，VM 与三个容器自动起来，不用人工干预

---

## 1. 开工前盘点（Windows 侧）

在 **Windows Server 2022** 上以管理员身份打开 PowerShell（`Win+X` → `Windows PowerShell (Admin)` 或 `Terminal (Admin)`）。

### 1.1 硬件与固件

```powershell
# CPU / 内存 / 系统版本
Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer, Model, NumberOfProcessors, @{n='RAM_GB';e={[math]::Round($_.TotalPhysicalMemory/1GB,1)}}
Get-CimInstance Win32_Processor | Select-Object Name, NumberOfCores, NumberOfLogicalProcessors, VirtualizationFirmwareEnabled, SecondLevelAddressTranslationExtensions

# 虚拟化四项要求，期望全是 True
Get-ComputerInfo -Property HyperVRequirement*
```

期望输出（关键三项）：

```
HyperVRequirementVirtualizationFirmwareEnabled : True
HyperVRequirementSecondLevelAddressTranslation : True
HyperVRequirementVMMonitorModeExtensions       : True
```

- 若 `VirtualizationFirmwareEnabled : False` → 进 BIOS/UEFI 打开 `Intel VT-x` / `AMD-V` / `SVM Mode`，
  同时确认 `VT-d` / `IOMMU` 可开则开（不是必需）。
- 若这项是 `False` 且找不到 BIOS 开关 → 很可能宿主是台云主机/虚拟机，看下一节。

### 1.2 宿主自己是不是虚拟机

```powershell
Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer, Model
systeminfo | Select-String -Pattern "Hyper-V","虚拟化"
```

- `Manufacturer` 是 `VMware, Inc.` / `Microsoft Corporation`（且 Model 是 `Virtual Machine`）/ `Alibaba Cloud` 之类 →
  **这台 Windows Server 2022 是虚拟机**，它再装 Hyper-V 需要外层平台开启**嵌套虚拟化**：
  - VMware ESXi：vCPU 勾选 `Expose hardware assisted virtualization to the guest OS`
  - Hyper-V 外层：`Set-VMProcessor -VMName <宿主VM> -ExposeVirtualizationExtensions $true`
  - 阿里云/腾讯云：一般**不支持**，需换裸金属或直接给 Ubuntu 主机
- 这种情况不要硬撑，先跟客户确认。本文余下步骤假设宿主是**物理机**。

### 1.3 授权提醒（一句话）

Windows Server 2022 **Standard** 授权包含宿主机 + **2 个**虚拟机；**Datacenter** 不限。
本方案只用 1 台 VM，Standard 够用；如果这台物理机上已经有别的 Hyper-V VM，先确认授权余量。

### 1.4 网络信息登记（先填表再动手）

| 项 | 值（示例，按实际填） | 从哪来 |
|:--|:--|:--|
| Windows 宿主 IP / 掩码 / 网关 | `192.168.1.10 / 24 / 192.168.1.1` | `ipconfig /all` |
| 物理网卡名称 | `Ethernet` 或 `以太网` | `Get-NetAdapter` |
| VM 固定 IP / 掩码 / 网关 | `192.168.1.50 / 24 / 192.168.1.1` | **问网管**（要在 DHCP 池之外） |
| DNS | `223.5.5.5`、`119.29.29.29` | 客户有内网 DNS 就用内网的 |
| 客户端访问地址 | `http://192.168.1.50:8888` | 上面两项决定 |

### 1.5 磁盘规划

```powershell
Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{n='Used_GB';e={[math]::Round($_.Used/1GB,1)}}, @{n='Free_GB';e={[math]::Round($_.Free/1GB,1)}}
```

| 用途 | 占用 | 说明 |
|:--|:--|:--|
| Ubuntu ISO 存放 | 2 GB | 建议 `D:\ISO\` |
| VM 虚拟磁盘（动态扩展） | 实际用 15～25 GB，上限给 120 GB | 建议 `D:\Hyper-V\` |
| 传输中转目录 | 3 GB 临时 | `D:\xfer\`，用完删 |
| backend 镜像 | 946 MB | |
| mysql 镜像 + 数据卷 | 约 500 MB + 700 MB | 数据卷随业务增长 |
| 构建缓存（路线 A） | 2～3 GB | 装完可 `docker builder prune` 清掉 |

**给 D 盘（或数据盘）留 120GB 以上**。系统盘 C 盘不要放 VM。

---

## 2. 阶段一：安装 Hyper-V

### 2.1 安装角色

```powershell
# 安装 Hyper-V 与管理工具，装完自动重启
Install-WindowsFeature -Name Hyper-V -IncludeManagementTools -Restart
```

重启后验证：

```powershell
Get-WindowsFeature -Name Hyper-V | Select-Object Name, InstallState   # 期望 Installed
Get-Service vmms                                                       # 期望 Running
```

> **常见卡点**：有的机器需要**重启两次**（第一次装完，第二次才真正启用 hypervisor）。
> 如果 `Get-Service vmms` 起不来，再重启一次。
>
> **注意**：装完 Hyper-V 后宿主自己也是跑在 Hypervisor 之上的，**这台机器上再装 VMware Workstation /
> VirtualBox 会冲突**。如果客户服务器上有这类软件，先确认能否卸载。

### 2.2 创建外部虚拟交换机（有断网风险）

这一步把 VM 桥接到物理网卡，**VM 会拿到和宿主同网段的独立 IP**，局域网客户端可以直接访问。

```powershell
# 1) 先看清物理网卡名字（Name 列就是要用的值）
Get-NetAdapter | Format-Table Name, InterfaceDescription, Status, LinkSpeed -AutoSize

# 2) 创建外部交换机（把 -NetAdapterName 换成上一步的真实网卡名）
New-VMSwitch -Name "vSwitch-External" -NetAdapterName "Ethernet" -AllowManagementOS $true

# 3) 确认
Get-VMSwitch | Format-Table Name, SwitchType, NetAdapterInterfaceDescription -AutoSize
```

**必须知道的副作用**：

- 创建瞬间物理网卡会被"接管"约 3～10 秒，**RDP 会断**。如果你正通过远程桌面操作，
  断开后等 10 秒重连即可；因此**别在业务高峰做**，并且优先用 IPMI/iDRAC 带外或本地控制台。
- 创建后 `Get-NetAdapter` 里物理网卡上方会多出一个 `vEthernet (vSwitch-External)` 虚拟适配器，
  **宿主自己的 IP 不变**，仍走这个虚拟适配器。
- 如果报 `无法绑定到网络适配器`，通常是：网卡被"网络适配器组合 (LBFO/NIC Teaming)"占用、
  或者网卡上装了第三方 VPN/过滤驱动。用 `Get-NetLbfoTeam` 查组合，必要时用未组合的物理口。

> **虚拟机队列 / SR-IOV 不用开**，本场景用不上。

### 2.3 创建虚拟机（PowerShell 一把梭）

先改三个变量，其余照抄：

```powershell
# ===== 改这三行 =====
$vm  = "pig-count-vm"
$iso = "D:\ISO\ubuntu-22.04.5-live-server-amd64.iso"    # 换成你实际的 ISO 文件名
$vhd = "D:\Hyper-V\$vm\Virtual Hard Disks\$vm.vhdx"

New-Item -ItemType Directory -Force -Path (Split-Path $vhd) | Out-Null

# 创建 Gen2（UEFI）虚拟机：4 vCPU / 8GB 固定内存 / 120GB 动态磁盘 / 外部交换机
New-VM -Name $vm -Generation 2 -MemoryStartupBytes 8GB `
       -NewVHDPath $vhd -NewVHDSizeBytes 120GB -SwitchName "vSwitch-External"

Set-VMProcessor -VMName $vm -Count 4
Set-VMMemory     -VMName $vm -DynamicMemoryEnabled $false      # 必须关：动态内存会拖垮 MySQL/Docker

# 挂 ISO 并设为第一启动项
Add-VMDvdDrive -VMName $vm -Path $iso
Set-VMFirmware -VMName $vm -FirstBootDevice (Get-VMDvdDrive -VMName $vm)

# 让 VM 能在宿主重启后自动起来（后面对齐运维要求）
Set-VM -Name $vm -AutomaticStartAction Start -AutomaticStartDelay 30 -AutomaticStopAction ShutDown

# 开机并打开控制台
Start-VM -Name $vm
vmconnect.exe localhost $vm
```

**参数怎么定**

| 参数 | 取值 | 理由 |
|:--|:--|:--|
| Generation | **2（UEFI）** | 启动快、支持大磁盘；Ubuntu 22.04 官方 ISO 已签名，Secure Boot 可留 |
| vCPU | **4** | ONNX 推理是 CPU 密集型，2 核会明显慢；宿主核数的一半为上限 |
| 内存 | **8GB 固定** | MySQL(1G) + uvicorn + 批量推理时 OpenCV 缓存，8G 稳；4G 容易 OOM。**不要开动态内存** |
| 磁盘 | **120GB 动态扩展** | 实际占用 15～25GB；动态盘省空间但删除后不自动回收，需要时用 `Optimize-VHD` |
| 交换机 | 外部 | 见 2.2 |

### 2.4 图形界面版（不想敲命令的话）

`服务器管理器` → `工具` → `Hyper-V 管理器`：

1. 右侧 `虚拟交换机管理器` → 新建虚拟网络交换机 → 类型选 **外部** → 勾选物理网卡 → 确定（同样会断网几秒）
2. 右侧 `新建` → `虚拟机` → 指定名称 → 代数选 **第 2 代** → 启动内存 `8192` **并清空"使用动态内存"** →
   连接选 `vSwitch-External` → 创建虚拟硬盘 `120GB` → 安装选项选"从可启动 CD/DVD 安装"并指向 ISO → 完成
3. 选中虚拟机 → `设置` → `处理器` 数量改 4 → `管理` → `自动启动操作` 选"自动启动"、延迟 30 秒
4. 选中虚拟机 → `连接`

### 2.5 Secure Boot 与启动顺序

Ubuntu 22.04 的 ISO 带 Microsoft 签名的 shim，**Gen2 开着 Secure Boot 一般能正常启动**。

如果控制台出现下面这类报错，就来关掉它（只影响这台 VM，不影响宿主）：

```
Verification failed: (0x1A) Security Violation
```

```powershell
Set-VMFirmware -VMName "pig-count-vm" -EnableSecureBoot Off
```

> 装完系统后记得把第一启动项切回硬盘，否则每次开机都进安装器菜单：
>
> ```powershell
> Set-VMFirmware -VMName "pig-count-vm" -FirstBootDevice (Get-VMHardDiskDrive -VMName "pig-count-vm")
> ```
>
> 顺手也能把 ISO 弹掉（可选，不弹也不影响）：`Set-VMDvdDrive -VMName "pig-count-vm" -Path $null`。

### 2.6 打开控制台

```powershell
vmconnect.exe localhost "pig-count-vm"
```

控制台默认分辨率 1024×768，装服务器足够。**增强会话模式（Enhanced Session）对 Linux 需要装 xrdp + 桌面，
本场景纯命令行，不需要。**

---

## 3. 阶段二：安装 Ubuntu Server

### 3.1 安装器逐屏要点

| 屏 | 选什么 | 注意 |
|:--|:--|:--|
| Language | `English` | 选中文会导致后续报错信息是中文、且部分字符宽度异常，排错变难 |
| Installer update | `Continue without updating` | |
| Keyboard | `English (US)` | |
| Network | 保持 DHCP 即可 | 静态 IP 在装完后用 netplan 配，更好复制、更好核查 |
| Proxy | 留空 | |
| Mirror | 默认 `archive.ubuntu.com` 即可 | 后面会在系统里换阿里云源 |
| Storage | **`Use an entire disk`** + **勾选 `Set up this disk as an LVM group`** | LVM 方便以后扩盘，必须勾 |
| Storage 确认 | 看清磁盘是那 120GB 的 VHDX | 别选成别的东西 |
| Profile | 名字随意，用户名建议 `pigadmin`，**密码记牢** | 这台机器基本不插键盘，密码丢了只能重装 |
| Ubuntu Pro | `Skip for now` | |
| SSH | **✅ `Install OpenSSH server`** | **这一项必须选**，否则后面只能靠 Hyper-V 控制台 |
| Featured Server Snaps | 一个都不选 | 直接 `Done` |
| 安装过程 | 等 `Reboot Now` | 提示拔盘时直接回车（ISO 在虚拟光驱里，会自动弹） |

### 3.2 分区建议

默认 LVM 方案已经够用：

```
/dev/sda
├─ sda1  1GB   EFI System Partition
├─ sda2  2GB   /boot
└─ sda3  剩余  LVM VG "ubuntu-vg"
          ├─ lv-root   ~117GB  /
          └─ (swap 用 swapfile，默认 4GB 左右)
```

不需要手工分区。数据库和镜像都存在 `/` 下的 `/var/lib/docker`。

### 3.3 首次登录

```bash
# 在 Hyper-V 控制台里登录后，先看 IP
ip -br a
```

回到 Windows 宿主，用 SSH 连进去（Windows Server 2022 自带 OpenSSH 客户端）：

```powershell
ssh pigadmin@192.168.1.xx        # 第一次连会问 yes，输密码
```

> 连不上先排查：VM 里 `systemctl status ssh` 是否 running；宿主 `ping` VM IP 通不通；
> 见 [12. 故障排查](#12-故障排查手册) 第 2 条。

### 3.4 装完立刻做的 4 件事

```bash
# 1) 时区（关键，见 4.3）
sudo timedatectl set-timezone Asia/Shanghai
timedatectl

# 2) 主机名
sudo hostnamectl set-hostname pig-count
sudo sed -i 's/^127.0.1.1.*/127.0.1.1 pig-count/' /etc/hosts

# 3) 系统更新
sudo apt update && sudo apt -y upgrade

# 4) 基础工具
sudo apt -y install htop unzip curl vim net-tools
```

---

## 4. 阶段三：Ubuntu 基线配置

### 4.1 固定 IP

Hyper-V 外部交换机下，网卡名通常是 `eth0`（合成网卡没有 PCI 槽位，所以没有 `ens18` 这类名字）。
**先确认，别照抄**：

```bash
ip -br link
ls /etc/netplan/
```

改 netplan（文件名以 `ls` 看到的为准，通常是 `00-installer-config.yaml`）：

```bash
sudo cp /etc/netplan/00-installer-config.yaml /etc/netplan/00-installer-config.yaml.bak

sudo tee /etc/netplan/00-installer-config.yaml >/dev/null <<'EOF'
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: false
      addresses: [192.168.1.50/24]
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses: [223.5.5.5, 119.29.29.29]
EOF

sudo chmod 600 /etc/netplan/00-installer-config.yaml
sudo netplan try     # 120 秒内按回车确认，否则自动回滚（很重要，别直接 apply）
```

确认后若 IP 已生效但连接没断，再 `sudo netplan apply` 固化。

> **注意**：YAML 用空格缩进，**不能用 Tab**。缩进错会直接断网，靠 Hyper-V 控制台改回来。
> 如果你只有一条 SSH 会话，务必用 `netplan try` 而不是 `apply`。

验证：

```bash
ip -br a                       # eth0 上应是 192.168.1.50/24
ip route | head -3             # default via 192.168.1.1
ping -c2 223.5.5.5
ping -c2 www.baidu.com         # 顺便验证 DNS
```

### 4.2 换 apt 源

```bash
sudo cp /etc/apt/sources.list /etc/apt/sources.list.bak
sudo sed -i 's|http://archive.ubuntu.com/ubuntu/|https://mirrors.aliyun.com/ubuntu/|g; s|http://security.ubuntu.com/ubuntu/|https://mirrors.aliyun.com/ubuntu/|g' /etc/apt/sources.list
sudo apt update && sudo apt -y upgrade
```

> 客户网络禁止出公网时跳过本节，所有安装包要提前离线准备（见 [6.3](#63-在源服务器打三个包) 的路线 B 说明）。

### 4.3 时间同步（重点，别跳过）

`created_at` 是 MySQL `TIMESTAMP`，容器里靠 `TZ=Asia/Shanghai` 换算。**VM 的系统时间必须准**，
否则写进库的数据从源头就是错的。

```bash
sudo timedatectl set-timezone Asia/Shanghai
timedatectl set-ntp true                 # 用 systemd-timesyncd
timedatectl                              # 期望：Time zone: Asia/Shanghai (CST, +0800) / synchronized: yes
date
```

如果 `synchronized: no` 且一直不生效：

```bash
sudo systemctl restart systemd-timesyncd
timedatectl timesync-status
```

> **Hyper-V 时间同步的坑**：Hyper-V 集成服务的"时间同步"会在宿主时间不准时把错误时间灌进 VM。
> 建议在 `Hyper-V 管理器 → VM 设置 → 管理 → 集成服务` 里**取消勾选"时间同步"**，
> 让 VM 自己走 NTP；或者反过来，确保宿主的 NTP 也是准的（`w32tm /resync`）。
> 两者选一，**不要一边禁用一边又指望宿主校时**。

### 4.4 防火墙

```bash
sudo ufw allow 22/tcp
sudo ufw allow 8888/tcp
# 更严格：只允许业务网段
# sudo ufw allow from 192.168.1.0/24 to any port 8888 proto tcp

sudo ufw enable
sudo ufw status verbose
```

> **只开 22 和 8888**。`8866`（无鉴权的推理接口）和 `3307`（MySQL root）在 compose 里已经绑死
> `127.0.0.1`，本来就不会暴露；万一以后改成 `0.0.0.0`，这里是第二道闸。

### 4.5 可选：SSH 密钥免密

```powershell
# 在 Windows 宿主上
ssh-keygen -t ed25519            # 一路回车
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh pigadmin@192.168.1.50 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
ssh pigadmin@192.168.1.50        # 这次应该不要密码
```

---

## 5. 阶段四：安装 Docker

### 5.1 官方源安装

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
| sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

> `download.docker.com` 慢/超时的话，把上面 `tee` 那行的地址换成清华镜像：
> `https://mirrors.tuna.tsinghua.edu.cn/docker-ce/linux/ubuntu`，**签名 key 也要换成对应的**：
> `sudo curl -fsSL https://mirrors.tuna.tsinghua.edu.cn/docker-ce/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc`

验证（关键：要有 `docker compose` 子命令，而不是老的 `docker-compose`）：

```bash
docker version
docker compose version          # 期望 Docker Compose version v2.x
```

### 5.2 daemon.json：日志轮转（必做）

Docker 默认日志无上限，一个跑一年的容器能把磁盘写满：

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json >/dev/null <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "50m", "max-file": "3" },
  "live-restore": true
}
EOF

sudo systemctl daemon-reload
sudo systemctl restart docker
docker info | grep -A2 "Logging Driver"
```

> 只有在 [8.1](#81-加载镜像路线-b) 走"离线 load 镜像"时才需要在这里加 `registry-mirrors`；
> 本项目推荐直接从源服务器导镜像，不依赖任何加速器（国内多数公共加速器已停止服务）。

### 5.3 免 sudo 与开机自启

```bash
sudo usermod -aG docker $USER
newgrp docker                # 或者重新登录 SSH 生效
docker ps                    # 不报权限错误即成功

sudo systemctl enable docker      # 默认已 enable，确认一下
sudo systemctl is-enabled docker
```

### 5.4 顺手验证磁盘

```bash
df -h /var/lib/docker
docker system df
```

---

## 6. 阶段五：搬运代码、镜像、数据库

### 6.1 目标目录与项目名（**这一步决定卷名和镜像名，别随便起**）

```bash
sudo mkdir -p /opt/pig-counter
sudo chown -R $USER:$USER /opt/pig-counter
```

**为什么必须叫 `/opt/pig-counter`**：Docker Compose 的项目名默认取**compose 文件所在目录的目录名**，
而项目名同时决定了两个东西：

| 由项目名派生 | 现在源服务器的名字 | 如果目录名不同会变成 |
|:--|:--|:--|
| MySQL 数据卷 | `pig-counter_mysql_data` | `opt_pigcounter_mysql_data` 等 |
| backend 镜像名 | `pig-counter-backend` | 同上规律 |

名字不一致本身不会让服务起不来（`docker load` 进来的镜像名只要和 compose 期待的一致就行），
但**会让人对着文档排错时找不到卷**。所以本文统一：目录 `/opt/pig-counter`，项目名 `pig-counter`。
想显式锁死，就在 `.env` 里写 `COMPOSE_PROJECT_NAME=pig-counter`（见 6.6）。

### 6.2 三条搬运通道

| 通道 | 适用 | 命令 |
|:--|:--|:--|
| **A. VM 直接 scp 源服务器**（最快，1 跳） | VM 能出公网 | `scp root@47.110.63.70:/tmp/xxx /tmp/` |
| **B. 源服务器 → Windows 宿主 → VM**（2 跳） | VM 不能出公网 | 宿主上 `scp` 两次 |
| **C. 宿主 SMB 共享** | 文件特别大、想用资源管理器拖 | `New-SmbShare` + VM 里 `mount -t cifs` |

下面按 **B（两跳）** 写，因为它一定可行；VM 能出网的话把第一跳改成 VM 里直接执行即可。

### 6.3 在源服务器打三个包

登录源服务器：

```bash
ssh root@47.110.63.70
cd /opt/pig-counter/pig-counter
git rev-parse --short HEAD        # 记下 commit，后面验收要用
```

**① 代码包**（含 `dist/`、`nginx.conf`、`docker-compose.yml`、`backend/`，不含 `node_modules` 和 `.git`）

```bash
tar -czf /tmp/pigcount-src-$(date +%F).tar.gz \
    docker-compose.yml nginx.conf dist backend

ls -lh /tmp/pigcount-src-*.tar.gz
```

> `tar` 只打后面列出的这几项，没列的（`.git`、`frontend/node_modules`）自然不会进去。

> **为什么只打这几样**：主机上真正需要的是"nginx 挂载的 `dist/` + 配置 + 后端构建上下文"。
> `frontend/` 源码只有想在 VM 里重新构建前端时才需要（路线 A 可选），不需要可以先不打。
> `backend/` 目录一共 8 个文件（`app.py`、`watermark_ocr.py`、`requirements.txt`、`Dockerfile`、
> `.dockerignore`、`mysql_init.sql`、`excel_template_v2.xlsx`、`model/pig_count.onnx`），
> 其中 **`model/pig_count.onnx` 必须存在**，缺了后端容器会崩（见 12.6）。

**② 数据库全量导出**

```bash
docker exec pig-count-mysql mysqldump -uroot -ppig_counterMysql \
  --single-transaction --routines --triggers \
  --default-character-set=utf8mb4 \
  pig_counter | gzip > /tmp/pigcounter-db-$(date +%F).sql.gz

ls -lh /tmp/pigcounter-db-*.sql.gz
```

> 当前生产库约 681MB（2500 条记录，其中 655MB 是 base64 缩略图），压缩后大约 300～400MB。
> `--single-transaction` 保证导出期间不锁表，**对线上零影响**。
> 注意：图片是以 base64 存在 `detection_records` 表的 `annotated_image` / `original_image`
> 两个 `mediumtext` 列里的，没法只丢图片保留记录——真要瘦身只能整表不导，那就连历史检测记录
> 一起没了。`MIGRATION_PLAN` 已决定**全部保留**，所以这里按原样全量导出。

**③ 镜像包**（路线 B 必须；路线 A 可跳过，但打一份当备份也值）

```bash
# 先确认 compose 实际用的镜像名
docker compose config --images

# 按上一步输出导出，通常就是这三个
docker save -o /tmp/pigcount-images.tar \
  pig-counter-backend:latest mysql:8.0 nginx:latest

ls -lh /tmp/pigcount-images.tar     # 约 1.5～1.7GB
```

**④ 生成校验值**

```bash
cd /tmp && sha256sum pigcount-*.tar.gz pigcounter-db-*.sql.gz pigcount-images.tar > pigcount.sha256
cat pigcount.sha256
```

### 6.4 传输

**第一跳**：源服务器 → Windows 宿主（在 Windows 的 PowerShell 里执行）

```powershell
New-Item -ItemType Directory -Force -Path D:\xfer | Out-Null
cd D:\xfer
scp root@47.110.63.70:/tmp/pigcount-src-*.tar.gz .
scp root@47.110.63.70:/tmp/pigcounter-db-*.sql.gz .
scp root@47.110.63.70:/tmp/pigcount-images.tar .
scp root@47.110.63.70:/tmp/pigcount.sha256 .
```

**第二跳**：Windows 宿主 → VM

```powershell
scp D:\xfer\* pigadmin@192.168.1.50:/tmp/
ssh pigadmin@192.168.1.50 "ls -lh /tmp/pigcount* /tmp/pigcounter*"
```

> 传输慢的话：内网千兆链路下 1.6GB 约 3～5 分钟。**别用向日葵/远程桌面拖文件传 GB 级数据**
> （`MIGRATION_PLAN` 第七节已记过这个坑）。

**如果代码已经在宿主上**（宿主能上 GitHub，`git clone` 下来就有了），那 6.3 的 ① 跳过，
直接在宿主上打一个包推过去。注意开**两个窗口**：一个留在 VM 的 ssh 会话里，一个在宿主上发命令。

```bash
# ① 先在 VM 里把落地目录建好（否则 scp 会报 No such file or directory）
sudo mkdir -p /opt/pig-counter /tmp/xfer && sudo chown -R "$USER:$USER" /opt/pig-counter
```

```powershell
# ② 宿主上另开一个 PowerShell
$vm  = "pigadmin@192.168.1.50"                 # ← 改成 VM 的用户名@IP
$src = "D:\Code\pig-smart-count\pig-counter"   # ← 改成 clone 下来的目录

cd $src
mkdir -p "$env:TEMP\xfer" -Force
tar -czf "$env:TEMP\xfer\pigcounter-src.tar.gz" --exclude=node_modules --exclude=.venv .
scp "$env:TEMP\xfer\pigcounter-src.tar.gz" "${vm}:/tmp/xfer/"
```

```bash
# ③ 回到 VM 解包
cd /opt/pig-counter && tar -xzf /tmp/xfer/pigcounter-src.tar.gz && ls -la
```

> **别用 `scp -r .\*`**：PowerShell 的 `*` 不匹配点开头的文件，`.git`、`.dockerignore`、`.gitignore` 都会漏，
> 而且几千个小文件的元数据开销比单个 tar 慢很多。
> **也别 `sudo tar -xzf`**：解出来的文件归 root，后面 `npm run build` 和改配置会很难受。
>
> **如果手里是 zip 而不是目录**：`unzip -l xxx.zip | head -15` 先看清有没有顶层目录，
> 再 `unzip -q xxx.zip -d /opt/pig-counter`。顶层目录名会决定 compose 项目名
> （`pig-counter-main` → 卷 `pig-counter-main_mysql_data`），所以务必用 `.env` 里的
> `COMPOSE_PROJECT_NAME=pig-counter` 钉死；zip 还会丢掉可执行位，但本仓库没有 `.sh` 脚本，无影响。
> 另外别把 Windows 上装好的 `node_modules/` 一起带过去——`@rollup/rollup-win32-*` 这些平台二进制
> 在 Linux 下会报 `Cannot find module @rollup/rollup-linux-x64-gnu`，删掉重装即可。
>
> clone 出来的仓库**天生缺两样**，必须补：`dist/`（`.gitignore` 第 6 行忽略，见第 7 节）
> 和 `.env`（第 16 行忽略，见 6.6）。另外在 Windows 上 clone 再传过去，仓库没有 `.gitattributes`，
> 换行符可能是 CRLF——落地后顺手验一下：`grep -c $'\r' backend/Dockerfile`（期望 `0`，
> 非 0 就 `sudo apt install -y dos2unix && dos2unix backend/Dockerfile`）。

**通道 C（SMB）的写法**（VM 无法 SSH 出去时的备选）：

```powershell
New-SmbShare -Name "xfer" -Path "D:\xfer" -FullAccess "Administrator"
```

```bash
sudo apt -y install cifs-utils
sudo mkdir -p /mnt/xfer
sudo mount -t cifs //192.168.1.10/xfer /mnt/xfer -o username=Administrator,vers=3.0
ls -lh /mnt/xfer
sudo umount /mnt/xfer        # 用完卸载
```

### 6.5 校验（别省这一分钟，坏包排错很痛苦）

```bash
cd /tmp
sha256sum -c pigcount.sha256
```

期望三行全 `OK`。

### 6.6 落盘

```bash
cd /opt/pig-counter
tar -xzf /tmp/pigcount-src-*.tar.gz
ls -la
# 期望看到：docker-compose.yml  nginx.conf  dist/  backend/

# 确认三样关键文件都在
ls -l nginx.conf docker-compose.yml
ls -l backend/model/pig_count.onnx backend/excel_template_v2.xlsx backend/mysql_init.sql
ls dist/index.html
```

创建 `.env`（**只在仓库根，不进镜像**，见 `.dockerignore`）：

```bash
cd /opt/pig-counter
cat > .env <<'EOF'
# 水印 OCR（阿里云 DashScope）。留空则水印识别不可用，其它功能正常
OCR_API_KEY=sk-把这里换成真实key
# 显式锁定 compose 项目名，保证卷名是 pig-counter_mysql_data
COMPOSE_PROJECT_NAME=pig-counter
EOF

chmod 600 .env
```

> **注意**：`docker-compose.yml` 里只有 `OCR_API_KEY` 一处用了 `.env` 变量替换
> （`OCR_API_KEY=${OCR_API_KEY:-}`）。数据库密码 `pig_counterMysql` 是**硬编码在 compose 和 Dockerfile 里的**，
> 不要试图用 `.env` 改它——改了 compose 但没改 `mysql_init`/环境变量会导致后端连不上库。

---

## 7. 阶段六：前端产物（dist）

### 7.1 直接用包里带的 dist（推荐，省 90% 时间）

nginx 把宿主目录 `./dist` 挂到 `/usr/share/nginx/html`，只要文件在，**不需要 Node、不需要构建**。

```bash
ls -l /opt/pig-counter/dist/index.html
du -sh /opt/pig-counter/dist          # 约 8MB
```

### 7.2 想在 VM 里自己改前端再构建

仅当你需要改前端代码时做。**不需要 `--build`，改完 `npm run build` 后 nginx 直接生效（bind 挂载）**。

```bash
# 1) 装 Node 22 LTS（Ubuntu 22.04 自带 nodejs 只有 12.x，不能用）
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v && npm -v

# 2) 换 npm 源并构建
cd /opt/pig-counter/frontend
npm config set registry https://registry.npmmirror.com
npm ci                 # 仓库里带 package-lock.json，用 ci 而不是 install
npm run build          # 产物输出到 ../dist（vite.config.js 里 outDir: '../dist'）

# 3) 验证
ls -l /opt/pig-counter/dist/index.html
```

> `frontend/` 源码默认不在 6.3 的代码包里。需要就在源服务器上把 `frontend` 加进 tar
> （但排除 `node_modules`）。

### 7.3 dist 的验证

```bash
ls /opt/pig-counter/dist | head
# 期望至少有：index.html  assets/
```

`dist/` 为空或不存在 → 访问 8888 会 403/404（见 12.7）。

---

## 8. 阶段七：启动服务

### 8.1 加载镜像（路线 B）

```bash
docker load -i /tmp/pigcount-images.tar
docker images | grep -E "pig-counter-backend|mysql|nginx"
```

期望看到 `pig-counter-backend`、`mysql:8.0`、`nginx:latest` 三个。

**路线 A（VM 能上网）**：跳过 `docker load`，在后面 `docker compose up -d --build` 时现场构建。
首次构建依赖 Dockerfile 里已配好的清华 PyPI 源和 Debian 源，约 1～3 分钟。
构建完成后确认镜像名：

```bash
docker images | grep pig-counter-backend
```

> **两者都做了也不会错**：compose 只在镜像不存在或显式 `--build` 时才构建。
> 已经 `load` 进来的 `pig-counter-backend` 会被直接复用。

### 8.2 只起 mysql

```bash
cd /opt/pig-counter
docker compose up -d mysql

# 等它真正就绪（不是看 Up，要看能接受连接）
until docker exec pig-count-mysql mysqladmin ping -uroot -ppig_counterMysql --silent; do
  echo "等待 MySQL 就绪..."; sleep 3
done
echo "MySQL 已就绪"

docker compose ps
docker compose logs --tail=20 mysql
```

首次启动会自动执行 `backend/mysql_init.sql` 建表（**只在空数据卷时执行**）。

### 8.3 导入数据库

```bash
# 导入（语句较小，1MB net-buffer，一般不需要额外参数；报 packet too large 见 12.11）
gunzip -c /tmp/pigcounter-db-*.sql.gz | \
  docker exec -i pig-count-mysql mysql -uroot -ppig_counterMysql \
    --default-character-set=utf8mb4 pig_counter

# 校验行数（与源服务器对比）
docker exec pig-count-mysql mysql -uroot -ppig_counterMysql -e "
  SELECT table_name, table_rows FROM information_schema.tables
  WHERE table_schema='pig_counter' ORDER BY table_name;"
```

**时区校验（最容易漏的一步，`DEPLOYMENT_LOG` 里已经重复踩过两次）**：

```bash
docker exec pig-count-mysql mysql -uroot -ppig_counterMysql \
  -e "SELECT now() AS now_bj, curdate() AS today, @@time_zone, @@system_time_zone;"
```

期望 `now_bj` 是**北京时间**（不是 UTC），`today` 是北京日期。
如果差 8 小时 → 检查 `docker-compose.yml` 里 mysql 服务的 `TZ=Asia/Shanghai` 是否还在。

### 8.4 起全部服务

**路线 A（现场构建）**：

```bash
cd /opt/pig-counter
docker compose up -d --build
```

**路线 B（复用已 load 的镜像，不构建）**：

```bash
cd /opt/pig-counter
docker compose up -d
```

```bash
docker compose ps
# 期望三个都是 Up，且状态列没有 restarting

docker compose logs --tail=30 backend
```

后端启动时会做两件事，日志里能看到：

- 加载 ONNX 模型（模型缺失会直接 `RuntimeError` 崩掉，容器反复重启 → 见 12.6）
- 启动每天 03:00 的日志清理定时任务，打印 `[定时清理] 已启动，每天凌晨3:00执行`

### 8.5 冒烟测试（在 VM 里先跑一遍）

```bash
# 1) 后端健康检查（直连 127.0.0.1:8866）
curl -s http://127.0.0.1:8866/api/health
# 期望：{"status":"healthy","model_path":"/app/model/pig_count.onnx","model_exists":true,"runtime":"opencv-dnn"}

# 2) 走 nginx（对外入口）
curl -s http://127.0.0.1:8888/api/health
curl -s -o /dev/null -w '首页 HTTP %{http_code}\n' http://127.0.0.1:8888/

# 3) 统计接口（验证数据库连通）
curl -s http://127.0.0.1:8888/api/detection-stats

# 4) 猪场列表
curl -s http://127.0.0.1:8888/api/farms
```

---

## 9. 阶段八：对外访问

### 9.1 外部交换机（本文默认方案）

VM 拿到的是局域网真实 IP，客户端**直接访问 `http://192.168.1.50:8888`**，不经过 Windows 宿主，
宿主的 Windows 防火墙也不参与转发。

验证：

```powershell
# 在 Windows 宿主上
Test-NetConnection 192.168.1.50 -Port 8888
Invoke-WebRequest http://192.168.1.50:8888/api/health -UseBasicParsing | Select-Object -Expand Content
```

再到**任意一台内网客户机**上用浏览器打开 `http://192.168.1.50:8888`。

> 前端 axios 的 `baseURL` 是相对路径 `/api`（`frontend/src/api/http.js`），
> **没有硬编码 host**，所以换 IP、换域名访问都不用改代码。

### 9.2 客户端只认 Windows 主机 IP 时

有些客户的防火墙策略只放通"服务器 IP"，那就让宿主做 8888 端口转发：

```powershell
# 1) 宿主防火墙放行
New-NetFirewallRule -DisplayName "PigCount 8888 -> VM" -Direction Inbound `
  -Protocol TCP -LocalPort 8888 -Action Allow

# 2) 端口转发到 VM
netsh interface portproxy add v4tov4 `
  listenaddress=0.0.0.0 listenport=8888 `
  connectaddress=192.168.1.50 connectport=8888

# 3) 查看 / 删除
netsh interface portproxy show v4tov4
# netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=8888
```

> 此时 `http://192.168.1.10:8888`（宿主 IP）和 `http://192.168.1.50:8888`（VM IP）**都能用**。
> 注意 `portproxy` 是内核态转发，重启后**会保留**，但依赖 `iphlpsvc` 服务。

### 9.3 无法桥接时的 NAT 方案

某些交换机开了端口安全/MAC 绑定，外部虚拟交换机会拿不到 IP。此时改用 NAT：

```powershell
# 宿主上：建内部交换机 + NAT
New-VMSwitch -Name "vSwitch-NAT" -SwitchType Internal
$if = Get-NetAdapter -Name "vEthernet (vSwitch-NAT)"
New-NetIPAddress -IPAddress 192.168.88.1 -PrefixLength 24 -InterfaceIndex $if.ifIndex
New-NetNat -Name "pigcount-nat" -InternalIPInterfaceAddressPrefix 192.168.88.0/24

# 把 VM 网卡改接到 NAT 交换机
Connect-VMNetworkAdapter -VMName "pig-count-vm" -SwitchName "vSwitch-NAT"
```

VM 里把 IP 改成 `192.168.88.10/24`、网关 `192.168.88.1`（netplan 按 4.1 改），然后在宿主上做 9.2 的
`portproxy` + 防火墙规则。DNS 仍用 `223.5.5.5`。

> NAT 方案下 VM 访问外网需要宿主开启路由转发与 NAT（`New-NetNat` 已包含），
> 但**外部客户端只能通过宿主 IP:8888 访问**。

### 9.4 本次部署的实际网络参数（2026-10-31）

以下为客户现场已交付的实测配置，可用来对照上文示例（`192.168.1.x`）：

| 项 | 实际值 |
|:--|:--|
| Windows 宿主 IP | `192.168.250.1` |
| Ubuntu VM IP | `192.168.250.2` |
| 虚拟网络类型 | Hyper-V NAT（内部交换机 + `New-NetNat`），网段 `192.168.250.0/24` |
| VM 网关 / DNS | `192.168.250.1` |
| 项目入口 | `http://192.168.250.2:8888` |
| 对外端口 | 仅 8888；8866 与 3307 绑 `127.0.0.1`，外部不可达 |

宿主机上验证：

```powershell
Test-NetConnection 192.168.250.2 -Port 8888
Invoke-WebRequest http://192.168.250.2:8888/api/health -UseBasicParsing | Select-Object -Expand Content
```

VM 内验证：

```bash
ip -4 addr show | grep 192.168.250
ip route | head -3          # default via 192.168.250.1
curl -s http://127.0.0.1:8888/api/health
```

> **能访问的范围**：`192.168.250.2:8888` 是 VM 在 NAT 网段内的地址，宿主与 VM 同网段，可直接访问。
> 其他内网客户机若要访问，需二选一：① 在宿主上按 9.2 做 `portproxy`，客户端改用宿主 IP:8888；
> ② 改接外部交换机（9.1），让 VM 直接持有局域网 IP。

---

## 10. 阶段九：验收清单

按顺序执行，全部通过才算交付。

| # | 检查 | 命令 | 期望 |
|:--|:--|:--|:--|
| 1 | 容器状态 | `docker compose ps` | 三个容器 `Up`，无 `Restarting` |
| 2 | 镜像就位 | `docker images \| grep pig-counter-backend` | 有镜像，`CREATED` 时间合理 |
| 3 | 容器内文件 | `docker exec pig-count-backend ls /app/app.py /app/model/pig_count.onnx /app/excel_template_v2.xlsx` | 三个都列出 |
| 4 | 健康检查 | `curl -s http://127.0.0.1:8888/api/health` | `"status":"healthy"`、`"model_exists":true` |
| 5 | 首页 | `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8888/` | `200` |
| 6 | 数据量 | `curl -s http://127.0.0.1:8888/api/detection-stats` | `total_images` 与源库一致（2500） |
| 7 | 表结构 | 见 8.3 的 `information_schema` 查询 | 四张表：`detection_records` / `pig_farms` / `watermark_data` / `system_logs` |
| 8 | 时区 | 见 8.3 的 `SELECT now()` | 北京时间，`today` 正确 |
| 9 | 端口暴露面 | 客户端执行 `telnet <VM-IP> 8866` 和 `3307` | **连不上**（只有 8888 通） |
| 10 | 防火墙 | `sudo ufw status` | 只有 22、8888 放行 |
| 11 | 单张识别 | 浏览器上传一张猪舍图 | 出标注图 + 计数，无报错 |
| 12 | 水印 OCR | 上传带水印的图 | 有蓝色水印标签（无 `OCR_API_KEY` 时本项跳过，其余正常） |
| 13 | 批量识别 | 上传 40+ 张的文件夹 | 不 502、能出 Excel 报表 |
| 14 | 统计页 | 打开统计页 | 图表有数据、时间轴为北京时间 |
| 15 | 重启自愈 | `Restart-Computer` 重启宿主，等 5 分钟 | VM 自动启动，三容器自动恢复，8888 可访问 |

> 第 15 条最容易漏。若 VM 没起来，检查 `Set-VM -AutomaticStartAction`（2.3 已配）；
> 若 VM 起来了但容器没起，检查 `restart: unless-stopped` 与 `systemctl is-enabled docker`。

---

## 11. 阶段十：运维

### 11.1 开机自启链

三层都要通，缺一层重启后就起不来：

| 层 | 配置 | 检查命令 |
|:--|:--|:--|
| Windows → VM | `Set-VM -AutomaticStartAction Start -AutomaticStartDelay 30` | `Get-VM \| Select-Object Name, AutomaticStartAction, AutomaticStartDelay` |
| Docker 服务 | `systemctl enable docker` | `systemctl is-enabled docker` |
| 容器 | compose 里已有 `restart: unless-stopped` | `docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' pig-count-backend` |

> `AutomaticStartDelay 30` 是给宿主网络与存储留初始化时间，别设成 0。
> `unless-stopped` 的含义：**人工 `docker compose stop` 的容器重启后不会自动起来**，
> 这是设计意图；要恢复就 `docker compose start`。

### 11.2 备份

数据库是唯一不可重建的东西（镜像、代码、dist 都能重做）。

```bash
sudo mkdir -p /var/backups/pigcounter
sudo tee /usr/local/bin/pigcount-backup.sh >/dev/null <<'EOF'
#!/usr/bin/env bash
# 每天 02:00 备份 MySQL，保留 14 天
set -euo pipefail
DEST=/var/backups/pigcounter
mkdir -p "$DEST"
FILE="$DEST/db-$(date +%F).sql.gz"
docker exec pig-count-mysql mysqldump -uroot -ppig_counterMysql \
  --single-transaction --routines --triggers \
  --default-character-set=utf8mb4 pig_counter | gzip > "$FILE"
# 保留最近 14 天
find "$DEST" -name 'db-*.sql.gz' -mtime +14 -delete
echo "$(date '+%F %T') backup ok: $FILE ($(du -h "$FILE" | cut -f1))"
EOF

sudo chmod +x /usr/local/bin/pigcount-backup.sh

# 立即跑一次验证
sudo /usr/local/bin/pigcount-backup.sh
ls -lh /var/backups/pigcounter/

# 加定时任务
( sudo crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/pigcount-backup.sh >> /var/log/pigcount-backup.log 2>&1" ) | sudo crontab -
sudo crontab -l
```

**备份一定要拷出这台机器**（VM 磁盘挂了备份一起没）。拷到 Windows 宿主，用「计划任务 + 免密 scp」每天 03:00 自动拉。节奏是 **VM 02:00 备份 → 宿主 03:00 拉取**，顺序别反。

下面用本次部署的实际参数举例：VM 是 `ubuntu@192.168.250.2`，宿主落盘目录 `D:\backup\pigcount`。用户名和 IP 换成你自己的。

#### 第 1 步：确认 VM 上确实有备份文件

```bash
ls -lh /var/backups/pigcounter/
sudo crontab -l
sudo tail -5 /var/log/pigcount-backup.log
```

没有 `db-YYYY-MM-DD.sql.gz` 就先回去把上一节做完，否则拉取永远是空的。

#### 第 2 步：宿主准备目录与 OpenSSH 客户端

```powershell
# 必须以管理员身份运行 PowerShell
Get-WindowsCapability -Online | Where-Object Name -like 'OpenSSH.Client*'
# State 不是 Installed 就装：
Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0

New-Item -ItemType Directory -Force -Path C:\ProgramData\pigcount, D:\backup\pigcount, D:\backup\logs
```

#### 第 3 步：配免密登录（计划任务没法输密码）

```powershell
ssh-keygen -t ed25519 -f C:\ProgramData\pigcount\id_ed25519 -C "pigcount-backup@$env:COMPUTERNAME"
```

提示 `Enter passphrase` 时**连按两次回车**（空口令）。

> 这里故意不写 `-N ""`：Windows PowerShell 5.1 会把空字符串参数整个丢掉，ssh-keygen 收到的命令变成 `-N -C "pigcount-backup@主机名"`，把 `-C` 当成口令值，剩下的主机名变成多余参数，报 `Too many arguments.`。想要全自动不交互，用 `cmd /c` 包一层：`cmd /c 'ssh-keygen -t ed25519 -f C:\ProgramData\pigcount\id_ed25519 -N "" -C "pigcount-backup@主机名"'`。

然后把公钥推到 VM（这一步要输一次 VM 密码）：

```powershell
Get-Content C:\ProgramData\pigcount\id_ed25519.pub |
  ssh ubuntu@192.168.250.2 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

收紧私钥权限，否则 OpenSSH 会以权限过宽为由拒绝使用：

```powershell
icacls C:\ProgramData\pigcount\id_ed25519 /inheritance:r /grant:r "SYSTEM:(R)" /grant:r "BUILTIN\Administrators:(F)"
```

跑完用 `icacls C:\ProgramData\pigcount\id_ed25519` 再确认一遍：DACL 里**只剩** `SYSTEM` 和 `BUILTIN\Administrators` 两项，不该有 `BUILTIN\Users`，也不该有 `Administrator` 这种单个用户项。

注意 `/inheritance:r` 只删**继承**来的 ACE、`/grant:r` 只替换**同名 SID** 的 ACE，都不动其它显式项。若还残留一条（例如 `主机名\Administrator:(M)`），用 `/remove` 删掉：

```powershell
icacls C:\ProgramData\pigcount\id_ed25519 /remove "主机名\Administrator"
```

> 这一步是整套流程里最容易漏的一处，而且 ssh 的判定看**两个条件**，只修一个不够：
>
> - **DACL**：除「当前用户 / `SYSTEM` / `BUILTIN\Administrators`」之外不能再有别的 ACE；
> - **所有者**：文件所有者本身也必须是这三者之一。
>
> 私钥是你用 Administrator 建的，所有者就是 Administrator。`icacls` 动的只是 DACL，不会改所有者，于是会出现「DACL 明明只剩两项、任务仍报 `Permissions for ... are too open`」的怪现象。补一句把所有者改成 SYSTEM 即可：
>
> ```powershell
> icacls C:\ProgramData\pigcount\id_ed25519 /setowner "NT AUTHORITY\SYSTEM"
> ```
>
> 若报「拒绝访问」，先 `takeown /f C:\ProgramData\pigcount\id_ed25519` 再设。改完所有者后，管理员手工验证与 `SYSTEM` 计划任务**两边都能过**。
>
> 为什么手工能过、任务偏不过：ssh 是拿**当前进程用户**去比对那张 ACL 的。管理员会话里「当前用户」本身就在授权列表内，ACL 偏松也能通过；换成 `SYSTEM` 身份后这份豁免消失，问题才暴露出来。而它报的 `Permission denied (publickey)` 又被 Task Scheduler 吞掉，账号表面只能看到一个 `LastTaskResult: 1`。

验证——**必须一次都不提示密码**，否则第 5 步的任务会一直挂着：

```powershell
ssh -i C:\ProgramData\pigcount\id_ed25519 -o BatchMode=yes ubuntu@192.168.250.2 "ls -lh /var/backups/pigcounter/"
```

#### 第 4 步：写拉取脚本

```powershell
# 保存为 C:\ProgramData\pigcount\pull-backup.ps1
$ErrorActionPreference = 'Stop'

$VM     = 'ubuntu@192.168.250.2'
$Dir    = '/var/backups/pigcounter'
$Dest   = 'D:\backup\pigcount'
$LogDir = 'D:\backup\logs'
$Key    = 'C:\ProgramData\pigcount\id_ed25519'
$Known  = 'C:\ProgramData\pigcount\known_hosts'
$SSH    = 'C:\Windows\System32\OpenSSH\ssh.exe'
$SCP    = 'C:\Windows\System32\OpenSSH\scp.exe'
$Opts   = @('-i', $Key,
            '-o', 'BatchMode=yes',
            '-o', 'StrictHostKeyChecking=accept-new',
            '-o', "UserKnownHostsFile=$Known",
            '-o', 'ConnectTimeout=30')

New-Item -ItemType Directory -Force -Path $Dest, $LogDir | Out-Null
$Log = Join-Path $LogDir ('pull-{0:yyyyMMdd}.log' -f (Get-Date))
function Say($m) {
    Add-Content -Path $Log -Value ('{0}  {1}' -f (Get-Date -Format 'HH:mm:ss'), $m) -Encoding utf8
}

try {
    Say '=== 开始拉取 ==='

    # 只取远端最新的一个文件，避免每晚把 14 个文件全拷一遍
    $latest = (& $SSH @Opts $VM "ls -1t $Dir/db-*.sql.gz 2>/dev/null | head -1").Trim()
    if (-not $latest) { Say '远端没有备份文件，退出'; exit 2 }
    Say "远端最新: $latest"

    $name  = Split-Path $latest -Leaf
    $local = Join-Path $Dest $name
    if (Test-Path $local) { Say "本地已存在，跳过: $name"; exit 0 }

    $sw  = [Diagnostics.Stopwatch]::StartNew()
    $out = & $SCP @Opts "${VM}:${latest}" $Dest 2>&1
    if ($out) { Say ($out -join ' ') }
    if ($LASTEXITCODE -ne 0) { Say "scp 失败，退出码 $LASTEXITCODE"; exit $LASTEXITCODE }
    Say ('完成 {0}，耗时 {1:N1}s' -f $name, $sw.Elapsed.TotalSeconds)

    # 本地保留 14 天
    $cut = (Get-Date).AddDays(-14)
    Get-ChildItem $Dest -Filter 'db-*.sql.gz' |
        Where-Object { $_.LastWriteTime -lt $cut } |
        ForEach-Object { Say "删除过期: $($_.Name)"; Remove-Item $_.FullName -Force }

    Say '=== 结束 ==='
    exit 0
}
catch {
    Say "异常: $($_.Exception.Message)"
    exit 1
}
```

> **这个脚本必须存成「UTF-8 with BOM」或者纯 ASCII**。Windows PowerShell 5.1 读 `.ps1` 时如果开头没有 BOM，会按系统 ANSI 代码页（简体中文是 GBK）解码，脚本里的中文就变成乱码；更麻烦的是 GBK 是双字节编码，一个乱码字符会把紧跟其后的引号一起吞掉，于是报 `字符串缺少终止符`，而计划任务只会给你一个 `LastTaskResult: 1`、连日志文件都不会生成，很难看出是编码问题。用记事本另存时选 `UTF-8 with BOM`，或者用 PowerShell 写文件：
>
> ```powershell
> $code = @'
> ……脚本内容……
> '@
> [IO.File]::WriteAllText('C:\ProgramData\pigcount\pull-backup.ps1', $code, (New-Object System.Text.UTF8Encoding($true)))
> ```
>
> 顺带提醒：`[scriptblock]::Create([IO.File]::ReadAllText($p))` 这种语法自检**查不出这个问题**——`ReadAllText` 默认按 UTF-8 解码，跟 `powershell.exe -File` 的解码方式不同，所以会给出「语法 OK」的假阳性。要验就验文件头三个字节是不是 `EF BB BF`。

#### 第 5 步：注册计划任务

```powershell
$action = New-ScheduledTaskAction `
  -Execute 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe' `
  -Argument '-NoProfile -ExecutionPolicy Bypass -File "C:\ProgramData\pigcount\pull-backup.ps1"'

$trigger = @(
    New-ScheduledTaskTrigger -Daily -At 03:00
    New-ScheduledTaskTrigger -Daily -At 04:30     # 第一次没拉成时的补跑
)

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
  -MultipleInstances IgnoreNew `
  -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 10)

Register-ScheduledTask -TaskName 'PigCount-Daily-Backup' `
  -Action $action -Trigger $trigger -Settings $settings `
  -Principal (New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest) `
  -Description '每天 03:00 从 Hyper-V Ubuntu VM 拉取 MySQL 备份到 D:\backup\pigcount'
```

两个参数的用意：`-StartWhenAvailable` 让 03:00 时机器关机或睡眠的情况在开机后补跑；以 `SYSTEM` 身份运行则不需要保存账户密码，也不要求有人登录。

#### 第 6 步：立刻验一次

```powershell
Start-ScheduledTask -TaskName 'PigCount-Daily-Backup'
Start-Sleep 30
Get-ScheduledTaskInfo -TaskName 'PigCount-Daily-Backup' | Format-List LastRunTime, LastTaskResult
Get-ChildItem D:\backup\pigcount | Sort-Object LastWriteTime -Descending | Select-Object -First 3
Get-Content (Get-ChildItem D:\backup\logs\pull-*.log | Sort-Object LastWriteTime -Desc | Select-Object -First 1) -Tail 10
```

`LastTaskResult` 为 `0` 代表成功，`267009`（0x41301）代表还在跑，`1` 就去日志里看原因。

#### 拉取失败对照

| 现象 | 原因 | 处理 |
|:--|:--|:--|
| 日志只有「远端没有备份文件」，退出码 2 | VM 上 02:00 的备份没跑成 | 去 VM 手工执行 `/usr/local/bin/pigcount-backup.sh` 再看日志 |
| `Permission denied (publickey)` | 公钥没追加成功，或用户名写错 | VM 上 `tail -1 ~/.ssh/authorized_keys`；确认是 `ubuntu@` 不是 `pigadmin@` |
| `UNPROTECTED PRIVATE KEY FILE` / `Bad permissions` | 私钥 ACL 太宽 | 重跑第 3 步的 `icacls` |
| 任务一直显示「正在运行」 | 卡在密码或 yes/no 提问 | 必须带 `-o BatchMode=yes`，少了它会一直等输入直到超时 |
| `Host key verification failed` | `known_hosts` 里是旧指纹（VM 重建过） | 删掉 `C:\ProgramData\pigcount\known_hosts` 再手动跑一次 |

> 私钥是无口令的，谁能读到谁就能登录 VM，第 3 步的 `icacls` 别省。更稳的做法是在 VM 的 `authorized_keys` 里限制来源与能力：把那一行改成
> `from="192.168.250.1",no-pty,no-agent-forwarding ssh-ed25519 AAAA...`，只允许宿主这台机器用它、且不能开终端。

**恢复演练**（新库上试，别在生产的库上试）：

```bash
gunzip -c /var/backups/pigcounter/db-2026-10-30.sql.gz | \
  docker exec -i pig-count-mysql mysql -uroot -ppig_counterMysql \
    --default-character-set=utf8mb4 pig_counter
```

### 11.3 发版 / 升级流程

**前端变更**（只改 `frontend/`）：

```bash
cd /opt/pig-counter
# 1) 同步代码（本机无 git 时用 scp 覆盖 frontend/ 与 dist/）
# 2) 重新构建
cd frontend && npm ci && npm run build && cd ..
# 3) nginx 是 bind 挂载，无需重启容器
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8888/
```

**后端变更**（改 `backend/`）：

```bash
cd /opt/pig-counter
docker compose up -d --build backend
docker compose logs --tail=30 backend
curl -s http://127.0.0.1:8866/api/health
```

**为什么两者不一样**：backend 的代码 `COPY . /app` 打进镜像了，**没有挂载**，必须重建；
nginx 只挂载 `./dist`，重新构建前端就生效。

**表结构变更**：`mysql_init.sql` **只在空数据卷时执行**，已有库要手工执行 SQL：

```bash
docker exec -i pig-count-mysql mysql -uroot -ppig_counterMysql pig_counter < 新结构.sql
```

### 11.4 Hyper-V 检查点（快照）策略

```powershell
# 升级前打一个（名字带日期）
Checkpoint-VM -Name "pig-count-vm" -SnapshotName "2026-10-30-pre-deploy"
Get-VMSnapshot -VMName "pig-count-vm"

# 回滚
Restore-VMSnapshot -VMName "pig-count-vm" -Name "2026-10-30-pre-deploy" -Confirm:$false
Start-VM -Name "pig-count-vm"
```

> **重要**：数据库运行中打的检查点是**崩溃一致性**快照（相当于直接拔电源），恢复后 InnoDB 会做崩溃恢复，
> 一般能起来但不保证零丢失。**要零丢失，先 `docker compose stop` 再打检查点**，或者信任 11.2 的 dump。
> 另外**别无限堆检查点**（会撑爆磁盘、拖慢 VM），只留最近 1～2 个，旧的删：`Remove-VMSnapshot`。

### 11.5 日常巡检命令

```bash
# 一键体检
cd /opt/pig-counter
docker compose ps
docker stats --no-stream
df -h /
docker system df
curl -s http://127.0.0.1:8888/api/health
docker exec pig-count-mysql mysql -uroot -ppig_counterMysql -e "SELECT now();"

# 磁盘回收（安全的那几个）
docker image prune -f          # 悬空镜像
docker builder prune -f        # 构建缓存（路线 A 构建后能省 2~3GB）
docker container prune -f      # 已停止容器
# 危险：docker volume prune 会删掉 mysql_data，永远不要在生产上跑
```

**MySQL 慢的话**加索引前先看 `SHOW PROCESSLIST`；本项目的热点查询已经有
`idx_detection_records_farm_id` / `idx_detection_records_created_at`。

---

## 12. 故障排查手册

按"现象 → 原因 → 处理"查表。**先看 `docker compose logs --tail=100 <服务>`**，八成的答案在那里。

### 12.1 Hyper-V 装完，`Get-Service vmms` 起不来

- 原因：hypervisor 未在启动项生效；或与其他虚拟化软件冲突
- 处理：再重启一次；`bcdedit /set hypervisorlaunchtype auto` 后重启；卸载 VMware/VirtualBox

### 12.2 VM 起不来 / 一直黑屏 / 提示"启动失败"

- 原因：宿主是虚拟机但没开嵌套虚拟化；或 Secure Boot 校验失败
- 处理：见 [1.2](#12-宿主自己是不是虚拟机)；`Set-VMFirmware -VMName "pig-count-vm" -EnableSecureBoot Off`

### 12.3 VM 装完没有网络 / IP 是 `169.254.x.x`

- 原因：外部交换机绑错网卡；交换机是"内部"类型；宿主网卡是 NIC Teaming 成员
- 处理：

  ```powershell
  Get-VMSwitch | Format-Table Name, SwitchType, NetAdapterInterfaceDescription
  Connect-VMNetworkAdapter -VMName "pig-count-vm" -SwitchName "vSwitch-External"
  ```

  VM 里 `sudo dhclient eth0` 或 `sudo netplan apply` 重试

### 12.4 装了 Hyper-V 之后宿主网络异常 / RDP 掉线

- 原因：外部交换机接管网卡（**正常现象，通常 10 秒内恢复**）
- 处理：等；仍不通则 `Get-NetAdapter` 看 `vEthernet (vSwitch-External)` 是否 Up，
  `Restart-NetAdapter -Name "vEthernet (vSwitch-External)"`

### 12.5 `docker pull` 报 `EOF` / `TLS handshake timeout`

- 原因：国内直连 Docker Hub 不稳定（`DEPLOYMENT_LOG` 编号 101 记过同类问题）
- 处理：**不要折腾加速器**，走路线 B：源服务器 `docker save` → `docker load`

### 12.6 后端容器反复重启（`Restarting (1)`）

```bash
docker compose logs --tail=50 backend
```

| 日志关键字 | 原因 | 处理 |
|:--|:--|:--|
| `RuntimeError: 模型文件不存在: /app/model/pig_count.onnx` | 构建上下文里缺模型 | 确认 `backend/model/pig_count.onnx` 存在，`docker compose up -d --build backend` |
| `OSError: /lib/x86_64-linux-gnu/libGL.so.1` | 镜像缺系统库（Dockerfile 已装 `libgl1-mesa-glx`） | 别改 Dockerfile 的 apt 段；确认构建没被缓存污染，`--no-cache` 重建 |
| `ModuleNotFoundError: watermark_ocr` | `backend/watermark_ocr.py` 没打进去 | 补文件后重建 |
| `pymysql.err.OperationalError (2003)` | 连不上 MySQL | 先 `docker compose up -d mysql`；确认在同一网络 `pig-count-network` |

### 12.7 打开 8888 是 403 / 404 / 空白页

- 原因：`./dist` 为空或不存在（**`dist/` 被 `.gitignore` 忽略，`git clone` 下来是没有的**）
- 处理：

  ```bash
  ls /opt/pig-counter/dist/index.html    # 不存在就得构建或从源服务器拷
  docker exec pig-count-nginx ls /usr/share/nginx/html | head
  ```

  前端改了但没重新 `npm run build`，也会出现"页面是旧的"

### 12.8 页面能打开，但所有接口 502

- 原因：backend 容器没起；或 nginx 找不到 `backend` 这个主机名（不在同一网络）
- 处理：

  ```bash
  docker compose ps                                  # backend 是否 Up
  docker exec pig-count-nginx ping -c1 backend       # 期望能解析并通
  docker network inspect pig-count-network
  curl -s http://127.0.0.1:8866/api/health           # 绕过 nginx 直连试试
  ```

### 12.9 页面时间早/晚 8 小时，"今日数据"边界不对

- 原因：mysql 容器 `TZ` 丢了。`created_at` 是 `TIMESTAMP`，内部存 UTC、读时按会话时区换算
- 处理：确认 `docker-compose.yml` 里 mysql 服务有 `TZ=Asia/Shanghai`，然后

  ```bash
  docker compose up -d mysql
  docker exec pig-count-mysql mysql -uroot -ppig_counterMysql -e "SELECT now();"
  ```

  **历史数据会自动纠正，不需要迁移**（`DEPLOYMENT_LOG` 编号 150）

### 12.10 上传大文件报 413 / 批量识别 502

- 413：请求体超过 `nginx.conf` 的 `client_max_body_size 500M`
- 502（60 秒后）：`proxy_read_timeout` 太短，批量 40+ 张图会超 60 秒
- 处理：确认 `nginx.conf` 里这两项还在，然后 `docker compose restart nginx`

### 12.11 导入 SQL 报 `Packet too large`

- 原因：单条语句超过服务端 `max_allowed_packet`
- 处理：

  ```bash
  # 客户端侧放宽（先试这个）
  gunzip -c dump.sql.gz | docker exec -i pig-count-mysql mysql \
    -uroot -ppig_counterMysql --max_allowed_packet=256M \
    --default-character-set=utf8mb4 pig_counter
  ```

  仍失败则在 compose 的 mysql 服务加 `command: --max-allowed-packet=256M` 后 `docker compose up -d mysql`

### 12.12 内存不足，容器被 OOM Killer 杀

```bash
free -h
dmesg -T | grep -i "killed process"
```

- 处理：VM 内存加到 8GB 以上（**关掉动态内存**，见 2.3）；
  MySQL 可加 `command: --innodb-buffer-pool-size=1G` 限住

### 12.13 磁盘满了

```bash
df -h /
docker system df
du -sh /var/lib/docker/*
```

- 常见元凶：镜像层堆积、构建缓存、**Docker 日志没限额**（5.2 已配）
- 处理：`docker builder prune -f`、`docker image prune -f`；VHDX 动态盘膨胀后宿主侧
  用 `Optimize-VHD -Path <vhdx> -Mode Full`（需先关机）

### 12.14 `docker compose` 命令不存在

- 原因：只装了 `docker.io`（老版本），没有 compose 插件
- 处理：按 [5.1](#51-官方源安装) 装 `docker-compose-plugin`；确认用 `docker compose`（空格）不是 `docker-compose`（连字符）

### 12.15 VM 时间一直不准

- 原因：Hyper-V 时间同步与 NTP 抢时钟
- 处理：二选一 —— 关掉 Hyper-V 集成服务里的"时间同步"，或停掉 VM 里的 `systemd-timesyncd`
  改由宿主校时。见 [4.3](#43-时间同步重点别跳过)

### 12.16 宿主重启后 VM 没起来

```powershell
Get-VM | Select-Object Name, State, AutomaticStartAction, AutomaticStartDelay
```

- 处理：`Set-VM -Name "pig-count-vm" -AutomaticStartAction Start -AutomaticStartDelay 30`

### 12.17 浏览器提示"接口超时"但 VM 里 curl 正常

- 原因：客户端所在网段被防火墙拦；或走了 9.2 的 portproxy 但宿主防火墙没放行
- 处理：客户端 `telnet <IP> 8888`；宿主

  ```powershell
  Test-NetConnection 192.168.1.50 -Port 8888
  Get-NetFirewallRule -DisplayName "PigCount*"
  ```

### 12.18 水印识别一直失败

- 原因：`OCR_API_KEY` 没配或过期；VM 无法访问 `dashscope.aliyuncs.com`
- 处理：

  ```bash
  docker exec pig-count-backend env | grep OCR
  curl -s -o /dev/null -w '%{http_code}\n' https://dashscope.aliyuncs.com/compatible-mode/v1
  ```

  密钥在 `.env` 里改完要 `docker compose up -d backend` 才生效（环境变量是启动时注入的）

### 12.19 构建后端时报 `403 Forbidden` / `repository is not signed`

`backend/Dockerfile` 把 apt 源和 pip 源都写成了清华镜像（`mirrors.tuna.tsinghua.edu.cn` /
`pypi.tuna.tsinghua.edu.cn`）。镜像站会对部分出口 IP 直接返回 403，apt 拿不到 `InRelease`
就报 `E: The repository ... is not signed.`——**这句是连带错误，不是签名配置问题**。

先在 VM 上确认是哪一类：

```bash
# 官方源通不通
curl -sS -o /dev/null -w 'debian.org %{http_code}\n' https://deb.debian.org/debian/dists/bookworm/InRelease
# 清华源返回什么、是谁返回的（看 Server 头能认出企业代理）
curl -sSI https://mirrors.tuna.tsinghua.edu.cn/debian/dists/bookworm/InRelease | head -6
# 其他国内源逐个试
for m in mirrors.aliyun.com mirrors.ustc.edu.cn mirrors.huaweicloud.com mirrors.cloud.tencent.com; do
  printf '%-32s %s\n' $m "$(curl -sS -o /dev/null -w '%{http_code}' https://$m/debian/dists/bookworm/InRelease)"
done
# pip 源（下一层要用，一起测）
curl -sS -o /dev/null -w 'pypi %{http_code}\n' https://pypi.tuna.tsinghua.edu.cn/simple/
```

- **只有清华源 403**：换掉 Dockerfile 里那两行（只需改 URL 主体，`debian-security` 会跟着变）：

  ```bash
  cd /opt/pig-counter/backend
  cp Dockerfile /tmp/Dockerfile.orig
  sed -i 's#https://mirrors.tuna.tsinghua.edu.cn/debian#https://mirrors.aliyun.com/debian#g' Dockerfile
  sed -i 's#https://pypi.tuna.tsinghua.edu.cn/simple#https://mirrors.aliyun.com/pypi/simple#g' Dockerfile
  git diff --stat Dockerfile          # 期望只有 2 行
  cd /opt/pig-counter && docker compose build backend
  ```

- **`deb.debian.org` 也 403 且响应头有 `Server: squid` 之类**：出口有企业代理，给构建传代理
  （`HTTP_PROXY`/`HTTPS_PROXY` 是 Docker 预定义 build-arg，不需要 Dockerfile 里声明 ARG）：

  ```bash
  docker compose build --build-arg HTTP_PROXY=http://proxy:port --build-arg HTTPS_PROXY=http://proxy:port backend
  ```

- **全都不通**：放弃现场构建，改走路线 B 的 `docker save` / `docker load`（见 8.1），
  之后起服务**不要再带 `--build`**，否则它又会去联网。

> 换源这一步是整个部署里唯一需要改动仓库文件的地方，改完记一笔，回滚时 `cp /tmp/Dockerfile.orig` 还原。

---

## 13. 回滚

部署失败需要退回旧环境时，按下面顺序：

| 场景 | 操作 |
|:--|:--|
| 目标机整个方案不要了 | Windows 上 `Remove-VM -Name "pig-count-vm" -Force`，再 `Remove-Item D:\Hyper-V\pig-count-vm -Recurse`；**旧服务器 `47.110.63.70` 全程只读导出，未做任何修改**，直接继续对外服务 |
| 目标机只是某个版本坏了 | `docker compose down backend` 后重建；或从 `docker save` 的 tar 里重新 `load` 回退镜像 |
| 数据被改坏 | 用 [11.3](#113-发版--升级流程) 之前的 dump 覆盖导入（会 **DROP TABLE**，先确认备份） |
| VM 起不来 | `Restore-VMSnapshot` 回滚检查点（先看 [11.4](#114-hyper-v-检查点快照策略) 的一致性提醒） |

**关键前提**：整个迁移过程对源服务器是**只读**的（只做 `git rev-parse`、`tar`、`mysqldump`、`docker save`），
**不要**在源服务器上执行 `docker compose down` 或改 `.env`。旧服务器要一直跑到新环境验收通过为止。

---

## 附录 A：一页命令速查

### Windows 侧

```powershell
# 装 Hyper-V
Install-WindowsFeature -Name Hyper-V -IncludeManagementTools -Restart

# 建交换机
Get-NetAdapter | Format-Table Name, Status
New-VMSwitch -Name "vSwitch-External" -NetAdapterName "Ethernet" -AllowManagementOS $true

# 建 VM
$vm="pig-count-vm"; $vhd="D:\Hyper-V\$vm\Virtual Hard Disks\$vm.vhdx"
New-Item -ItemType Directory -Force -Path (Split-Path $vhd) | Out-Null
New-VM -Name $vm -Generation 2 -MemoryStartupBytes 8GB -NewVHDPath $vhd -NewVHDSizeBytes 120GB -SwitchName "vSwitch-External"
Set-VMProcessor -VMName $vm -Count 4
Set-VMMemory -VMName $vm -DynamicMemoryEnabled $false
Add-VMDvdDrive -VMName $vm -Path "D:\ISO\ubuntu-22.04.5-live-server-amd64.iso"
Set-VMFirmware -VMName $vm -FirstBootDevice (Get-VMDvdDrive -VMName $vm)
Set-VM -Name $vm -AutomaticStartAction Start -AutomaticStartDelay 30 -AutomaticStopAction ShutDown
Start-VM -Name $vm; vmconnect.exe localhost $vm

# 装完切回硬盘启动
Set-VMFirmware -VMName $vm -FirstBootDevice (Get-VMHardDiskDrive -VMName $vm)
Set-VMDvdDrive -VMName $vm -Path $null

# 日常
Get-VM | Select Name, State, Uptime
Checkpoint-VM -Name $vm -SnapshotName "2026-10-30-pre-deploy"
```

### Ubuntu 侧

```bash
# 时区 / 固定 IP / 换源见 4.1~4.3
sudo timedatectl set-timezone Asia/Shanghai
sudo netplan try

# Docker（先按 5.1 配好官方源，否则 docker-ce 装不上）
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER && newgrp docker

# 部署
sudo mkdir -p /opt/pig-counter && sudo chown -R $USER:$USER /opt/pig-counter
cd /opt/pig-counter && tar -xzf /tmp/pigcount-src-*.tar.gz
printf 'OCR_API_KEY=%s\nCOMPOSE_PROJECT_NAME=pig-counter\n' "sk-xxx" > .env && chmod 600 .env

# 前端构建（只在没有 dist 可复用、要在 VM 里现编时做，见 7.2）
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
npm config set registry https://registry.npmmirror.com
(cd frontend && npm ci && npm run build)

docker load -i /tmp/pigcount-images.tar            # 路线 B
docker compose up -d mysql
until docker exec pig-count-mysql mysqladmin ping -uroot -ppig_counterMysql --silent; do sleep 3; done
gunzip -c /tmp/pigcounter-db-*.sql.gz | docker exec -i pig-count-mysql mysql -uroot -ppig_counterMysql --default-character-set=utf8mb4 pig_counter
docker compose up -d --build                       # 路线 A；路线 B 用 docker compose up -d

# 验收
curl -s http://127.0.0.1:8888/api/health
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8888/
docker compose ps
```

---

## 附录 B：新旧环境对照

| 项 | 旧：阿里云 CentOS 系 | 新：Hyper-V Ubuntu 22.04 |
|:--|:--|:--|
| 路径 | `/opt/pig-counter/pig-counter` | `/opt/pig-counter` |
| 项目名 | `pig-counter` | `pig-counter`（`COMPOSE_PROJECT_NAME` 锁定） |
| 访问地址 | `http://47.110.63.70:8888` | `http://192.168.250.2:8888`（现场实测） |
| 容器 | `pig-count-nginx` / `-backend` / `-mysql` | 同名（`container_name` 固定） |
| 端口 | nginx 8888 对外；8866/3307 仅 127.0.0.1 | 完全一致 |
| 数据卷 | `pig-counter_mysql_data` | 同名 |
| 时区 | mysql `TZ=Asia/Shanghai` | 必须一致，**宿主也要设** |
| 代码基线 | 以源服务器 `git rev-parse --short HEAD` 为准 | 同 |
| 镜像来源 | 本地构建 | 现场构建（A）或 `docker save/load`（B） |
| 数据规模 | 2500 条记录 / 约 681MB | 迁移后应一致 |
| 防火墙 | 阿里云安全组 | ufw 22 + 8888 |
| 发版方式 | `git fetch && git reset --hard origin/main` | 本机无 git 时用 scp 覆盖；有 git 时同样流程 |
| 备份 | 无 | `/var/backups/pigcounter` + 每日 02:00 cron |

---

## 附录 C：本次部署不修改任何源码

整个部署过程**不需要改动仓库里的任何文件**，用到的都是既有内容：

| 文件 | 作用 | 是否改动 |
|:--|:--|:--|
| `docker-compose.yml` | 三服务编排 | 否 |
| `nginx.conf` | 静态 + `/api` 反代、500M、600s | 否 |
| `backend/Dockerfile` | `python:3.11-slim-bookworm` + 清华源 | 否 |
| `backend/requirements.txt` | Python 依赖 | 否 |
| `backend/mysql_init.sql` | 建表（仅空卷时执行） | 否 |
| `backend/model/pig_count.onnx` | ONNX 模型 | 否（必须存在） |
| `backend/excel_template_v2.xlsx` | Excel 导出模板 | 否（必须存在） |
| `dist/` | 前端产物，nginx bind 挂载 | 否（必须存在） |
| `.env` | 仅 `OCR_API_KEY` 与项目名 | **新建**，不入库 |

唯一需要新建的是宿主上的 `.env`。如果部署过程中发现必须改 compose（例如加 `--max-allowed-packet`），
把它当成"目标环境差异"记到 `docs/wheel/DEPLOYMENT_LOG.md`，不要静默改完就算。
