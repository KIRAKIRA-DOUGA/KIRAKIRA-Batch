![Cover](cover.gif)

# KIRAKIRA-Batch
该存储库用于存储批处理脚本。  
通常情况下，这些脚本会被打包为容器镜像，并由 Kubernetes Cronjob 定期调度。

> A *CronJob* creates Jobs on a repeating schedule.  
> CronJob is meant for performing regular scheduled actions such as backups, report generation, and so on. One CronJob object is like one line of a crontab (cron table) file on a Unix system. It runs a Job periodically on a given schedule, written in Cron format.  
> —— kubernetes

### 构建
为了方便 Kubernetes Cronjob 调度批处理脚本，建议将其打包为容器镜像。
``` sh
# 创建并启用新的 builder 实例（如果以前创建过，则跳过这步）
docker buildx create --name mybuilder --use

# 启动并检查 builder 实例
docker buildx inspect --bootstrap

# 构建并推送多平台镜像到 Docker Hub
# 请确保安装 docker 并且 docker 已经登录/连接了远程容器镜像存储库，这里使用 your-container-registry/kirakira-batch
# 请替换 <tag> 为正确的版本号，例如：3.24.0
#                                                                                                             ↓ 注意这里有个点「.」，复制语句的时候别落下
docker buildx build --platform linux/amd64,linux/arm64 -t your-container-registry/kirakira-batch:<tag> --push .
```
然后编写 Cronjob 声明文件如下：
sync-mongodb-secret.yaml
``` yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: sync-mongodb-secret
  namespace: kirakira-rosales
spec:
  schedule: "0 6 * * 6" # 五位 Cron 表达式，指定调度频率
  timeZone: "Asia/Shanghai"  # UTC+8
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: sync-mongodb-secret-batch-user # 指定一个有正确 RBAC 权限的用户
          containers:
          - name: secret-copy
            image: your-container-registry/kirakira-batch:X.X.X # 请指定正确版本
            command: ["node", "./kirakira-batch/sync-mongodb-secret.js"] # 执行 Js 脚本，注意路径需要和打包时指定的一致
            envFrom:
            - secretRef:
                name: kirakira-rosales-aws-ses-smtp-secret # 指定执行时需要的配置文件和密钥
          restartPolicy: OnFailure
```
应用 Cronjob 声明文件
``` sh
kubectl apply -f sync-mongodb-secret.yaml
```
