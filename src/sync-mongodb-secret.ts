import k8s from '@kubernetes/client-node'
import { sendMail } from './common/EmailTool.js'

// Initialize Kubernetes client
const kc = new k8s.KubeConfig()
kc.loadFromDefault()
const k8sApi = kc.makeApiClient(k8s.CoreV1Api)
const appsV1Api = kc.makeApiClient(k8s.AppsV1Api)

async function copySecretAndUpdateDeployment() {
	try {
		const now = new Date().toISOString()
		const nowTimestamp = `${new Date().getTime()}`

		const mongodbCertSecret = (await k8sApi.readNamespacedSecret('mongodb-cert-key-pair', 'kirakira-mongodb')).body
		if (!mongodbCertSecret.data) {
			throw new Error('newSecret.data is undefined')
		}

		const ca = mongodbCertSecret.data?.['ca.crt']
		const cert = mongodbCertSecret.data?.['tls.crt']
		const key = mongodbCertSecret.data?.['tls.key']

		const caBase64 = Buffer.from(ca).toString('base64')
		const certBase64 = Buffer.from(cert).toString('base64')
		const keyBase64 = Buffer.from(key).toString('base64')

		const rosalesCertSecret = (await k8sApi.readNamespacedSecret('kirakira-rosales-mongodb-secret', 'kirakira-rosales')).body

		if (!rosalesCertSecret.data?.MONGODB_PROTOCOL) {
			throw new Error('rosalesCertSecret.data?.MONGODB_PROTOCOL is null')
		}

		if (!rosalesCertSecret.data?.MONGODB_CLUSTER_HOST) {
			throw new Error('rosalesCertSecret.data?.MONGODB_CLUSTER_HOST is null')
		}

		if (!ca) {
			throw new Error('ca is null')
		}

		if (!cert) {
			throw new Error('cert is null')
		}

		if (!key) {
			throw new Error('key is null')
		}

		if (!rosalesCertSecret.data?.MONGODB_NAME) {
			throw new Error('rosalesCertSecret.data?.MONGODB_NAME is null')
		}

		if (!rosalesCertSecret.data?.MONGODB_USERNAME) {
			throw new Error('rosalesCertSecret.data?.MONGODB_USERNAME is null')
		}

		if (!rosalesCertSecret.data?.MONGODB_PASSWORD) {
			throw new Error('rosalesCertSecret.data?.MONGODB_PASSWORD is null')
		}

		const newSecret = {
			apiVersion: 'v1',
			kind: 'Secret',
			metadata: {
				name: 'kirakira-rosales-mongodb-secret',
				namespace: 'kirakira-rosales',
				annotations: {
					syncAt: now,
					syncAtTimestamp: nowTimestamp,
				},
			},
			type: 'Opaque',
			data: {
				MONGODB_PROTOCOL: rosalesCertSecret.data.MONGODB_PROTOCOL,
				MONGODB_CLUSTER_HOST: rosalesCertSecret.data.MONGODB_CLUSTER_HOST,
				MONGODB_TLS_CA_BASE64: caBase64,
				MONGODB_TLS_CERT_BASE64: certBase64,
				MONGODB_TLS_KEY_BASE64: keyBase64,
				MONGODB_NAME: rosalesCertSecret.data.MONGODB_NAME,
				MONGODB_USERNAME: rosalesCertSecret.data.MONGODB_USERNAME,
				MONGODB_PASSWORD: rosalesCertSecret.data.MONGODB_PASSWORD,
			},
		}
		await k8sApi.replaceNamespacedSecret(newSecret.metadata.name, newSecret.metadata.namespace, newSecret)

		await appsV1Api.patchNamespacedDeployment(
			'kirakira-rosales-deployment',
			'kirakira-rosales',
			{
				spec: {
					template: {
						metadata: {
							annotations: {
								'kubectl.kubernetes.io/restartedAt': now,
								restartedAtTimestamp: nowTimestamp,
							},
						},
					},
				},
			},
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			{
				headers: {
					'Content-Type': 'application/strategic-merge-patch+json',
				},
			},
		)
		console.info('Smile! Sweet! Sister! Sadistic! Surprise! Service! Sync Success!')
	} catch (error) {
		const emailBody = {
			html: `The job failed with the following error:\n${error}`,
		}
		await sendMail('b2567240058@gmail.com', 'KIRAKIRA - MongoDB TLS SYNC FAILED!', emailBody)
		throw error
	}
}

copySecretAndUpdateDeployment().catch(err => console.error(err))
