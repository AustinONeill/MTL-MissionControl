export type Role =
  | 'gardener'
  | 'pest_control'
  | 'automation_engineer'
  | 'master_grower'
  | 'director'

export type RoomMode =
  | 'veg'
  | 'flower'
  | 'flush'
  | 'dry'
  | 'idle'
  | 'maintenance'

export type EventAction =
  | 'FLAG_ASSIGN'
  | 'FLAG_REMOVE'
  | 'MODE_CHANGE'
  | 'SPRAY_LOG'
  | 'CALIBRATION_LOG'
  | 'FAILED_NOTIFICATION'

export type EventSource = 'UI' | 'TEAMS'

export interface AuthUser {
  userId: string
  role: Role
  email: string
  name: string
}

export interface Env {
  DATABASE_URL: string
  STACK_AUTH_JWKS_URL: string
  STACK_AUTH_PROJECT_ID: string
  R2_ACCOUNT_ID: string
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string
  R2_PUBLIC_BASE_URL: string
  R2_BUCKET_NAME: string
  TEAMS_WEBHOOK_URL: string
  BOT_FRAMEWORK_APP_ID: string
  BOT_FRAMEWORK_APP_SECRET: string
  AZURE_AD_CLIENT_ID: string
  AZURE_AD_CLIENT_SECRET: string
  AZURE_AD_TENANT_ID: string
  ROOM_DO: DurableObjectNamespace
  R2_BUCKET?: R2Bucket
}

export interface HonoVariables {
  user: AuthUser
}
